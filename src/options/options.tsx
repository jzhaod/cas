import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ExtensionSettings, AmazonPreferences } from '../shared/types';
import NotificationSettings from '../popup/components/NotificationSettings';
import './options.css';

interface Settings extends ExtensionSettings {
  amazonPreferences: AmazonPreferences;
}

const OptionsApp: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    isEnabled: true,
    llmProvider: 'openai',
    llmApiKey: '',
    llmModel: 'gpt-4',
    maxNegotiationRounds: 5,
    autoAcceptThreshold: 15,
    minSavingsTarget: 5,
    notificationsEnabled: true,
    privacyMode: 'limited',
    notificationPreferences: {
      enabled: true,
      soundEnabled: true,
      priority: 1,
      events: {
        deal_completed: true,
        negotiation_failed: true,
        offer_received: true,
        negotiation_started: false,
        price_drop_alert: true,
        session_expired: false,
        user_action_needed: true,
        system_error: true
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      maxNotificationsPerHour: 10,
      showBadges: true
    },
    amazonPreferences: {
      hideSponsored: true,
      primeOnly: false,
      minRating: 0,
      minReviews: 0,
      hideOutOfStock: false,
      preferAmazonShipping: false,
      blockedSellers: []
    }
  });

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'warning', message: string} | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
    
    // Check for navigation hash
    const hash = window.location.hash.slice(1);
    if (hash === 'notifications') {
      setActiveTab('notifications');
    }
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.sync.get(['settings']);
      if (result.settings) {
        setSettings(prev => ({ ...prev, ...result.settings }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setStatusMessage({ type: 'error', message: 'Failed to load settings' });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await chrome.storage.sync.set({ settings });
      setStatusMessage({ type: 'success', message: 'Settings saved successfully!' });
      
      // Notify content scripts about settings change
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id && tab.url?.includes('amazon.com')) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'settings_updated',
              settings
            }).catch(() => {}); // Ignore errors for inactive tabs
          }
        });
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setStatusMessage({ type: 'error', message: 'Failed to save settings' });
    }
    setSaving(false);
  };

  const resetSettings = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      const defaultSettings: Settings = {
        isEnabled: true,
        llmProvider: 'openai',
        llmApiKey: '',
        llmModel: 'gpt-4',
        maxNegotiationRounds: 5,
        autoAcceptThreshold: 15,
        minSavingsTarget: 5,
        notificationsEnabled: true,
        privacyMode: 'limited',
        notificationPreferences: {
          enabled: true,
          soundEnabled: true,
          priority: 1,
          events: {
            deal_completed: true,
            negotiation_failed: true,
            offer_received: true,
            negotiation_started: false,
            price_drop_alert: true,
            session_expired: false,
            user_action_needed: true,
            system_error: true
          },
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          },
          maxNotificationsPerHour: 10,
          showBadges: true
        },
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
      setSettings(defaultSettings);
      setStatusMessage({ type: 'warning', message: 'Settings reset to defaults. Click Save to apply.' });
    }
  };

  const updateSetting = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setStatusMessage(null);
  };

  const updateAmazonPreference = (key: keyof AmazonPreferences, value: any) => {
    setSettings(prev => ({
      ...prev,
      amazonPreferences: {
        ...prev.amazonPreferences,
        [key]: value
      }
    }));
    setStatusMessage(null);
  };

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>AI Shopping Assistant Settings</h1>
        <p>Configure your AI negotiation preferences and Amazon filters</p>
      </header>
      
      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="options-nav">
        <button 
          className={`nav-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          ⚙️ General
        </button>
        <button 
          className={`nav-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          🤖 AI Config
        </button>
        <button 
          className={`nav-tab ${activeTab === 'negotiation' ? 'active' : ''}`}
          onClick={() => setActiveTab('negotiation')}
        >
          🤝 Negotiation
        </button>
        <button 
          className={`nav-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Notifications
        </button>
        <button 
          className={`nav-tab ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          🔍 Amazon Filters
        </button>
      </nav>

      <main className="options-main">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="settings-card">
          <h2>General Settings</h2>
          <p>Control the basic functionality of your AI shopping assistant</p>
          
          <div className="form-group">
            <div className="toggle-group">
              <label className="form-label">Enable AI Assistant</label>
              <div 
                className={`toggle-switch ${settings.isEnabled ? 'active' : ''}`}
                onClick={() => updateSetting('isEnabled', !settings.isEnabled)}
              >
                <div className="toggle-slider"></div>
              </div>
            </div>
            <div className="help-text">
              Toggle the entire extension on/off
            </div>
          </div>

          <div className="form-group">
            <div className="toggle-group">
              <label className="form-label">Enable Notifications</label>
              <div 
                className={`toggle-switch ${settings.notificationsEnabled ? 'active' : ''}`}
                onClick={() => updateSetting('notificationsEnabled', !settings.notificationsEnabled)}
              >
                <div className="toggle-slider"></div>
              </div>
            </div>
            <div className="help-text">
              Show notifications for deal updates and completions
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Privacy Mode</label>
            <select 
              className="form-select"
              value={settings.privacyMode}
              onChange={(e) => updateSetting('privacyMode', e.target.value)}
            >
              <option value="full">Full - Share browsing data for better deals</option>
              <option value="limited">Limited - Share minimal data (recommended)</option>
              <option value="minimal">Minimal - Local processing only</option>
            </select>
            <div className="help-text">
              Control how much data is shared with the negotiation system
            </div>
          </div>
        </div>
        )}

        {/* AI Configuration */}
        {activeTab === 'ai' && (
          <div className="settings-card">
          <h2>AI Configuration</h2>
          <p>Configure your AI negotiation agent</p>
          
          <div className="form-group">
            <label className="form-label">LLM Provider</label>
            <select 
              className="form-select"
              value={settings.llmProvider}
              onChange={(e) => updateSetting('llmProvider', e.target.value)}
            >
              <option value="openai">OpenAI (GPT-4)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="local">Local Model</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <div className="api-key-group">
              <input 
                type={showApiKey ? 'text' : 'password'}
                className="form-input"
                value={settings.llmApiKey}
                onChange={(e) => updateSetting('llmApiKey', e.target.value)}
                placeholder="Enter your API key"
              />
              <button 
                type="button"
                className="api-key-toggle"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="help-text">
              Your API key is stored locally and never shared
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Model</label>
            <select 
              className="form-select"
              value={settings.llmModel}
              onChange={(e) => updateSetting('llmModel', e.target.value)}
            >
              {settings.llmProvider === 'openai' && (
                <>
                  <option value="gpt-4">GPT-4 (Recommended)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </>
              )}
              {settings.llmProvider === 'anthropic' && (
                <>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                </>
              )}
              {settings.llmProvider === 'local' && (
                <option value="local">Local Model</option>
              )}
            </select>
          </div>
        </div>
        )}

        {/* Negotiation Settings */}
        {activeTab === 'negotiation' && (
          <div className="settings-card">
          <h2>Negotiation Settings</h2>
          <p>Control how your AI agent negotiates deals</p>
          
          <div className="form-group">
            <label className="form-label">Max Negotiation Rounds</label>
            <div className="range-group">
              <input 
                type="range"
                className="form-range"
                min="1"
                max="10"
                value={settings.maxNegotiationRounds}
                onChange={(e) => updateSetting('maxNegotiationRounds', parseInt(e.target.value))}
              />
              <div className="range-value">{settings.maxNegotiationRounds}</div>
            </div>
            <div className="help-text">
              Maximum back-and-forth rounds before giving up
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Auto-Accept Threshold (%)</label>
            <div className="range-group">
              <input 
                type="range"
                className="form-range"
                min="5"
                max="50"
                value={settings.autoAcceptThreshold}
                onChange={(e) => updateSetting('autoAcceptThreshold', parseInt(e.target.value))}
              />
              <div className="range-value">{settings.autoAcceptThreshold}%</div>
            </div>
            <div className="help-text">
              Automatically accept deals with savings above this threshold
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Minimum Savings Target ($)</label>
            <div className="range-group">
              <input 
                type="range"
                className="form-range"
                min="1"
                max="100"
                value={settings.minSavingsTarget}
                onChange={(e) => updateSetting('minSavingsTarget', parseInt(e.target.value))}
              />
              <div className="range-value">${settings.minSavingsTarget}</div>
            </div>
            <div className="help-text">
              Don't bother negotiating for savings below this amount
            </div>
          </div>
        </div>
        )}

        {/* Notification Settings */}
        {activeTab === 'notifications' && (
          <div className="settings-card">
            <NotificationSettings />
          </div>
        )}

        {/* Amazon Filters */}
        {activeTab === 'filters' && (
          <div className="settings-card full-width">
          <h2>Amazon Search Filters</h2>
          <p>Customize your Amazon browsing experience with intelligent filters</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div>
              <div className="checkbox-group">
                <input 
                  type="checkbox"
                  id="hideSponsored"
                  className="form-checkbox"
                  checked={settings.amazonPreferences.hideSponsored}
                  onChange={(e) => updateAmazonPreference('hideSponsored', e.target.checked)}
                />
                <label htmlFor="hideSponsored" className="checkbox-label">
                  Hide Sponsored Results
                </label>
              </div>

              <div className="checkbox-group">
                <input 
                  type="checkbox"
                  id="primeOnly"
                  className="form-checkbox"
                  checked={settings.amazonPreferences.primeOnly}
                  onChange={(e) => updateAmazonPreference('primeOnly', e.target.checked)}
                />
                <label htmlFor="primeOnly" className="checkbox-label">
                  Prime Eligible Only
                </label>
              </div>

              <div className="checkbox-group">
                <input 
                  type="checkbox"
                  id="hideOutOfStock"
                  className="form-checkbox"
                  checked={settings.amazonPreferences.hideOutOfStock}
                  onChange={(e) => updateAmazonPreference('hideOutOfStock', e.target.checked)}
                />
                <label htmlFor="hideOutOfStock" className="checkbox-label">
                  Hide Out of Stock Items
                </label>
              </div>

              <div className="checkbox-group">
                <input 
                  type="checkbox"
                  id="preferAmazonShipping"
                  className="form-checkbox"
                  checked={settings.amazonPreferences.preferAmazonShipping}
                  onChange={(e) => updateAmazonPreference('preferAmazonShipping', e.target.checked)}
                />
                <label htmlFor="preferAmazonShipping" className="checkbox-label">
                  Prefer Amazon Shipping
                </label>
              </div>
            </div>

            <div>
              <div className="form-group">
                <label className="form-label">Minimum Rating</label>
                <div className="range-group">
                  <input 
                    type="range"
                    className="form-range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={settings.amazonPreferences.minRating}
                    onChange={(e) => updateAmazonPreference('minRating', parseFloat(e.target.value))}
                  />
                  <div className="range-value">{settings.amazonPreferences.minRating > 0 ? `${settings.amazonPreferences.minRating}★` : 'Any'}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Minimum Reviews</label>
                <div className="range-group">
                  <input 
                    type="range"
                    className="form-range"
                    min="0"
                    max="100"
                    step="10"
                    value={settings.amazonPreferences.minReviews}
                    onChange={(e) => updateAmazonPreference('minReviews', parseInt(e.target.value))}
                  />
                  <div className="range-value">{settings.amazonPreferences.minReviews || 'Any'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </main>

      {/* Action Bar */}
      <div className="settings-card action-bar-container">
        <div className="action-bar">
          <button 
            className="btn btn-secondary"
            onClick={resetSettings}
          >
            Reset to Defaults
          </button>
          <button 
            className="btn btn-primary"
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="spinner"></div>
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Initialize React app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<OptionsApp />);