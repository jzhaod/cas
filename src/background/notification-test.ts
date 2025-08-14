/**
 * Notification System Test Suite
 * Tests all notification scenarios for Phase 6 implementation
 */

import { notificationManager } from './notification-manager';
import { NotificationEvent } from '../shared/types';

export class NotificationTester {
  /**
   * Run comprehensive notification tests
   */
  static async runTests(): Promise<void> {
    console.log('🧪 Starting notification system tests...');

    try {
      // Test 1: Deal completed notification
      await this.testDealCompleted();
      
      // Test 2: Negotiation failed notification  
      await this.testNegotiationFailed();
      
      // Test 3: Offer received notification
      await this.testOfferReceived();
      
      // Test 4: User action needed notification
      await this.testUserActionNeeded();
      
      // Test 5: Price drop alert notification
      await this.testPriceDropAlert();
      
      // Test 6: System error notification
      await this.testSystemError();
      
      // Test 7: Notification preferences
      await this.testNotificationPreferences();
      
      // Test 8: Quiet hours functionality
      await this.testQuietHours();
      
      // Test 9: Rate limiting
      await this.testRateLimiting();

      console.log('✅ All notification tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Notification tests failed:', error);
      throw error;
    }
  }

  /**
   * Test deal completed notification
   */
  private static async testDealCompleted(): Promise<void> {
    console.log('📢 Testing deal completed notification...');
    
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.DEAL_COMPLETED,
      {
        sessionId: 'test-session-1',
        productId: 'test-product-1',
        productName: 'Samsung Galaxy S24 Ultra',
        savings: 125.50,
        currency: '$'
      }
    );
    
    if (notificationId) {
      console.log('✅ Deal completed notification sent:', notificationId);
    } else {
      console.log('⚠️ Deal completed notification was filtered out');
    }
    
