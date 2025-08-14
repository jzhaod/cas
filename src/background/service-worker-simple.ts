// Simplified Service Worker for Clean Amazon Search

interface StorageData {
  settings?: {
    isEnabled: boolean;
    amazonPreferences: {
      hideSponsored: boolean;
      minRating: number;
      minReviews: number;
      primeOnly: boolean;
      hideOutOfStock: boolean;
    };
  };
  adsBlockingStats?: {
    totalAdsBlocked: number;
    currentPageAdsBlocked: number;
    lastUpdated: string;
  };
}

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Clean Amazon Search extension installed');
  
  // Set default settings
  const defaultSettings: StorageData['settings'] = {
    isEnabled: true,
    amazonPreferences: {
      hideSponsored: true,
      minRating: 0,
      minReviews: 0,
      primeOnly: false,
      hideOutOfStock: false
    }
  };

  const defaultStats: StorageData['adsBlockingStats'] = {
    totalAdsBlocked: 0,
    currentPageAdsBlocked: 0,
    lastUpdated: new Date().toISOString()
  };

  // Check if settings already exist
  const existing = await chrome.storage.sync.get(['settings']);
  if (!existing.settings) {
    await chrome.storage.sync.set({ settings: defaultSettings });
  }

  // Initialize stats if not present
  const existingStats = await chrome.storage.local.get(['adsBlockingStats']);
  if (!existingStats.adsBlockingStats) {
    await chrome.storage.local.set({ adsBlockingStats: defaultStats });
  }
});

// Update badge with blocked ads count
async function updateBadge() {
  const stats = await chrome.storage.local.get(['adsBlockingStats']);
  if (stats.adsBlockingStats) {
    const count = stats.adsBlockingStats.currentPageAdsBlocked;
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'stats_updated':
      updateBadge();
      sendResponse({ success: true });
      break;
      
    case 'get_settings':
      chrome.storage.sync.get(['settings'], (result) => {
        sendResponse(result.settings || {});
      });
      return true; // Will respond asynchronously
      
    case 'page_disable_changed':
      console.log(`Page disable status changed: ${message.disabled}`);
      sendResponse({ success: true });
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
});

// Update badge when tabs are activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Clear badge first
  chrome.action.setBadgeText({ text: '' });
  
  // Try to get stats from the active tab
  try {
    const response = await chrome.tabs.sendMessage(activeInfo.tabId, { type: 'get_ads_stats' });
    if (response?.stats?.currentPageAdsBlocked > 0) {
      chrome.action.setBadgeText({ text: response.stats.currentPageAdsBlocked.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    }
  } catch (error) {
    // Tab might not be an Amazon page, ignore
  }
});

// Export for TypeScript
export {};