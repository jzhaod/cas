// Background Service Worker - Core orchestration for AI Shopping Assistant
import { MCPClient } from './mcp-client';
import { CrewAIAgent } from './crew-ai-agent';
import { DiscoveryClient } from './discovery-client';
import { SessionManager } from './session-manager';
import { StorageManager } from './storage-manager';
import { notificationManager } from './notification-manager';
import { NotificationEvent } from '../shared/types';

interface ProductInfo {
  id: string;
  asin: string;
  name: string;
  price: number;
  originalPrice?: number;
  currency: string;
  image: string;
  seller: string;
  url: string;
}

interface UserBehavior {
  productId: string;
  dwellTime: number;
  interactions: string[];
  priceChecks: number;
  addToCartAttempts: number;
  interestScore: number;
}

interface NegotiationSession {
  sessionId: string;
  productId: string;
  productInfo: ProductInfo;
  behavior: UserBehavior;
  status: 'pending' | 'active' | 'completed' | 'failed';
  sellerEndpoint?: string;
  currentOffer?: any;
  negotiationLog: any[];
  startTime: Date;
  lastUpdate: Date;
  expiresAt: Date;
}

class ShoppingAssistantServiceWorker {
  private mcpClient: MCPClient;
  private crewAI: CrewAIAgent;
  private discoveryClient: DiscoveryClient;
  private sessionManager: SessionManager;
  private storageManager: StorageManager;
  private isEnabled: boolean = true;
  private activeSessions: Map<string, NegotiationSession> = new Map();

  constructor() {
    this.mcpClient = new MCPClient();
    this.crewAI = new CrewAIAgent();
    this.discoveryClient = new DiscoveryClient();
    this.sessionManager = new SessionManager();
    this.storageManager = new StorageManager();

    this.initialize();
  }

  private async initialize() {
    try {
      console.log('🚀 AI Shopping Assistant Service Worker starting...');

      // Load settings from storage
      await this.loadSettings();

      // Setup message listeners
      this.setupMessageHandlers();

      // Setup alarm handlers for cleanup and monitoring
      this.setupAlarmHandlers();

      // Restore active sessions
      await this.restoreActiveSessions();

      console.log('✅ Service Worker initialized successfully');
    } catch (error) {
      console.error('❌ Service Worker initialization failed:', error);
      // Continue running with minimal functionality
    }
  }

  private async loadSettings() {
    try {
      const settings = await this.storageManager.getSettings();
      this.isEnabled = settings.isEnabled ?? true;
      
      // Initialize AI agent with user settings
      await this.crewAI.configure({
        llmProvider: settings.llmProvider || 'openai',
        apiKey: settings.llmApiKey,
        model: settings.llmModel || 'gpt-4',
        maxNegotiationRounds: settings.maxNegotiationRounds || 5
      });
    } catch (error) {
      console.warn('⚠️ Failed to load settings, using defaults:', error);
      this.isEnabled = true;
    }
  }

