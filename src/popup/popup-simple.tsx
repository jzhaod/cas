import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './popup-simple.scss';

interface FilterSettings {
  isEnabled: boolean;
  hideSponsored: boolean;
  minRating: number;
  minReviews: number;
  primeOnly: boolean;
  hideOutOfStock: boolean;
}

interface FilterStats {
  totalAdsBlocked: number;
  currentPageAdsBlocked: number;
}

const PopupSimple: React.FC = () => {
  const [settings, setSettings] = useState<FilterSettings>({
    isEnabled: true,
    hideSponsored: true,
    minRating: 0,
    minReviews: 0,
    primeOnly: false,
    hideOutOfStock: false
  });

  const [stats, setStats] = useState<FilterStats>({
    totalAdsBlocked: 0,
    currentPageAdsBlocked: 0
  });

  const [pageDisabled, setPageDisabled] = useState(false);

  useEffect(() => {
    // Load settings from storage
    chrome.storage.sync.get(['settings'], (result) => {
      if (result.settings?.amazonPreferences) {
        setSettings({
          isEnabled: result.settings.isEnabled ?? true,
          ...result.settings.amazonPreferences
        });
      }
    });

    // Load stats
    chrome.storage.local.get(['adsBlockingStats'], (result) => {
      if (result.adsBlockingStats) {
        setStats(result.adsBlockingStats);
      }
    });

    // Check if current page is disabled
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'get_page_status' }, (response) => {
          if (response?.pageDisabled) {
            setPageDisabled(true);
          }
        });
      }
    });
  }, []);

  const updateSetting = async (key: keyof FilterSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save to storage
    const storageSettings = {
      isEnabled: newSettings.isEnabled,
      amazonPreferences: {
        hideSponsored: newSettings.hideSponsored,
        minRating: newSettings.minRating,
        minReviews: newSettings.minReviews,
        primeOnly: newSettings.primeOnly,
        hideOutOfStock: newSettings.hideOutOfStock,
        preferAmazonShipping: false,
        blockedSellers: []
      }
    };

    await chrome.storage.sync.set({ settings: storageSettings });

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        // Send all settings update
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'settings_updated',
          settings: storageSettings
        });
      }
    });
  };

  const togglePageDisable = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'toggle_page_disable' }, (response) => {
          if (response?.success) {
            setPageDisabled(response.disabled);
          }
        });
      }
    });
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Clean Amazon Search</h1>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={settings.isEnabled}
            onChange={(e) => updateSetting('isEnabled', e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </header>

      <div className="stats-section">
        <div className="stat-item">
          <span className="stat-value">{stats.totalAdsBlocked}</span>
          <span className="stat-label">Total Ads Blocked</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.currentPageAdsBlocked}</span>
          <span className="stat-label">This Page</span>
        </div>
      </div>

      <div className="filters-section">
        <h2>Filters</h2>
        
        <div className="filter-item">
          <label>
            <input
              type="checkbox"
              checked={settings.hideSponsored}
              onChange={(e) => updateSetting('hideSponsored', e.target.checked)}
            />
            <span>Hide Sponsored Products</span>
          </label>
        </div>

        <div className="filter-item">
          <label>
            <input
              type="checkbox"
              checked={settings.primeOnly}
              onChange={(e) => updateSetting('primeOnly', e.target.checked)}
            />
            <span>Prime Only</span>
          </label>
        </div>

        <div className="filter-item">
          <label>
            <input
              type="checkbox"
              checked={settings.hideOutOfStock}
              onChange={(e) => updateSetting('hideOutOfStock', e.target.checked)}
            />
            <span>Hide Out of Stock</span>
          </label>
        </div>

        <div className="filter-item slider-item">
          <label>
            <span>Min Rating: {settings.minRating > 0 ? `${settings.minRating}★` : 'Any'}</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={settings.minRating}
              onChange={(e) => updateSetting('minRating', parseFloat(e.target.value))}
            />
          </label>
        </div>

        <div className="filter-item slider-item">
          <label>
            <span>Min Reviews: {settings.minReviews > 0 ? settings.minReviews : 'Any'}</span>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={settings.minReviews}
              onChange={(e) => updateSetting('minReviews', parseInt(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="page-controls">
        <button 
          className={`page-disable-btn ${pageDisabled ? 'disabled' : ''}`}
          onClick={togglePageDisable}
        >
          {pageDisabled ? 'Enable on This Page' : 'Disable on This Page'}
        </button>
      </div>
    </div>
  );
};

// Mount the component when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    ReactDOM.createRoot(root).render(<PopupSimple />);
  } else {
    console.error('Root element not found');
  }
});

export default PopupSimple;