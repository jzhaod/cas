/**
 * Notification Settings Component
 * Allows users to configure notification preferences
 */

import React, { useState, useEffect } from 'react';
import { NotificationPreferences, NotificationEvent } from '../../shared/types';

interface NotificationSettingsProps {
  onClose?: () => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
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
  });

  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    loadPreferences();
    checkNotificationPermission();
  }, []);

  /**
   * Load preferences from storage
   */
  const loadPreferences = async () => {
    try {
      const result = await chrome.storage.sync.get('notificationPreferences');
      if (result.notificationPreferences) {
        setPreferences(result.notificationPreferences);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  /**
   * Check if we have notification permission
   */
  const checkNotificationPermission = async () => {
    try {
      const permission = await chrome.notifications.getPermissionLevel();
      setHasPermission(permission === 'granted');
    } catch (error) {
      console.error('Failed to check notification permission:', error);
    }
  };

  /**
   * Request notification permission
   */
  const requestPermission = async () => {
    try {
      // Chrome extensions don't need to request notification permission
      // It's granted automatically if declared in manifest
      await checkNotificationPermission();
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  };

  /**
   * Update preferences
   */
  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    
    try {
      await chrome.storage.sync.set({ notificationPreferences: newPreferences });
      
      // Notify background script of preference change
      chrome.runtime.sendMessage({
        type: 'NOTIFICATION_PREFERENCES_UPDATED',
        preferences: newPreferences
      });
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  };

  /**
   * Update event preference
   */
  const updateEventPreference = (event: NotificationEvent, enabled: boolean) => {
    updatePreferences({
      events: {
        ...preferences.events,
        [event]: enabled
      }
    });
  };

  /**
   * Update quiet hours
   */
  const updateQuietHours = (field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    updatePreferences({
      quietHours: {
        ...preferences.quietHours,
        [field]: value
      }
    });
  };

  /**
   * Test notification
   */
  const testNotification = async () => {
    chrome.runtime.sendMessage({
      type: 'TEST_NOTIFICATION',
      event: NotificationEvent.DEAL_COMPLETED,
      context: {
        productName: 'Sample Product',
        savings: 25.99,
        currency: '$'
      }
    });
  };

  const eventLabels: Record<NotificationEvent, string> = {
    [NotificationEvent.DEAL_COMPLETED]: 'Deal completed successfully',
    [NotificationEvent.NEGOTIATION_FAILED]: 'Negotiation failed',
    [NotificationEvent.OFFER_RECEIVED]: 'New offer received',
    [NotificationEvent.NEGOTIATION_STARTED]: 'Negotiation started',
    [NotificationEvent.PRICE_DROP_ALERT]: 'Price drop alerts',
    [NotificationEvent.SESSION_EXPIRED]: 'Session expired',
    [NotificationEvent.USER_ACTION_NEEDED]: 'Action required',
    [NotificationEvent.SYSTEM_ERROR]: 'System errors'
  };

  const eventDescriptions: Record<NotificationEvent, string> = {
    [NotificationEvent.DEAL_COMPLETED]: 'When a deal is successfully negotiated',
    [NotificationEvent.NEGOTIATION_FAILED]: 'When negotiation ends without agreement',
    [NotificationEvent.OFFER_RECEIVED]: 'When seller makes a counter-offer',
    [NotificationEvent.NEGOTIATION_STARTED]: 'When AI starts negotiating',
    [NotificationEvent.PRICE_DROP_ALERT]: 'When prices drop on watched items',
    [NotificationEvent.SESSION_EXPIRED]: 'When negotiation sessions expire',
    [NotificationEvent.USER_ACTION_NEEDED]: 'When your approval is required',
    [NotificationEvent.SYSTEM_ERROR]: 'When errors occur'
  };

  if (!hasPermission) {
    return (
      <div className="notification-settings">
        <div className="permission-required">
          <h3>🔔 Notification Permission Required</h3>
          <p>Enable notifications to get real-time updates about your deals and negotiations.</p>
          <button onClick={requestPermission} className="btn btn-primary">
            Enable Notifications
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-settings">
      <div className="settings-header">
        <h2>🔔 Notification Settings</h2>
        {onClose && (
          <button onClick={onClose} className="btn btn-ghost">×</button>
        )}
      </div>

      {/* Master Toggle */}
      <div className="setting-group">
        <div className="setting-item master-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={preferences.enabled}
              onChange={(e) => updatePreferences({ enabled: e.target.checked })}
            />
            <span className="toggle-switch"></span>
            <span className="toggle-text">
              <strong>Enable Notifications</strong>
              <small>Get notified about deals and negotiations</small>
            </span>
          </label>
        </div>
      </div>

      {preferences.enabled && (
        <>
          {/* General Settings */}
          <div className="setting-group">
            <h3>General</h3>
            
            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={preferences.soundEnabled}
                  onChange={(e) => updatePreferences({ soundEnabled: e.target.checked })}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Sound notifications</span>
              </label>
            </div>

            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={preferences.showBadges}
                  onChange={(e) => updatePreferences({ showBadges: e.target.checked })}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Show badge on extension icon</span>
              </label>
            </div>

            <div className="setting-item">
              <label>
                Priority Level:
                <select
                  value={preferences.priority}
                  onChange={(e) => updatePreferences({ priority: parseInt(e.target.value) as 0 | 1 | 2 })}
                  className="select-input"
                >
                  <option value={0}>Low</option>
                  <option value={1}>Normal</option>
                  <option value={2}>High</option>
                </select>
              </label>
            </div>

            <div className="setting-item">
              <label>
                Max notifications per hour:
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={preferences.maxNotificationsPerHour}
                  onChange={(e) => updatePreferences({ maxNotificationsPerHour: parseInt(e.target.value) })}
                  className="number-input"
                />
              </label>
            </div>
          </div>

          {/* Event Settings */}
          <div className="setting-group">
            <h3>Notification Types</h3>
            <p className="setting-description">Choose which events you want to be notified about:</p>
            
            {Object.entries(preferences.events).map(([event, enabled]) => (
              <div key={event} className="setting-item event-setting">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => updateEventPreference(event as NotificationEvent, e.target.checked)}
                  />
                  <span className="toggle-switch"></span>
                  <span className="toggle-text">
                    <strong>{eventLabels[event as NotificationEvent]}</strong>
                    <small>{eventDescriptions[event as NotificationEvent]}</small>
                  </span>
                </label>
              </div>
            ))}
          </div>

          {/* Quiet Hours */}
          <div className="setting-group">
            <h3>Quiet Hours</h3>
            <p className="setting-description">Disable notifications during specific hours:</p>
            
            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={preferences.quietHours.enabled}
                  onChange={(e) => updateQuietHours('enabled', e.target.checked)}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Enable quiet hours</span>
              </label>
            </div>

            {preferences.quietHours.enabled && (
              <div className="quiet-hours-config">
                <div className="time-range">
                  <label>
                    From:
                    <input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) => updateQuietHours('start', e.target.value)}
                      className="time-input"
                    />
                  </label>
                  <label>
                    To:
                    <input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) => updateQuietHours('end', e.target.value)}
                      className="time-input"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Test Button */}
          <div className="setting-group">
            <button onClick={testNotification} className="btn btn-secondary">
              🔔 Test Notification
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .notification-settings {
          padding: 20px;
          max-width: 400px;
          color: #333;
        }

        .settings-header {
          display: flex;
          justify-content: between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #eee;
          padding-bottom: 15px;
        }

        .settings-header h2 {
          margin: 0;
          font-size: 18px;
          color: #2563eb;
        }

        .permission-required {
          text-align: center;
          padding: 40px 20px;
        }

        .permission-required h3 {
          color: #f59e0b;
          margin-bottom: 10px;
        }

        .setting-group {
          margin-bottom: 25px;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 20px;
        }

        .setting-group:last-child {
          border-bottom: none;
        }

        .setting-group h3 {
          margin: 0 0 15px 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .setting-description {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 15px;
        }

        .setting-item {
          margin-bottom: 12px;
        }

        .master-toggle .toggle-text strong {
          font-size: 16px;
          color: #1f2937;
        }

        .toggle-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          background-color: #d1d5db;
          border-radius: 12px;
          transition: background-color 0.2s;
          flex-shrink: 0;
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: white;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
        }

        input[type="checkbox"]:checked + .toggle-switch {
          background-color: #3b82f6;
        }

        input[type="checkbox"]:checked + .toggle-switch::after {
          transform: translateX(20px);
        }

        input[type="checkbox"] {
          display: none;
        }

        .toggle-text {
          flex: 1;
        }

        .toggle-text strong {
          display: block;
          font-size: 14px;
          color: #374151;
          margin-bottom: 2px;
        }

        .toggle-text small {
          display: block;
          font-size: 12px;
          color: #6b7280;
        }

        .event-setting {
          padding: 8px 0;
          border-bottom: 1px solid #f9fafb;
        }

        .event-setting:last-child {
          border-bottom: none;
        }

        .select-input, .number-input, .time-input {
          margin-left: 10px;
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
        }

        .number-input {
          width: 70px;
        }

        .time-input {
          width: 100px;
        }

        .quiet-hours-config {
          margin-top: 15px;
          padding: 15px;
          background-color: #f9fafb;
          border-radius: 8px;
        }

        .time-range {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .time-range label {
          font-size: 13px;
          color: #374151;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background-color: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background-color: #2563eb;
        }

        .btn-secondary {
          background-color: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background-color: #e5e7eb;
        }

        .btn-ghost {
          background: none;
          color: #6b7280;
          font-size: 18px;
          padding: 5px 8px;
        }

        .btn-ghost:hover {
          background-color: #f3f4f6;
        }
      `}</style>
    </div>
  );
};

export default NotificationSettings;