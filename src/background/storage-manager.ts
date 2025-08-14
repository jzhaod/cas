// Storage Manager - Handles all browser extension storage operations
import { ProductInfo } from '../content/product-detector';
import { AmazonPreferences } from '../shared/types';

export interface ExtensionSettings {
  isEnabled: boolean;
  llmProvider: 'openai' | 'anthropic' | 'local';
  llmApiKey?: string;
  llmModel: string;
  maxNegotiationRounds: number;
  autoAcceptThreshold: number;
  minSavingsTarget: number;
  notificationsEnabled: boolean;
  privacyMode: 'full' | 'limited' | 'minimal';
  amazonPreferences: AmazonPreferences;
}

export interface ProductView {
  productId: string;
  productInfo: ProductInfo;
  timestamp: Date;
  dwellTime?: number;
  interacted: boolean;
}

export interface UserBehavior {
  productId: string;
  dwellTime: number;
  interactions: string[];
  priceChecks: number;
  addToCartAttempts: number;
  interestScore: number;
  timestamp: Date;
}

export interface SuccessfulDeal {
  sessionId: string;
  productInfo: ProductInfo;
  originalPrice: number;
  finalPrice: number;
  savings: number;
  timestamp: Date;
  negotiationRounds: number;
  seller: string;
}

export interface UserStats {
  totalSavings: number;
  dealsCompleted: number;
  activeNegotiations: number;
  successRate: number;
  averageDiscount: number;
  favoriteCategories: string[];
  lastUpdated: Date;
}

export class StorageManager {
  private readonly SETTINGS_KEY = 'extension_settings';
  private readonly STATS_KEY = 'user_stats';
  private readonly PRODUCTS_KEY = 'product_views';
  private readonly BEHAVIOR_KEY = 'user_behavior';
  private readonly DEALS_KEY = 'successful_deals';

  constructor() {
    this.initializeDefaults();
  }

  private async initializeDefaults(): Promise<void> {
    try {
      // Check if settings exist, if not create defaults
      const settings = await this.getSettings();
      if (!settings.llmProvider) {
        await this.setDefaults();
      }
    } catch (error) {
      console.error('Failed to initialize storage defaults:', error);
    }
  }

  private async setDefaults(): Promise<void> {
    const defaultSettings: ExtensionSettings = {
      isEnabled: true,
      llmProvider: 'openai',
      llmModel: 'gpt-4',
      maxNegotiationRounds: 5,
      autoAcceptThreshold: 0.15, // Auto-accept if savings >= 15%
      minSavingsTarget: 10, // Minimum $10 savings to negotiate
      notificationsEnabled: true,
      privacyMode: 'limited',
      amazonPreferences: {
        hideSponsored: true,
        primeOnly: false,
        minRating: 0,
        minReviews: 0,
        hideOutOfStock: false,
        preferAmazonShipping: false,
        blockedSellers: []
      }
    };

    const defaultStats: UserStats = {
      totalSavings: 0,
      dealsCompleted: 0,
      activeNegotiations: 0,
      successRate: 0,
      averageDiscount: 0,
      favoriteCategories: [],
      lastUpdated: new Date()
    };

    await chrome.storage.local.set({
      [this.SETTINGS_KEY]: defaultSettings,
      [this.STATS_KEY]: defaultStats,
      [this.PRODUCTS_KEY]: [],
      [this.BEHAVIOR_KEY]: [],
      [this.DEALS_KEY]: []
    });

    console.log('✅ Storage defaults initialized');
  }

