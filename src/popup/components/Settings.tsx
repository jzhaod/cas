import React, { useState, useEffect } from 'react';

interface SettingsData {
  aiProvider: 'openai' | 'anthropic' | 'local';
  maxNegotiationRounds: number;
  autoAcceptThreshold: number;
  privacyMode: boolean;
  enableNotifications: boolean;
  dataRetentionDays: number;
  // Amazon Search Enhancement
  amazonPreferences: {
    hideSponsored: boolean;
    primeOnly: boolean;
    minRating: number;
    minReviews: number;
    hideOutOfStock: boolean;
    preferAmazonShipping: boolean;
    blockedSellers: string[];
  };
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>({
    aiProvider: 'openai',
    maxNegotiationRounds: 5,
    autoAcceptThreshold: 10,
    privacyMode: true,
    enableNotifications: true,
    dataRetentionDays: 7,
    amazonPreferences: {
      hideSponsored: true,
      primeOnly: false,
      minRating: 3,
      minReviews: 0,
      hideOutOfStock: false,
      preferAmazonShipping: false,
      blockedSellers: []
    }
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load settings from storage
    chrome.storage.sync.get(['settings'], (result) => {
      if (result.settings) {
        setSettings(result.settings);
      }
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await chrome.storage.sync.set({ settings });
      
      // Notify background script of settings change
      chrome.runtime.sendMessage({
        type: 'settings_updated',
        settings
      });

      // Show success feedback (in a real app, you'd show a toast or similar)
      setTimeout(() => setIsSaving(false), 500);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateAmazonPreference = <K extends keyof SettingsData['amazonPreferences']>(
    key: K,
    value: SettingsData['amazonPreferences'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      amazonPreferences: {
        ...prev.amazonPreferences,
        [key]: value
      }
    }));
  };

  return (
    <div className="settings-container">
      <div className="settings-section">
        <h3>AI Configuration</h3>
        
        <div className="setting-group">
          <label htmlFor="ai-provider">AI Provider</label>
          <select
            id="ai-provider"
            value={settings.aiProvider}
            onChange={(e) => updateSetting('aiProvider', e.target.value as any)}
          >
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="local">Local Model</option>
          </select>
          <small>Choose your preferred AI provider for negotiations</small>
        </div>

        <div className="setting-group">
          <label htmlFor="max-rounds">Max Negotiation Rounds</label>
          <input
            id="max-rounds"
            type="range"
            min="1"
            max="10"
            value={settings.maxNegotiationRounds}
            onChange={(e) => updateSetting('maxNegotiationRounds', parseInt(e.target.value))}
          />
          <span className="range-value">{settings.maxNegotiationRounds} rounds</span>
          <small>Maximum number of back-and-forth negotiations</small>
        </div>
      </div>

      <div className="settings-section">
        <h3>Automation</h3>
        
        <div className="setting-group">
          <label htmlFor="auto-accept">Auto-accept threshold</label>
          <input
            id="auto-accept"
            type="range"
            min="0"
            max="50"
            value={settings.autoAcceptThreshold}
            onChange={(e) => updateSetting('autoAcceptThreshold', parseInt(e.target.value))}
          />
          <span className="range-value">{settings.autoAcceptThreshold}% savings</span>
          <small>Automatically accept deals above this savings percentage</small>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={(e) => updateSetting('enableNotifications', e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            Enable notifications
          </label>
          <small>Get notified when negotiations complete</small>
        </div>

        <div className="setting-group">
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#notifications') })}
            className="notification-settings-button"
          >
            🔔 Notification Settings
          </button>
          <small>Configure detailed notification preferences</small>
        </div>
      </div>

      <div className="settings-section">
        <h3>Amazon Search Enhancement</h3>
        
        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.amazonPreferences.hideSponsored}
              onChange={(e) => updateAmazonPreference('hideSponsored', e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            Hide sponsored products & ads
          </label>
          <small>Remove promotional listings for cleaner search results</small>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.amazonPreferences.primeOnly}
              onChange={(e) => updateAmazonPreference('primeOnly', e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            Prime products only
          </label>
          <small>Show only Prime-eligible items with free shipping</small>
        </div>

        <div className="setting-group">
          <label htmlFor="min-rating">Minimum star rating</label>
          <select
            id="min-rating"
            value={settings.amazonPreferences.minRating}
            onChange={(e) => updateAmazonPreference('minRating', parseFloat(e.target.value))}
          >
            <option value="0">Any rating</option>
            <option value="3">3+ stars</option>
            <option value="3.5">3.5+ stars</option>
            <option value="4">4+ stars</option>
            <option value="4.5">4.5+ stars</option>
          </select>
          <small>Hide products below this rating</small>
        </div>

        <div className="setting-group">
          <label htmlFor="min-reviews">Minimum reviews</label>
          <select
            id="min-reviews"
            value={settings.amazonPreferences.minReviews}
            onChange={(e) => updateAmazonPreference('minReviews', parseInt(e.target.value))}
          >
            <option value="0">Any number</option>
            <option value="10">10+ reviews</option>
            <option value="50">50+ reviews</option>
            <option value="100">100+ reviews</option>
            <option value="500">500+ reviews</option>
          </select>
          <small>Hide products with fewer reviews</small>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.amazonPreferences.hideOutOfStock}
              onChange={(e) => updateAmazonPreference('hideOutOfStock', e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            Hide out of stock items
          </label>
          <small>Show only available products</small>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.amazonPreferences.preferAmazonShipping}
              onChange={(e) => updateAmazonPreference('preferAmazonShipping', e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            Prefer Amazon fulfillment
          </label>
          <small>Prioritize items shipped by Amazon</small>
        </div>
      </div>

      <div className="settings-section">
        <h3>Privacy & Data</h3>
        
        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.privacyMode}
              onChange={(e) => updateSetting('privacyMode', e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            Enhanced privacy mode
          </label>
          <small>Minimize data collection and processing</small>
        </div>

        <div className="setting-group">
          <label htmlFor="retention">Data retention period</label>
          <select
            id="retention"
            value={settings.dataRetentionDays}
            onChange={(e) => updateSetting('dataRetentionDays', parseInt(e.target.value))}
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
          <small>How long to keep negotiation data</small>
        </div>
      </div>

      <div className="settings-actions">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`save-button ${isSaving ? 'saving' : ''}`}
        >
          {isSaving ? (
            <>
              <span className="spinner"></span>
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
        
        <button
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') })}
          className="advanced-button"
        >
          Advanced Settings
        </button>
      </div>
    </div>
  );
};