    // Wait a bit to see the notification
    await this.wait(2000);
  }

  /**
   * Test negotiation failed notification
   */
  private static async testNegotiationFailed(): Promise<void> {
    console.log('📢 Testing negotiation failed notification...');
    
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.NEGOTIATION_FAILED,
      {
        sessionId: 'test-session-2',
        productId: 'test-product-2',
        productName: 'Apple MacBook Pro M3',
        rounds: 5
      }
    );
    
    if (notificationId) {
      console.log('✅ Negotiation failed notification sent:', notificationId);
    } else {
      console.log('⚠️ Negotiation failed notification was filtered out');
    }
    
    await this.wait(2000);
  }

  /**
   * Test offer received notification
   */
  private static async testOfferReceived(): Promise<void> {
    console.log('📢 Testing offer received notification...');
    
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.OFFER_RECEIVED,
      {
        sessionId: 'test-session-3',
        productId: 'test-product-3',
        productName: 'Sony WH-1000XM5 Headphones',
        sellerName: 'AudioTech Store'
      }
    );
    
    if (notificationId) {
      console.log('✅ Offer received notification sent:', notificationId);
    } else {
      console.log('⚠️ Offer received notification was filtered out');
    }
    
    await this.wait(2000);
  }

  /**
   * Test user action needed notification
   */
  private static async testUserActionNeeded(): Promise<void> {
    console.log('📢 Testing user action needed notification...');
    
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.USER_ACTION_NEEDED,
      {
        sessionId: 'test-session-4',
        productId: 'test-product-4',
        productName: 'Dell XPS 15 Laptop'
      }
    );
    
    if (notificationId) {
      console.log('✅ User action needed notification sent:', notificationId);
    } else {
      console.log('⚠️ User action needed notification was filtered out');
    }
    
    await this.wait(2000);
  }

  /**
   * Test price drop alert notification
   */
  private static async testPriceDropAlert(): Promise<void> {
    console.log('📢 Testing price drop alert notification...');
    
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.PRICE_DROP_ALERT,
      {
        productId: 'test-product-5',
        productName: 'Nintendo Switch OLED',
        savings: 30.00,
        currency: '$'
      }
    );
    
    if (notificationId) {
      console.log('✅ Price drop alert notification sent:', notificationId);
    } else {
      console.log('⚠️ Price drop alert notification was filtered out');
    }
    
    await this.wait(2000);
  }

  /**
   * Test system error notification
   */
  private static async testSystemError(): Promise<void> {
    console.log('📢 Testing system error notification...');
    
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.SYSTEM_ERROR,
      {
        errorCode: 'API_TIMEOUT',
        additionalData: { endpoint: '/api/negotiate' }
      }
    );
    
    if (notificationId) {
      console.log('✅ System error notification sent:', notificationId);
    } else {
      console.log('⚠️ System error notification was filtered out');
    }
    
    await this.wait(2000);
  }

  /**
   * Test notification preferences
   */
  private static async testNotificationPreferences(): Promise<void> {
    console.log('📢 Testing notification preferences...');
    
    // Get current preferences
    const currentPrefs = notificationManager.getPreferences();
    console.log('Current preferences:', currentPrefs);
    
    // Temporarily disable deal completed notifications
    await notificationManager.updatePreferences({
      events: {
        ...currentPrefs.events,
        [NotificationEvent.DEAL_COMPLETED]: false
      }
    });
    
    // Try to send a deal completed notification (should be filtered out)
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.DEAL_COMPLETED,
      {
        productName: 'Test Product (Should be filtered)',
        savings: 50.00
      }
    );
    
    if (!notificationId) {
      console.log('✅ Notification correctly filtered by preferences');
    } else {
      console.log('❌ Notification should have been filtered');
    }
    
    // Restore original preferences
    await notificationManager.updatePreferences(currentPrefs);
    
    await this.wait(1000);
  }

  /**
   * Test quiet hours functionality
   */
  private static async testQuietHours(): Promise<void> {
    console.log('📢 Testing quiet hours functionality...');
    
    const currentPrefs = notificationManager.getPreferences();
    
    // Set quiet hours to current time (should block notifications)
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const laterTime = `${(now.getHours() + 1) % 24}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    await notificationManager.updatePreferences({
      quietHours: {
        enabled: true,
        start: currentTime,
        end: laterTime
      }
    });
    
    // Try to send notification during quiet hours
    const notificationId = await notificationManager.createNotification(
      NotificationEvent.DEAL_COMPLETED,
      {
        productName: 'Quiet Hours Test Product',
        savings: 25.00
      }
    );
    
    if (!notificationId) {
      console.log('✅ Notification correctly blocked by quiet hours');
    } else {
      console.log('❌ Notification should have been blocked by quiet hours');
    }
    
    // Restore original preferences
    await notificationManager.updatePreferences(currentPrefs);
    
    await this.wait(1000);
  }

  /**
   * Test rate limiting
   */
  private static async testRateLimiting(): Promise<void> {
    console.log('📢 Testing rate limiting...');
    
    const currentPrefs = notificationManager.getPreferences();
    
    // Set very low rate limit
    await notificationManager.updatePreferences({
      maxNotificationsPerHour: 1
    });
    
    // Send first notification (should succeed)
    const firstId = await notificationManager.createNotification(
      NotificationEvent.DEAL_COMPLETED,
      {
        productName: 'Rate Limit Test 1',
        savings: 10.00
      }
    );
    
    // Send second notification (should be blocked by rate limit)
    const secondId = await notificationManager.createNotification(
      NotificationEvent.DEAL_COMPLETED,
      {
        productName: 'Rate Limit Test 2',
        savings: 20.00
      }
    );
    
    if (firstId && !secondId) {
      console.log('✅ Rate limiting working correctly');
    } else {
      console.log('❌ Rate limiting not working as expected');
    }
    
    // Restore original preferences
    await notificationManager.updatePreferences(currentPrefs);
    
    await this.wait(1000);
  }

  /**
   * Test notification history
   */
  static async testNotificationHistory(): Promise<void> {
    console.log('📢 Testing notification history...');
    
    // Get current history
    const history = notificationManager.getNotificationHistory();
    console.log(`Current history has ${history.length} notifications`);
    
    // Send a test notification
    await notificationManager.createNotification(NotificationEvent.DEAL_COMPLETED, {
      productName: 'History Test Product',
      savings: 15.00
    });
    
    // Check updated history
    const updatedHistory = notificationManager.getNotificationHistory();
    
    if (updatedHistory.length > history.length) {
      console.log('✅ Notification history updated correctly');
    } else {
      console.log('❌ Notification history not updated');
    }
    
    // Clear history
    notificationManager.clearNotificationHistory();
    const clearedHistory = notificationManager.getNotificationHistory();
    
    if (clearedHistory.length === 0) {
      console.log('✅ Notification history cleared successfully');
    } else {
      console.log('❌ Notification history not cleared');
    }
  }

  /**
   * Utility method to wait
   */
  private static wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual test trigger for development
   */
  static async runManualTest(eventType: NotificationEvent): Promise<void> {
    console.log(`🧪 Running manual test for ${eventType}...`);
    
    const testContexts = {
      [NotificationEvent.DEAL_COMPLETED]: {
        productName: 'Manual Test Product',
        savings: 99.99,
        currency: '$'
      },
      [NotificationEvent.NEGOTIATION_FAILED]: {
        productName: 'Failed Negotiation Test',
        rounds: 3
      },
      [NotificationEvent.OFFER_RECEIVED]: {
        productName: 'Counter Offer Test',
        sellerName: 'Test Seller'
      },
      [NotificationEvent.USER_ACTION_NEEDED]: {
        productName: 'Action Required Test'
      },
      [NotificationEvent.PRICE_DROP_ALERT]: {
        productName: 'Price Drop Test',
        savings: 25.00
      },
      [NotificationEvent.SYSTEM_ERROR]: {
        errorCode: 'MANUAL_TEST_ERROR'
      },
      [NotificationEvent.NEGOTIATION_STARTED]: {
        productName: 'Started Negotiation Test'
      },
      [NotificationEvent.SESSION_EXPIRED]: {
        productName: 'Expired Session Test'
      }
    };
    
    const context = testContexts[eventType] || {};
    const notificationId = await notificationManager.createNotification(eventType, context);
    
    if (notificationId) {
      console.log(`✅ Manual test notification sent: ${notificationId}`);
    } else {
      console.log('⚠️ Manual test notification was filtered out');
    }
  }
}

// Export for console access during development
(globalThis as any).NotificationTester = NotificationTester;