  // Settings Management
  async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.local.get(this.SETTINGS_KEY);
      return result[this.SETTINGS_KEY] || {};
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {} as ExtensionSettings;
    }
  }

  async updateSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      
      await chrome.storage.local.set({
        [this.SETTINGS_KEY]: updatedSettings
      });

      console.log('⚙️ Settings updated:', Object.keys(settings));
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  async setSetting<K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K]
  ): Promise<void> {
    await this.updateSettings({ [key]: value } as Partial<ExtensionSettings>);
  }

  // Product Views Management
  async recordProductView(productInfo: ProductInfo): Promise<void> {
    try {
      const views = await this.getProductViews();
      
      const newView: ProductView = {
        productId: productInfo.id,
        productInfo,
        timestamp: new Date(),
        interacted: false
      };

      // Add to beginning of array and limit to last 100 views
      views.unshift(newView);
      const limitedViews = views.slice(0, 100);

      await chrome.storage.local.set({
        [this.PRODUCTS_KEY]: limitedViews
      });

      console.log('📦 Product view recorded:', productInfo.name);
    } catch (error) {
      console.error('Failed to record product view:', error);
    }
  }

  async getProductViews(): Promise<ProductView[]> {
    try {
      const result = await chrome.storage.local.get(this.PRODUCTS_KEY);
      const views = result[this.PRODUCTS_KEY] || [];
      
      // Convert timestamp strings back to Date objects
      return views.map((view: any) => ({
        ...view,
        timestamp: new Date(view.timestamp)
      }));
    } catch (error) {
      console.error('Failed to get product views:', error);
      return [];
    }
  }

  async getProductInfo(productId: string): Promise<ProductInfo | null> {
    try {
      const views = await this.getProductViews();
      const view = views.find(v => v.productId === productId);
      return view ? view.productInfo : null;
    } catch (error) {
      console.error('Failed to get product info:', error);
      return null;
    }
  }

  // User Behavior Management
  async recordBehavior(behavior: UserBehavior): Promise<void> {
    try {
      const behaviors = await this.getUserBehaviors();
      
      const behaviorWithTimestamp = {
        ...behavior,
        timestamp: new Date()
      };

      // Add to beginning and limit to last 50 behavior records
      behaviors.unshift(behaviorWithTimestamp);
      const limitedBehaviors = behaviors.slice(0, 50);

      await chrome.storage.local.set({
        [this.BEHAVIOR_KEY]: limitedBehaviors
      });

      console.log('📊 Behavior recorded for product:', behavior.productId);
    } catch (error) {
      console.error('Failed to record behavior:', error);
    }
  }

  async getUserBehaviors(): Promise<UserBehavior[]> {
    try {
      const result = await chrome.storage.local.get(this.BEHAVIOR_KEY);
      const behaviors = result[this.BEHAVIOR_KEY] || [];
      
      // Convert timestamp strings back to Date objects
      return behaviors.map((behavior: any) => ({
        ...behavior,
        timestamp: new Date(behavior.timestamp)
      }));
    } catch (error) {
      console.error('Failed to get user behaviors:', error);
      return [];
    }
  }

  // Successful Deals Management
  async recordSuccessfulDeal(deal: SuccessfulDeal): Promise<void> {
    try {
      const deals = await this.getSuccessfulDeals();
      
      const dealWithTimestamp = {
        ...deal,
        timestamp: new Date()
      };

      // Add to beginning of array
      deals.unshift(dealWithTimestamp);

      await chrome.storage.local.set({
        [this.DEALS_KEY]: deals
      });

      // Update stats
      await this.updateStatsAfterDeal(deal);

      console.log('💰 Successful deal recorded:', deal.savings);
    } catch (error) {
      console.error('Failed to record successful deal:', error);
    }
  }

  async getSuccessfulDeals(): Promise<SuccessfulDeal[]> {
    try {
      const result = await chrome.storage.local.get(this.DEALS_KEY);
      const deals = result[this.DEALS_KEY] || [];
      
      // Convert timestamp strings back to Date objects
      return deals.map((deal: any) => ({
        ...deal,
        timestamp: new Date(deal.timestamp)
      }));
    } catch (error) {
      console.error('Failed to get successful deals:', error);
      return [];
    }
  }

  // Stats Management
  async getStats(): Promise<UserStats> {
    try {
      const result = await chrome.storage.local.get(this.STATS_KEY);
      const stats = result[this.STATS_KEY] || {};
      
      if (stats.lastUpdated) {
        stats.lastUpdated = new Date(stats.lastUpdated);
      }
      
      return stats;
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalSavings: 0,
        dealsCompleted: 0,
        activeNegotiations: 0,
        successRate: 0,
        averageDiscount: 0,
        favoriteCategories: [],
        lastUpdated: new Date()
      };
    }
  }

  async updateStats(statsUpdate: Partial<UserStats>): Promise<void> {
    try {
      const currentStats = await this.getStats();
      const updatedStats = {
        ...currentStats,
        ...statsUpdate,
        lastUpdated: new Date()
      };

      await chrome.storage.local.set({
        [this.STATS_KEY]: updatedStats
      });

      console.log('📊 Stats updated');
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  private async updateStatsAfterDeal(deal: SuccessfulDeal): Promise<void> {
    try {
      const stats = await this.getStats();
      const deals = await this.getSuccessfulDeals();
      
      const newTotalSavings = stats.totalSavings + deal.savings;
      const newDealsCompleted = stats.dealsCompleted + 1;
      
      // Calculate average discount
      const totalDiscountValue = deals.reduce((sum, d) => sum + d.savings, 0);
      const totalOriginalValue = deals.reduce((sum, d) => sum + d.originalPrice, 0);
      const newAverageDiscount = totalOriginalValue > 0 
        ? (totalDiscountValue / totalOriginalValue) * 100 
        : 0;

      // Update favorite categories
      const categoryCount: { [key: string]: number } = {};
      deals.forEach(d => {
        const category = d.productInfo.category || 'Unknown';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });
      
      const favoriteCategories = Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category]) => category);

      await this.updateStats({
        totalSavings: newTotalSavings,
        dealsCompleted: newDealsCompleted,
        averageDiscount: newAverageDiscount,
        favoriteCategories
      });
    } catch (error) {
      console.error('Failed to update stats after deal:', error);
    }
  }

  // Data Export/Import
  async exportData(): Promise<{
    settings: ExtensionSettings;
    stats: UserStats;
    productViews: ProductView[];
    behaviors: UserBehavior[];
    deals: SuccessfulDeal[];
    exportDate: Date;
  }> {
    try {
      const [settings, stats, productViews, behaviors, deals] = await Promise.all([
        this.getSettings(),
        this.getStats(),
        this.getProductViews(),
        this.getUserBehaviors(),
        this.getSuccessfulDeals()
      ]);

      return {
        settings,
        stats,
        productViews,
        behaviors,
        deals,
        exportDate: new Date()
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async importData(data: {
    settings?: ExtensionSettings;
    stats?: UserStats;
    productViews?: ProductView[];
    behaviors?: UserBehavior[];
    deals?: SuccessfulDeal[];
  }): Promise<void> {
    try {
      const updates: { [key: string]: any } = {};

      if (data.settings) updates[this.SETTINGS_KEY] = data.settings;
      if (data.stats) updates[this.STATS_KEY] = data.stats;
      if (data.productViews) updates[this.PRODUCTS_KEY] = data.productViews;
      if (data.behaviors) updates[this.BEHAVIOR_KEY] = data.behaviors;
      if (data.deals) updates[this.DEALS_KEY] = data.deals;

      await chrome.storage.local.set(updates);
      
      console.log('📥 Data imported successfully');
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  // Privacy and Cleanup
  async clearUserData(): Promise<void> {
    try {
      await chrome.storage.local.remove([
        this.PRODUCTS_KEY,
        this.BEHAVIOR_KEY,
        this.DEALS_KEY
      ]);

      // Reset stats but keep settings
      await this.updateStats({
        totalSavings: 0,
        dealsCompleted: 0,
        activeNegotiations: 0,
        successRate: 0,
        averageDiscount: 0,
        favoriteCategories: []
      });

      console.log('🧹 User data cleared');
    } catch (error) {
      console.error('Failed to clear user data:', error);
      throw error;
    }
  }

  async clearOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Clean old product views
      const views = await this.getProductViews();
      const recentViews = views.filter(v => v.timestamp > cutoffDate);
      
      // Clean old behaviors
      const behaviors = await this.getUserBehaviors();
      const recentBehaviors = behaviors.filter(b => b.timestamp > cutoffDate);

      await chrome.storage.local.set({
        [this.PRODUCTS_KEY]: recentViews,
        [this.BEHAVIOR_KEY]: recentBehaviors
      });

      console.log(`🧹 Cleaned data older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Failed to clean old data:', error);
    }
  }

  // Storage Usage and Monitoring
  async getStorageUsage(): Promise<{
    bytesInUse: number;
    quota: number;
    percentUsed: number;
  }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      const percentUsed = (bytesInUse / quota) * 100;

      return {
        bytesInUse,
        quota,
        percentUsed
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return {
        bytesInUse: 0,
        quota: chrome.storage.local.QUOTA_BYTES,
        percentUsed: 0
      };
    }
  }

  // Sync Methods (for settings sync across devices)
  async syncSettings(): Promise<void> {
    try {
      const localSettings = await this.getSettings();
      
      // Get synced settings
      const syncResult = await chrome.storage.sync.get(this.SETTINGS_KEY);
      const syncedSettings = syncResult[this.SETTINGS_KEY];

      if (syncedSettings) {
        // Merge with local settings (local takes precedence for API keys)
        const mergedSettings = {
          ...syncedSettings,
          llmApiKey: localSettings.llmApiKey // Keep local API keys for security
        };

        await this.updateSettings(mergedSettings);
      } else {
        // Push local settings to sync (without API keys)
        const settingsToSync = { ...localSettings };
        delete settingsToSync.llmApiKey; // Don't sync API keys

        await chrome.storage.sync.set({
          [this.SETTINGS_KEY]: settingsToSync
        });
      }

      console.log('🔄 Settings synced');
    } catch (error) {
      console.error('Failed to sync settings:', error);
    }
  }
}