  private setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  private async handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    try {
      switch (message.type) {
        case 'product_view':
          await this.handleProductView(message.productInfo, message.url, sender.tab?.id);
          sendResponse({ success: true });
          break;

        case 'start_negotiation':
          const result = await this.startNegotiation(
            message.productId, 
            message.behavior, 
            message.url,
            message.productInfo, // Pass productInfo for manual negotiations
            message.manual,
            message.preferences // Pass user preferences
          );
          sendResponse({ success: true, sessionId: result.sessionId });
          break;

        case 'behavior_data':
          await this.updateBehaviorData(message.behavior);
          sendResponse({ success: true });
          break;

        case 'get_active_deals':
          const deals = await this.getActiveDeals();
          sendResponse({ deals });
          break;

        case 'deal_action':
          await this.handleDealAction(message.sessionId, message.action);
          sendResponse({ success: true });
          break;

        case 'accept_deal':
          await this.acceptDeal(message.dealId, message.sessionId);
          sendResponse({ success: true });
          break;

        case 'complete_purchase':
          await this.completePurchase(message.sessionId);
          sendResponse({ success: true });
          break;

        case 'toggle_enabled':
          this.isEnabled = message.enabled;
          await this.storageManager.setSetting('isEnabled', message.enabled);
          sendResponse({ success: true });
          break;

        case 'NOTIFICATION_PREFERENCES_UPDATED':
          await notificationManager.updatePreferences(message.preferences);
          sendResponse({ success: true });
          break;

        case 'TEST_NOTIFICATION':
          const notificationId = await notificationManager.createNotification(
            message.event || NotificationEvent.DEAL_COMPLETED,
            message.context || {}
          );
          sendResponse({ success: true, notificationId });
          break;

        case 'RETRY_NEGOTIATION':
          const retryResult = await this.retryNegotiation(message.sessionId);
          sendResponse({ success: retryResult });
          break;

        case 'get_stats':
          const stats = await this.getStats();
          sendResponse({ stats });
          break;

        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleProductView(productInfo: ProductInfo, url: string, tabId?: number) {
    if (!this.isEnabled || !tabId) return;

    console.log('📦 Product view detected:', productInfo.name);

    // Store product view for analytics
    await this.storageManager.recordProductView(productInfo);

    // Check if we should start monitoring this product
    const shouldMonitor = await this.shouldMonitorProduct(productInfo);
    
    if (shouldMonitor) {
      // Notify content script to show AI badge
      chrome.tabs.sendMessage(tabId, {
        type: 'show_ai_badge',
        productInfo
      });
    }
  }

  private async shouldMonitorProduct(productInfo: ProductInfo): Promise<boolean> {
    // Simple heuristics for now - can be enhanced with ML
    if (productInfo.price > 1000) return true; // High-value items
    if (productInfo.seller === 'Amazon') return false; // Skip Amazon direct sales for MVP
    
    // Check if product category is supported
    const supportedCategories = ['Electronics', 'Computers', 'Home & Garden'];
    // Would need category detection from product info
    
    return true; // Enable for all products in MVP
  }

  private async startNegotiation(
    productId: string, 
    behavior: UserBehavior, 
    url: string, 
    providedProductInfo?: ProductInfo,
    isManual?: boolean,
    preferences?: any
  ): Promise<{ sessionId: string }> {
    if (!this.isEnabled) {
      throw new Error('AI Assistant is disabled');
    }

    console.log('🤝 Starting negotiation for product:', productId, isManual ? '(manual)' : '(automatic)');

    // Create negotiation session
    const sessionId = crypto.randomUUID();
    
    // Use provided product info (for manual negotiations) or lookup from storage
    let productInfo = providedProductInfo;
    if (!productInfo) {
      productInfo = await this.storageManager.getProductInfo(productId);
    }

    if (!productInfo) {
      throw new Error('Product information not found');
    }

    // Store product info if it was provided (manual negotiation case)
    if (providedProductInfo && isManual) {
      await this.storageManager.recordProductView(productInfo);
    }

    const now = new Date();
    const session: NegotiationSession = {
      sessionId,
      productId,
      productInfo,
      behavior,
      preferences, // Add user preferences to session
      status: 'pending',
      negotiationLog: [],
      startTime: now,
      lastUpdate: now,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    };

    this.activeSessions.set(sessionId, session);
    await this.sessionManager.saveSession(session);

    // Send notification for negotiation started
    await notificationManager.createNotification(NotificationEvent.NEGOTIATION_STARTED, {
      sessionId,
      productId,
      productName: productInfo.name
    });

    // Notify popup about new deal
    this.broadcastDealUpdate();

    // Start negotiation process asynchronously
    this.executeNegotiation(session).catch(error => {
      console.error('Negotiation failed:', error);
      this.handleNegotiationFailure(sessionId, error);
    });

    // Also broadcast status to popup for visibility
    this.broadcastNegotiationUpdate(sessionId, 'started', {
      productName: productInfo.name,
      message: 'Negotiation initiated, searching for sellers...'
    });

    return { sessionId };
  }

  private async executeNegotiation(session: NegotiationSession) {
    try {
      // Step 1: Update status and notify content script
      console.log('🔍 Starting negotiation for:', session.productInfo.name);
      session.status = 'active';
      await this.updateSession(session);

      // Notify content script of negotiation start
      this.notifyContentScript(session.productInfo.url, {
        type: 'negotiation_status',
        status: 'negotiating',
        data: { round: 1 }
      });

      // Add a delay for testing purposes (simulating real negotiation time)
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      
      // Step 2: Try real discovery and negotiation, fallback to mock if it fails
      let finalPrice: number;
      let savings: number;
      
      try {
        console.log('🔍 Discovering sellers for:', session.productInfo.name);
        this.broadcastNegotiationUpdate(session.sessionId, 'discovering', {
          productName: session.productInfo.name,
          message: 'Searching for available sellers...'
        });
        
        // Simplify category for API compatibility
        const originalCategory = session.productInfo.category;
        const simplifiedCategory = this.simplifyCategory(originalCategory);
        console.log('📂 Category mapping:', originalCategory, '→', simplifiedCategory);
        
        const sellers = await this.discoveryClient.findSellers({
          productId: session.productId,
          category: simplifiedCategory,
          priceRange: [0, session.productInfo.price * 1.2], // 20% above current price
          minRating: 3.5
        });

        if (sellers.length === 0) {
          throw new Error('No sellers available for negotiation');
        }

        // Step 3: Try to negotiate with best seller
        const bestSeller = sellers[0]; // Already sorted by rating/response time
        console.log('🤝 Negotiating with seller:', bestSeller.sellerName);
        
        // Connect to seller's MCP server
        await this.mcpClient.connect(
          bestSeller.mcpEndpoint,
          bestSeller.apiKey
        );

        // Build buyer context with preferences if available
        const buyerContext: any = {
          urgency: session.behavior.interestScore > 0.8 ? 'high' : 'medium',
          priceTarget: session.preferences?.maxPrice || session.productInfo.price * 0.85,
          quantity: session.preferences?.options?.willingToBuyMultiple ? 2 : 1
        };

        // Add preferences to buyer context if provided
        if (session.preferences) {
          buyerContext.preferences = {
            desiredDiscount: session.preferences.desiredDiscount,
            maxPrice: session.preferences.maxPrice,
            negotiationOptions: session.preferences.options,
            strategy: session.preferences.strategy,
            customRequirements: session.preferences.customRequirements
          };
        }

        // Initiate negotiation via MCP
        const negotiationResult = await this.mcpClient.initiateNegotiation({
          sessionId: session.sessionId,
          productId: session.productId,
          buyerContext
        });

        if (!negotiationResult.success) {
          throw new Error(negotiationResult.error || 'Failed to initiate negotiation');
        }

        // Store seller endpoint for this session
        session.sellerEndpoint = bestSeller.mcpEndpoint;

        // Get the negotiated deal
        finalPrice = negotiationResult.data?.finalPrice || session.productInfo.price * 0.85;
        savings = session.productInfo.price - finalPrice;
        
        console.log('✅ Real negotiation completed successfully');
        
      } catch (realFlowError) {
        // Fallback to mock negotiation for testing
        console.warn('⚠️ Real negotiation failed, using mock data:', realFlowError.message);
        console.log('💬 Simulating negotiation process...');
        this.broadcastNegotiationUpdate(session.sessionId, 'fallback', {
          productName: session.productInfo.name,
          message: 'Discovery failed, using mock negotiation...',
          error: realFlowError.message
        });
        
        // Simulate negotiation delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create mock successful result based on preferences or default
        const targetDiscount = session.preferences?.desiredDiscount || 15;
        savings = Math.round(session.productInfo.price * (targetDiscount / 100));
        
        // Respect user's max price preference if set
        if (session.preferences?.maxPrice) {
          finalPrice = Math.min(session.preferences.maxPrice, session.productInfo.price - savings);
          savings = session.productInfo.price - finalPrice;
        } else {
          finalPrice = session.productInfo.price - savings;
        }
        
        console.log('✅ Mock negotiation completed');
      }
      
      session.status = 'completed';
      session.currentOffer = {
        price: finalPrice,
        currency: session.productInfo.currency,
        rounds: 3,
        timestamp: new Date()
      };
      
      // Notify user of successful deal
      this.notifyContentScript(session.productInfo.url, {
        type: 'negotiation_status',
        status: 'deal_found',
        data: {
          savings: savings,
          finalPrice: finalPrice,
          currency: session.productInfo.currency,
          discountPercent: Math.round((savings / session.productInfo.price) * 100)
        }
      });

      // Show browser notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Deal Found! 🎉',
        message: `Save $${savings} on ${session.productInfo.name}`
      });

      console.log('✅ Mock negotiation completed successfully');

      await this.updateSession(session);

    } catch (error) {
      console.error('Negotiation execution failed:', error);
      session.status = 'failed';
      await this.updateSession(session);

      // Send negotiation failed notification
      await notificationManager.createNotification(NotificationEvent.NEGOTIATION_FAILED, {
        sessionId: session.sessionId,
        productId: session.productId,
        productName: session.productInfo.name,
        rounds: session.negotiationLog.length
      });

      this.notifyContentScript(session.productInfo.url, {
        type: 'negotiation_status',
        status: 'failed',
        data: { error: error.message }
      });
    } finally {
      // Cleanup MCP connection
      await this.mcpClient.disconnect();
    }
  }

