/**
 * Chrome Notifications Manager
 * Handles all notification events for AI Shopping Assistant
 */

import { 
  NotificationEvent, 
  NotificationPreferences, 
  NotificationHistory, 
  NotificationContext, 
  ChromeNotificationTemplate 
} from '../shared/types';

export class NotificationManager {
  private notificationHistory: Map<string, NotificationHistory> = new Map();
  private notificationCount: Map<string, number> = new Map(); // hour -> count
  private preferences: NotificationPreferences;

  constructor() {
    this.preferences = this.getDefaultPreferences();
    this.initializeNotificationHandlers();
    this.loadPreferences();
  }

  /**
   * Initialize Chrome notification event handlers
   */
  private initializeNotificationHandlers(): void {
    // Handle notification button clicks
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      this.handleNotificationAction(notificationId, buttonIndex);
    });

    // Handle notification clicks
    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });

    // Handle notification closed
    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      this.handleNotificationClosed(notificationId, byUser);
    });
  }

  /**
   * Create and show notification
   */
  async createNotification(
    event: NotificationEvent,
    context: NotificationContext = {}
  ): Promise<string | null> {
    try {
      // Check if notifications are enabled
      if (!this.preferences.enabled || !this.preferences.events[event]) {
        return null;
      }

      // Check quiet hours
      if (this.isInQuietHours()) {
        return null;
      }

      // Check rate limiting
      if (!this.canSendNotification()) {
        return null;
      }

      // Get notification template
      const template = this.getNotificationTemplate(event, context);
      if (!template) {
        return null;
      }

      // Create Chrome notification
      const notificationId = await this.createChromeNotification(template);
      
      // Track notification
      this.trackNotification(notificationId, event, template, context);
      
      // Update badge if enabled
      if (this.preferences.showBadges) {
        this.updateBadge();
      }

      return notificationId;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return null;
    }
  }

  /**
   * Get notification template for event type
   */
  private getNotificationTemplate(
    event: NotificationEvent, 
    context: NotificationContext
  ): ChromeNotificationTemplate | null {
    const { productName, savings, currency = '$', rounds, sellerName, errorCode } = context;

    const templates: Record<NotificationEvent, ChromeNotificationTemplate> = {
      [NotificationEvent.DEAL_COMPLETED]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '🎉 Deal Secured!',
        message: `Saved ${currency}${savings?.toFixed(2) || '??'} on ${productName || 'product'}`,
        buttons: [
          { title: 'View Deal' },
          { title: 'Continue Shopping' }
        ],
        priority: 2
      },
      
      [NotificationEvent.OFFER_RECEIVED]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png', 
        title: '💰 New Offer Received',
        message: `${sellerName || 'Seller'} made a counter-offer for ${productName || 'your item'}`,
        buttons: [
          { title: 'Review Offer' },
          { title: 'Decline' }
        ],
        priority: 1
      },
      
      [NotificationEvent.NEGOTIATION_STARTED]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '🤝 Negotiation Started',
        message: `AI agent is negotiating for ${productName || 'your item'}`,
        buttons: [
          { title: 'Watch Progress' }
        ],
        priority: 0,
        silent: true
      },
      
      [NotificationEvent.NEGOTIATION_FAILED]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '❌ No Deal Reached',
        message: `Unable to negotiate a deal for ${productName || 'item'} after ${rounds || 0} rounds`,
        buttons: [
          { title: 'Try Again' },
          { title: 'Dismiss' }
        ],
        priority: 1
      },
      
      [NotificationEvent.PRICE_DROP_ALERT]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '📉 Price Drop Alert',
        message: `${productName || 'Item'} price dropped by ${currency}${savings?.toFixed(2) || '??'}`,
        buttons: [
          { title: 'Buy Now' },
          { title: 'Start Negotiation' }
        ],
        priority: 1
      },
      
      [NotificationEvent.SESSION_EXPIRED]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '⏰ Session Expired',
        message: `Negotiation session for ${productName || 'item'} has expired`,
        buttons: [
          { title: 'Start New Session' }
        ],
        priority: 0
      },
      
      [NotificationEvent.USER_ACTION_NEEDED]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '👋 Your Decision Needed',
        message: `AI needs your approval for ${productName || 'item'} negotiation`,
        buttons: [
          { title: 'Review & Decide' }
        ],
        priority: 2
      },
      
      [NotificationEvent.SYSTEM_ERROR]: {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '⚠️ System Error',
        message: `Error occurred: ${errorCode || 'Unknown error'}`,
        buttons: [
          { title: 'Report Issue' }
        ],
        priority: 1
      }
    };

    const template = templates[event];
    if (!template) return null;

    // Apply user preferences
    template.priority = this.preferences.priority;
    template.silent = !this.preferences.soundEnabled;

    return template;
  }

  /**
   * Create Chrome notification
   */
  private createChromeNotification(template: ChromeNotificationTemplate): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: chrome.notifications.NotificationOptions = {
        type: template.type,
        iconUrl: template.iconUrl,
        title: template.title,
        message: template.message,
        priority: template.priority,
        silent: template.silent,
        eventTime: template.eventTime
      };

      // Add buttons if supported
      if (template.buttons && template.buttons.length > 0) {
        options.buttons = template.buttons.map(btn => ({
          title: btn.title,
          iconUrl: btn.iconUrl
        }));
      }

      // Add additional properties based on type
      if (template.type === 'image' && template.imageUrl) {
        options.imageUrl = template.imageUrl;
      }
      
      if (template.type === 'list' && template.items) {
        options.items = template.items;
      }
      
      if (template.type === 'progress' && template.progress !== undefined) {
        options.progress = template.progress;
      }

      if (template.contextMessage) {
        options.contextMessage = template.contextMessage;
      }

      chrome.notifications.create(options, (notificationId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(notificationId);
        }
      });
    });
  }

  /**
   * Handle notification button clicks
   */
  private async handleNotificationAction(notificationId: string, buttonIndex: number): Promise<void> {
    const notification = this.notificationHistory.get(notificationId);
    if (!notification) return;

    // Mark action as clicked
    if (notification.actions[buttonIndex]) {
      notification.actions[buttonIndex].clicked = true;
      notification.actions[buttonIndex].clickedAt = new Date();
    }

    // Handle different actions based on event type
    const actionTitle = notification.actions[buttonIndex]?.title;
    
    switch (notification.event) {
      case NotificationEvent.DEAL_COMPLETED:
        if (actionTitle === 'View Deal') {
          await this.openExtensionPopup();
        }
        break;
        
      case NotificationEvent.OFFER_RECEIVED:
        if (actionTitle === 'Review Offer') {
          await this.openExtensionPopup();
        }
        break;
        
      case NotificationEvent.NEGOTIATION_FAILED:
        if (actionTitle === 'Try Again' && notification.sessionId) {
          await this.retryNegotiation(notification.sessionId);
        }
        break;
        
      case NotificationEvent.USER_ACTION_NEEDED:
        await this.openExtensionPopup();
        break;
    }

    // Clear the notification
    chrome.notifications.clear(notificationId);
  }

  /**
   * Handle notification clicks
   */
  private async handleNotificationClick(notificationId: string): Promise<void> {
    const notification = this.notificationHistory.get(notificationId);
    if (!notification) return;

    notification.read = true;
    
    // Default action is to open the extension popup
    await this.openExtensionPopup();
    
    // Clear the notification
    chrome.notifications.clear(notificationId);
  }

  /**
   * Handle notification closed
   */
  private handleNotificationClosed(notificationId: string, byUser: boolean): void {
    // Clean up notification from history after some time
    setTimeout(() => {
      this.notificationHistory.delete(notificationId);
    }, 60000); // Keep for 1 minute for potential interactions
  }

  /**
   * Check if current time is within quiet hours
   */
  private isInQuietHours(): boolean {
    if (!this.preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;

    const [startHour, startMinute] = this.preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = this.preferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour + startMinute / 60;
    const endTime = endHour + endMinute / 60;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  /**
   * Check if we can send a notification (rate limiting)
   */
  private canSendNotification(): boolean {
    const currentHour = new Date().getHours().toString();
    const count = this.notificationCount.get(currentHour) || 0;
    
    if (count >= this.preferences.maxNotificationsPerHour) {
      return false;
    }
    
    this.notificationCount.set(currentHour, count + 1);
    
    // Clean old hour counts
    setTimeout(() => {
      this.notificationCount.delete(currentHour);
    }, 3600000); // 1 hour
    
    return true;
  }

  /**
   * Track notification in history
   */
  private trackNotification(
    notificationId: string,
    event: NotificationEvent,
    template: ChromeNotificationTemplate,
    context: NotificationContext
  ): void {
    const notification: NotificationHistory = {
      id: notificationId,
      event,
      title: template.title,
      message: template.message,
      timestamp: new Date(),
      read: false,
      actions: (template.buttons || []).map(btn => ({
        title: btn.title,
        clicked: false
      })),
      sessionId: context.sessionId,
      productId: context.productId
    };

    this.notificationHistory.set(notificationId, notification);
  }

  /**
   * Update extension badge
   */
  private async updateBadge(): Promise<void> {
    const unreadCount = Array.from(this.notificationHistory.values())
      .filter(n => !n.read).length;
      
    const badgeText = unreadCount > 0 ? unreadCount.toString() : '';
    
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
  }

  /**
   * Open extension popup
   */
  private async openExtensionPopup(): Promise<void> {
    // Open popup by focusing on it
    const windows = await chrome.windows.getAll({ populate: true });
    const extensionWindow = windows.find(window => 
      window.tabs?.some(tab => tab.url?.includes('popup.html'))
    );

    if (extensionWindow) {
      await chrome.windows.update(extensionWindow.id!, { focused: true });
    }
  }

  /**
   * Retry negotiation for failed session
   */
  private async retryNegotiation(sessionId: string): Promise<void> {
    // Send message to background script to retry negotiation
    chrome.runtime.sendMessage({
      type: 'RETRY_NEGOTIATION',
      sessionId
    });
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      soundEnabled: true,
      priority: 1,
      events: {
        [NotificationEvent.DEAL_COMPLETED]: true,
        [NotificationEvent.NEGOTIATION_FAILED]: true,
        [NotificationEvent.OFFER_RECEIVED]: true,
        [NotificationEvent.NEGOTIATION_STARTED]: false,
        [NotificationEvent.PRICE_DROP_ALERT]: true,
        [NotificationEvent.SESSION_EXPIRED]: false,
        [NotificationEvent.USER_ACTION_NEEDED]: true,
        [NotificationEvent.SYSTEM_ERROR]: true
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      maxNotificationsPerHour: 10,
      showBadges: true
    };
  }

  /**
   * Load preferences from storage
   */
  private async loadPreferences(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get('notificationPreferences');
      if (result.notificationPreferences) {
        this.preferences = { ...this.preferences, ...result.notificationPreferences };
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...preferences };
    
    try {
      await chrome.storage.sync.set({ notificationPreferences: this.preferences });
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  /**
   * Get notification history
   */
  getNotificationHistory(): NotificationHistory[] {
    return Array.from(this.notificationHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear notification history
   */
  clearNotificationHistory(): void {
    this.notificationHistory.clear();
    this.updateBadge();
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }
}

// Global instance
export const notificationManager = new NotificationManager();