  private async handleNegotiationFailure(sessionId: string, error: Error) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.lastUpdate = new Date();
    await this.updateSession(session);

    // Notify user
    this.notifyContentScript(session.productInfo.url, {
      type: 'negotiation_status',
      status: 'failed',
      data: { error: error.message }
    });
  }

  private async updateSession(session: NegotiationSession) {
    session.lastUpdate = new Date();
    this.activeSessions.set(session.sessionId, session);
    await this.sessionManager.saveSession(session);
    
    // Notify popup about deal updates
    this.broadcastDealUpdate();
    
    // Update stats
    await this.updateStats();
  }

  private async getActiveDeals() {
    const sessions = Array.from(this.activeSessions.values());
    
    return sessions
      .filter(s => s.status === 'pending' || s.status === 'active' || s.status === 'completed')
      .map(session => ({
        sessionId: session.sessionId,
        productId: session.productId,
        productName: session.productInfo.name,
        productImage: session.productInfo.image,
        productUrl: session.productInfo.url,
        originalPrice: session.productInfo.price,
        currentOffer: session.currentOffer?.price || session.productInfo.price,
        status: this.mapSessionStatusToDealStatus(session.status),
        lastUpdate: session.lastUpdate,
        rounds: session.currentOffer?.rounds || 0,
        seller: session.productInfo.seller
      }));
  }

  private mapSessionStatusToDealStatus(status: string) {
    const statusMap: { [key: string]: string } = {
      'pending': 'negotiating',
      'active': 'negotiating', 
      'completed': 'deal_ready',
      'failed': 'failed'
    };
    return statusMap[status] || 'negotiating';
  }

  private async handleDealAction(sessionId: string, action: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    switch (action) {
      case 'accept':
        await this.acceptDeal(sessionId, sessionId);
        break;
      case 'reject':
        session.status = 'failed';
        await this.updateSession(session);
        break;
      case 'counter':
        // Re-initiate negotiation with different parameters
        await this.executeNegotiation(session);
        break;
    }
  }

  private async acceptDeal(dealId: string, sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.currentOffer) {
      throw new Error('Deal not found or no offer available');
    }

    console.log('✅ Deal accepted:', dealId);

    // Generate checkout URL or discount code
    const checkoutInfo = await this.generateCheckoutInfo(session);

    // Record successful deal for analytics
    const savings = session.productInfo.price - session.currentOffer.price;
    await this.storageManager.recordSuccessfulDeal({
      sessionId,
      productInfo: session.productInfo,
      originalPrice: session.productInfo.price,
      finalPrice: session.currentOffer.price,
      savings,
      timestamp: new Date()
    });

    // Send deal completed notification
    await notificationManager.createNotification(NotificationEvent.DEAL_COMPLETED, {
      sessionId,
      productId: session.productId,
      productName: session.productInfo.name,
      savings,
      currency: session.productInfo.currency
    });

    // Notify content script to redirect to checkout
    this.notifyContentScript(session.productInfo.url, {
      type: 'deal_accepted',
      checkoutInfo
    });
  }

  private async completePurchase(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    console.log('🛒 Completing purchase for session:', sessionId);

    // Mark session as completed
    session.status = 'completed';
    await this.updateSession(session);

    // Generate checkout info
    const checkoutInfo = await this.generateCheckoutInfo(session);

    // Open product URL in current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.update(tabs[0].id, { 
          url: session.productInfo.url
        });
      }
    });

    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Purchase Ready! 🛒',
      message: `Redirecting to complete your purchase of ${session.productInfo.name}`
    });

    return { checkoutInfo };
  }

  private async generateCheckoutInfo(session: NegotiationSession) {
    // For MVP, return the negotiated offer details
    // In production, this would integrate with actual checkout systems
    return {
      discountCode: `AI-DEAL-${session.sessionId.substring(0, 8).toUpperCase()}`,
      finalPrice: session.currentOffer.price,
      savings: session.productInfo.price - session.currentOffer.price,
      validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      checkoutUrl: session.productInfo.url
    };
  }

  private async updateBehaviorData(behavior: UserBehavior) {
    // Store behavior data for analytics and improvement
    await this.storageManager.recordBehavior(behavior);
  }

  private async getStats() {
    return await this.storageManager.getStats();
  }

  private async updateStats() {
    const activeSessions = Array.from(this.activeSessions.values());
    const completedDeals = activeSessions.filter(s => s.status === 'completed');
    
    const totalSavings = completedDeals.reduce((sum, session) => {
      if (session.currentOffer) {
        return sum + (session.productInfo.price - session.currentOffer.price);
      }
      return sum;
    }, 0);

    await this.storageManager.updateStats({
      activeNegotiations: activeSessions.filter(s => s.status === 'active').length,
      totalSavings,
      completedDeals: completedDeals.length,
      successRate: activeSessions.length > 0 ? completedDeals.length / activeSessions.length : 0
    });

    // Broadcast stats update to popup
    this.broadcastStatsUpdate();
  }

  private broadcastStatsUpdate() {
    chrome.runtime.sendMessage({
      type: 'stats_update',
      data: {
        activeNegotiations: Array.from(this.activeSessions.values()).filter(s => s.status === 'active').length,
        // Add other stats as needed
      }
    }).catch(() => {
      // Popup might not be open, ignore error
    });
  }

  private broadcastDealUpdate() {
    chrome.runtime.sendMessage({
      type: 'deal_update'
    }).catch(() => {
      // Popup might not be open, ignore error
    });
  }

  private broadcastNegotiationUpdate(sessionId: string, status: string, data: any) {
    console.log(`📡 Negotiation Update [${sessionId.substring(0, 8)}]:`, status, data.message);
    chrome.runtime.sendMessage({
      type: 'negotiation_update',
      sessionId,
      status,
      data
    }).catch(() => {
      // Popup might not be open, ignore error
    });
  }

  private notifyContentScript(url: string, message: any) {
    console.log('📤 Notifying content script:', message.type, 'for URL:', url);
    
    // Try exact URL match first
    chrome.tabs.query({ url: url }, (tabs) => {
      if (tabs.length > 0) {
        this.sendToTabs(tabs, message);
      } else {
        // Fallback: Find Amazon tabs if URL is complex
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('amazon')) {
          chrome.tabs.query({ url: `*://*.amazon.com/*` }, (amazonTabs) => {
            console.log('📍 Found Amazon tabs for fallback:', amazonTabs.length);
            this.sendToTabs(amazonTabs, message);
          });
        }
      }
    });
  }

  private sendToTabs(tabs: chrome.tabs.Tab[], message: any) {
    tabs.forEach(tab => {
      if (tab.id) {
        console.log(`📨 Sending message to tab ${tab.id}:`, message.type);
        chrome.tabs.sendMessage(tab.id, message).catch((error) => {
          console.warn(`⚠️ Failed to send message to tab ${tab.id}:`, error);
        });
      }
    });
  }

  private setupAlarmHandlers() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      switch (alarm.name) {
        case 'cleanup_sessions':
          this.cleanupStaleSessions();
          break;
        case 'update_stats':
          this.updateStats();
          break;
      }
    });

    // Schedule periodic cleanup and stats updates
    chrome.alarms.create('cleanup_sessions', { periodInMinutes: 60 });
    chrome.alarms.create('update_stats', { periodInMinutes: 5 });
  }

  private async cleanupStaleSessions() {
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.lastUpdate.getTime() < oneWeekAgo && session.status !== 'completed') {
        console.log('🧹 Cleaning up stale session:', sessionId);
        this.activeSessions.delete(sessionId);
        await this.sessionManager.deleteSession(sessionId);
      }
    }
  }

  private async restoreActiveSessions() {
    try {
      const sessions = await this.sessionManager.getActiveSessions();
      sessions.forEach(session => {
        this.activeSessions.set(session.sessionId, session);
      });
      console.log(`📥 Restored ${sessions.length} active sessions`);
    } catch (error) {
      console.error('Failed to restore sessions:', error);
    }
  }

  /**
   * Simplify Amazon category breadcrumbs for API compatibility
   */
  private simplifyCategory(category?: string): string | undefined {
    if (!category) return undefined;
    
    // Extract main category from Amazon breadcrumbs like "Cell Phones & Accessories > Cases > Basic Cases"
    const categoryMap: { [key: string]: string } = {
      'Cell Phones': 'electronics',
      'Electronics': 'electronics', 
      'Computers': 'computers',
      'Home': 'home',
      'Books': 'books',
      'Clothing': 'clothing',
      'Sports': 'sports'
    };
    
    // Find the first matching category
    for (const [key, value] of Object.entries(categoryMap)) {
      if (category.includes(key)) {
        return value;
      }
    }
    
    // Default fallback
    return 'general';
  }

  /**
   * Retry a failed negotiation
   */
  private async retryNegotiation(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        console.error('Session not found for retry:', sessionId);
        return false;
      }

      // Reset session status and clear previous negotiation log
      session.status = 'pending';
      session.negotiationLog = [];
      session.lastUpdate = new Date();
      
      await this.updateSession(session);

      // Restart the negotiation process
      this.executeNegotiation(session).catch(error => {
        console.error('Retry negotiation failed:', error);
      });

      console.log('🔄 Retrying negotiation for session:', sessionId);
      return true;
    } catch (error) {
      console.error('Failed to retry negotiation:', error);
      return false;
    }
  }
}

// Initialize service worker when script loads
const serviceWorker = new ShoppingAssistantServiceWorker();