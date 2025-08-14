// Amazon Search Filter - Removes ads and applies user preferences
import { AmazonPreferences, AdsBlockingStats, PageDisableSettings } from '../shared/types';

interface FilterStats {
  totalItems: number;
  hiddenSponsored: number;
  hiddenLowRating: number;
  hiddenOutOfStock: number;
  hiddenNonPrime: number;
  hiddenLowReviews: number;
}

class AmazonFilter {
  private preferences: AmazonPreferences | null = null;
  private isEnabled: boolean = true;
  private isPageDisabled: boolean = false;
  private observer: MutationObserver | undefined;
  private currentUrl: string = '';
  private filterStats: FilterStats = {
    totalItems: 0,
    hiddenSponsored: 0,
    hiddenLowRating: 0,
    hiddenOutOfStock: 0,
    hiddenNonPrime: 0,
    hiddenLowReviews: 0
  };
  private adsStats: AdsBlockingStats = {
    totalAdsBlocked: 0,
    currentPageAdsBlocked: 0,
    lastUpdated: new Date()
  };

  constructor() {
    this.initialize();
  }

  private async initialize() {
    console.log('🔧 Amazon Filter: Initializing content filters');
    
    this.currentUrl = this.getCurrentPageKey();
    
    // Load preferences and stats from storage
    await this.loadPreferences();
    await this.loadAdsStats();
    await this.checkPageDisableStatus();
    
    // Listen for preference updates
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings?.newValue?.amazonPreferences) {
        this.preferences = changes.settings.newValue.amazonPreferences;
        this.applyFilters();
      }
    });

    // Listen for extension messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'toggle_enabled':
          this.isEnabled = message.enabled;
          if (this.isEnabled && !this.isPageDisabled) {
            this.applyFilters();
          } else {
            this.removeFilters();
          }
          sendResponse({ success: true });
          return true; // Indicates async response
          
        case 'settings_updated':
          if (message.settings?.amazonPreferences) {
            this.preferences = message.settings.amazonPreferences;
            this.isEnabled = message.settings.isEnabled ?? true;
            if (this.isEnabled && !this.isPageDisabled) {
              this.applyFilters();
            } else {
              this.removeFilters();
            }
          }
          sendResponse({ success: true });
          return true; // Indicates async response
          
        case 'toggle_page_disable':
          this.togglePageDisable();
          sendResponse({ success: true, disabled: this.isPageDisabled });
          return true; // Indicates async response
          
        case 'get_ads_stats':
          sendResponse({
            success: true,
            stats: {
              ...this.adsStats,
              currentPageAdsBlocked: this.filterStats.hiddenSponsored
            }
          });
          return true; // Indicates async response
          
        case 'get_page_status':
          sendResponse({
            success: true,
            pageDisabled: this.isPageDisabled,
            url: this.currentUrl
          });
          return true; // Indicates async response
      }
      return false;
    });

    // Start filtering if on search results page and not disabled
    if (this.isSearchResultsPage() && !this.isPageDisabled) {
      this.startFiltering();
    }
  }

  private async loadPreferences() {
    const result = await chrome.storage.sync.get(['settings']);
    if (result.settings?.amazonPreferences) {
      this.preferences = result.settings.amazonPreferences;
    } else {
      // Default preferences
      this.preferences = {
        hideSponsored: true,
        primeOnly: false,
        minRating: 0,
        minReviews: 0,
        hideOutOfStock: false,
        preferAmazonShipping: false,
        blockedSellers: []
      };
    }
  }

  private isSearchResultsPage(): boolean {
    return window.location.href.includes('/s?') || 
           window.location.href.includes('/s/') ||
           document.querySelector('[data-component-type="s-search-result"]') !== null;
  }

  private startFiltering() {
    // Apply initial filters
    this.applyFilters();

    // Watch for dynamic content changes
    this.observer = new MutationObserver((mutations) => {
      let shouldFilter = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if new search results were added
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.matches('[data-component-type="s-search-result"]') ||
                  element.querySelector('[data-component-type="s-search-result"]')) {
                shouldFilter = true;
              }
            }
          });
        }
      });

      if (shouldFilter) {
        // Debounce filtering to avoid excessive processing
        setTimeout(() => {
          this.applyFilters();
          // Also check for disguised ads that might have been added dynamically
          this.filterDisguisedAds();
        }, 100);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private applyFilters() {
    if (!this.isEnabled || !this.preferences || this.isPageDisabled) return;

    // Reset current page stats
    const previousAdsBlocked = this.filterStats.hiddenSponsored;
    this.filterStats = {
      totalItems: 0,
      hiddenSponsored: 0,
      hiddenLowRating: 0,
      hiddenOutOfStock: 0,
      hiddenNonPrime: 0,
      hiddenLowReviews: 0
    };

    // Find all search result items
    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    
    searchResults.forEach((item) => {
      this.filterStats.totalItems++;
      this.processSearchItem(item as HTMLElement);
    });

    // Filter sponsored banners and carousels
    this.filterSponsoredBanners();

    // Also check for disguised ads that might not be caught by other methods
    this.filterDisguisedAds();

    // Update ads stats if we blocked new ads
    if (this.filterStats.hiddenSponsored > previousAdsBlocked) {
      const newAdsBlocked = this.filterStats.hiddenSponsored - previousAdsBlocked;
      this.adsStats.totalAdsBlocked += newAdsBlocked;
      this.adsStats.currentPageAdsBlocked = this.filterStats.hiddenSponsored;
      this.adsStats.lastUpdated = new Date();
      this.saveAdsStats();
    }

    // Update filter stats badge
    this.updateFilterBadge();
  }

  private processSearchItem(item: HTMLElement) {
    if (!this.preferences) return;

    let shouldHide = false;
    let hideReason = '';

    // Check for sponsored content
    if (this.preferences.hideSponsored && this.isSponsoredItem(item)) {
      shouldHide = true;
      hideReason = 'sponsored';
      this.filterStats.hiddenSponsored++;
    }

    // Check Prime eligibility
    if (!shouldHide && this.preferences.primeOnly && !this.isPrimeEligible(item)) {
      shouldHide = true;
      hideReason = 'non-prime';
      this.filterStats.hiddenNonPrime++;
    }

    // Check rating
    if (!shouldHide && this.preferences.minRating > 0) {
      const rating = this.extractRating(item);
      if (rating > 0 && rating < this.preferences.minRating) {
        shouldHide = true;
        hideReason = 'low-rating';
        this.filterStats.hiddenLowRating++;
      }
    }

    // Check review count
    if (!shouldHide && this.preferences.minReviews > 0) {
      const reviewCount = this.extractReviewCount(item);
      if (reviewCount >= 0 && reviewCount < this.preferences.minReviews) {
        shouldHide = true;
        hideReason = 'low-reviews';
        this.filterStats.hiddenLowReviews++;
      }
    }

    // Check availability
    if (!shouldHide && this.preferences.hideOutOfStock && this.isOutOfStock(item)) {
      shouldHide = true;
      hideReason = 'out-of-stock';
      this.filterStats.hiddenOutOfStock++;
    }

    // Apply hiding
    if (shouldHide) {
      item.style.display = 'none';
      item.setAttribute('data-ai-shopping-hidden', hideReason);
    } else {
      // Ensure item is visible (in case it was previously hidden)
      item.style.display = '';
      item.removeAttribute('data-ai-shopping-hidden');
    }
  }

  private filterSponsoredBanners() {
    if (!this.preferences?.hideSponsored) return;

    // Comprehensive selectors for all sponsored content
    const sponsoredBannerSelectors = [
      // Direct sponsored indicators
      '[data-component-type="sp-sponsored-result"]',
      '[data-component-type*="sponsored"]',
      '.s-sponsored-header',
      '.AdHolder',
      '.s-result-item.AdHolder',
      
      // Video and display ads
      '.s-video-ads',
      '[data-component-type="s-ads-video"]',
      '.s-banner-ad',
      '.s-display-ad',
      
      // Sponsored product sections
      '[data-cel-widget*="SPONSORED"]',
      '[data-cel-widget*="sponsored"]',
      '[cel_widget_id*="SPONSORED"]',
      '[cel_widget_id*="sponsored"]',
      
      // Promotional sections
      '[cel_widget_id*="CUSTOMERS_FREQUENTLY_VIEWED"]',
      '[data-cel-widget*="CUSTOMERS_FREQUENTLY_VIEWED"]',
      '[data-component-type="s-shopping-advisor"]',
      '[cel_widget_id*="SHOPPING_ADVISER"]',
      '[cel_widget_id*="MAIN-FEATURED"]',
      '.s-shopping-advisor',
      
      // Brand promotions
      '[aria-label*="Brands related to your search"]',
      '[cel_widget_id*="BRAND_RELATED"]',
      '[aria-label*="Sponsored products related"]',
      
      // List items and results
      '.s-sponsored-list-item',
      '.s-sponsored-result',
      '[aria-label*="Sponsored"]',
      
      // Common ad placements (specific positions)
      '[data-cel-widget="search_result_14"]',
      '[data-cel-widget="search_result_15"]',
      '[data-cel-widget="search_result_16"]',
      
      // Additional sponsored indicators
      '.puis-sponsored-label',
      '.s-label-popover-hover',
      '[data-ad-feedback]',
      '.s-ads-metrics'
    ];

    // Hide all sponsored banners and promotional sections
    sponsoredBannerSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = 'none';
        htmlElement.setAttribute('data-ai-shopping-hidden', 'sponsored-banner');
        this.filterStats.hiddenSponsored++;
        console.log('🚫 Hidden sponsored content:', selector);
      });
    });

    // Find sections by their heading text - be very specific to avoid hiding search UI
    const specificSections = document.querySelectorAll('[data-cel-widget], [aria-label]');
    specificSections.forEach((section) => {
      const htmlElement = section as HTMLElement;
      const text = htmlElement.textContent?.toLowerCase() || '';
      const ariaLabel = htmlElement.getAttribute('aria-label')?.toLowerCase() || '';
      
      // Only hide if it's clearly promotional content AND not part of search interface
      const isPromotionalSection = 
        text.includes('customers frequently viewed') ||
        text.includes('customer frequently viewed') ||
        text.includes('shop') && text.includes('by feature') ||
        text.includes('shop by') ||
        text.includes('brands related to') ||
        ariaLabel.includes('customers frequently viewed') ||
        ariaLabel.includes('shop by feature') ||
        ariaLabel.includes('shop') && ariaLabel.includes('by feature');
      
      // Don't hide search interface elements
      const isSearchInterface = 
        htmlElement.closest('#search') !== null ||
        htmlElement.closest('.s-search-bar') !== null ||
        htmlElement.closest('[role="search"]') !== null ||
        htmlElement.querySelector('input[type="search"]') !== null ||
        htmlElement.querySelector('input[type="text"]') !== null ||
        htmlElement.classList.contains('nav-search-field') ||
        htmlElement.id === 'twotabsearchtextbox' ||
        htmlElement.closest('#nav-search') !== null;
      
      if (isPromotionalSection && !isSearchInterface && !htmlElement.hasAttribute('data-ai-shopping-hidden')) {
        // Make sure we're not hiding a search result or search interface
        if (!htmlElement.querySelector('[data-component-type="s-search-result"]') && !isSearchInterface) {
          htmlElement.style.display = 'none';
          htmlElement.setAttribute('data-ai-shopping-hidden', 'promotional-section');
          this.filterStats.hiddenSponsored++;
          console.log('🚫 Hidden promotional section by text match');
        }
      }
    });

    // Find sponsored content by searching for "Sponsored" text
    this.findSponsoredByText();

    // Check inline items between search results - be very selective
    const searchResultContainer = document.querySelector('.s-result-list, [data-component-type="s-search-results"]');
    if (searchResultContainer) {
      const children = Array.from(searchResultContainer.children);
      
      children.forEach((child) => {
        const htmlElement = child as HTMLElement;
        
        // Skip if it's a search result
        if (htmlElement.getAttribute('data-component-type') === 's-search-result' ||
            htmlElement.querySelector('[data-component-type="s-search-result"]')) {
          return;
        }
        
        // Only hide if it's clearly an ad or sponsored content
        const isAd = 
          htmlElement.classList.contains('AdHolder') ||
          htmlElement.querySelector('.s-sponsored-info-icon') !== null ||
          htmlElement.querySelector('[aria-label*="Sponsored"]') !== null ||
          (htmlElement.getAttribute('class')?.includes('sponsored') ?? false) ||
          (htmlElement.getAttribute('data-component-type')?.includes('sponsored') ?? false);
        
        if (isAd && !htmlElement.hasAttribute('data-ai-shopping-hidden')) {
          htmlElement.style.display = 'none';
          htmlElement.setAttribute('data-ai-shopping-hidden', 'inline-ad');
          this.filterStats.hiddenSponsored++;
          console.log('🚫 Hidden inline ad');
        }
      });
    }
  }

  private filterDisguisedAds() {
    // Target specific disguised ads that look like search results but are sponsored
    const disguisedAdSelectors = [
      '[data-cel-widget="search_result_14"]',
      '[data-cel-widget="search_result_15"]'
    ];

    console.log('🔍 Looking for disguised ads...');
    
    disguisedAdSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`🔍 Found ${elements.length} elements matching ${selector}`);
      
      elements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        console.log('🔍 Element found:', htmlElement.outerHTML.substring(0, 200));
        
        if (!htmlElement.hasAttribute('data-ai-shopping-hidden')) {
          htmlElement.style.display = 'none';
          htmlElement.setAttribute('data-ai-shopping-hidden', 'disguised-ad');
          this.filterStats.hiddenSponsored++;
          console.log('🚫 Hidden disguised ad:', selector);
        } else {
          console.log('🔍 Element already hidden:', selector);
        }
      });
    });

    // Also try to find any element with data-cel-widget containing "search_result_1"
    const allSearchResults = document.querySelectorAll('[data-cel-widget*="search_result_1"]');
    console.log(`🔍 Found ${allSearchResults.length} search_result_1* elements`);
    allSearchResults.forEach((element) => {
      const widget = element.getAttribute('data-cel-widget');
      console.log(`🔍 Found element with data-cel-widget="${widget}"`);
      
      if (widget === 'search_result_14' || widget === 'search_result_15') {
        const htmlElement = element as HTMLElement;
        if (!htmlElement.hasAttribute('data-ai-shopping-hidden')) {
          htmlElement.style.display = 'none';
          htmlElement.setAttribute('data-ai-shopping-hidden', 'disguised-ad');
          this.filterStats.hiddenSponsored++;
          console.log('🚫 Hidden disguised ad via wildcard search:', widget);
        }
      }
    });
  }

  private findSponsoredByText() {
    // Look for elements containing "Sponsored" text that might be ads between Rufus and More Results
    const allElements = document.querySelectorAll('div, span, section, article, aside');
    
    allElements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      
      // Skip if already hidden or is part of search interface
      if (htmlElement.hasAttribute('data-ai-shopping-hidden') || 
          htmlElement.closest('#search') !== null ||
          htmlElement.closest('#nav-search') !== null) {
        return;
      }
      
      // Check if element contains "Sponsored" text
      const textContent = htmlElement.textContent?.trim() || '';
      const hasSponsored = 
        textContent.includes('Sponsored') ||
        htmlElement.querySelector('.s-sponsored-info-icon') !== null ||
        htmlElement.querySelector('[data-component-type*="sponsored"]') !== null;
      
      if (hasSponsored) {
        // Check if it's between content sections (like between Rufus and More Results)
        const parentContainer = htmlElement.closest('.s-main-slot, .s-result-list, [data-component-type="s-search-results"]');
        
        if (parentContainer && 
            !htmlElement.querySelector('[data-component-type="s-search-result"]') && // Not a search result
            !htmlElement.closest('[data-component-type="s-search-result"]')) { // Not inside a search result
          
          // Check if it's a standalone sponsored section
          const isStandaloneSponsoredSection = 
            textContent.toLowerCase().includes('sponsored') &&
            (textContent.length < 500 || // Small sponsored sections
             htmlElement.querySelector('.s-sponsored-info-icon') !== null ||
             htmlElement.classList.toString().includes('sponsored') ||
             htmlElement.getAttribute('data-cel-widget')?.includes('sponsored'));
          
          if (isStandaloneSponsoredSection) {
            htmlElement.style.display = 'none';
            htmlElement.setAttribute('data-ai-shopping-hidden', 'sponsored-text');
            this.filterStats.hiddenSponsored++;
            console.log('🚫 Hidden sponsored content by text search:', textContent.substring(0, 50));
          }
        }
      }
    });
  }

  private isSponsoredItem(item: HTMLElement): boolean {
    // Check for sponsored indicators
    const sponsoredSelectors = [
      '[data-component-type="s-sponsored-result"]',
      '.s-sponsored-info-icon',
      '.puis-sponsored-label-text',
      '.a-color-secondary:contains("Sponsored")',
      '[aria-label*="Sponsored"]',
      '.s-result-item[data-uuid*="sponsored"]'
    ];

    return sponsoredSelectors.some(selector => {
      if (selector.includes(':contains')) {
        // Handle text content check
        return Array.from(item.querySelectorAll('.a-color-secondary')).some(
          el => el.textContent?.toLowerCase().includes('sponsored')
        );
      }
      return item.querySelector(selector) !== null;
    });
  }

  private isPrimeEligible(item: HTMLElement): boolean {
    const primeSelectors = [
      '[aria-label*="Prime"]',
      '.a-icon-prime',
      '.s-prime',
      '.a-color-base:contains("Prime")',
      '[data-cy="prime-badge"]'
    ];

    return primeSelectors.some(selector => {
      if (selector.includes(':contains')) {
        return Array.from(item.querySelectorAll('.a-color-base')).some(
          el => el.textContent?.toLowerCase().includes('prime')
        );
      }
      return item.querySelector(selector) !== null;
    });
  }

  private extractRating(item: HTMLElement): number {
    // Look for rating elements
    const ratingSelectors = [
      '.a-icon-alt',
      '[aria-label*="out of 5 stars"]',
      '.a-star-mini',
      '.s-icon-star'
    ];

    for (const selector of ratingSelectors) {
      const ratingEl = item.querySelector(selector);
      if (ratingEl) {
        const ariaLabel = ratingEl.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/(\d+\.?\d*)\s+out of/);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }

    return 0; // No rating found
  }

  private extractReviewCount(item: HTMLElement): number {
    // Look for review count elements
    const reviewSelectors = [
      '.a-size-small .a-link-normal',
      '.s-underline-text',
      '[aria-label*="ratings"]'
    ];

    for (const selector of reviewSelectors) {
      const reviewEl = item.querySelector(selector);
      if (reviewEl && reviewEl.textContent) {
        // Remove commas and normalize text
        const text = reviewEl.textContent.replace(/,/g, '').toLowerCase();
        
        // Handle different formats: "1,234", "9.5k", "12k", "1.2m"
        const match = text.match(/(\d+\.?\d*)\s*([km])?/);
        if (match) {
          const number = parseFloat(match[1]);
          const suffix = match[2];
          let result: number;
          
          if (suffix === 'k') {
            result = Math.round(number * 1000);
          } else if (suffix === 'm') {
            result = Math.round(number * 1000000);
          } else {
            result = Math.round(number);
          }
          
          // console.log(`📊 Review count parsed: "${reviewEl.textContent}" → ${result}`);
          return result;
        }
      }
    }

    return -1; // No review count found
  }

  private isOutOfStock(item: HTMLElement): boolean {
    const outOfStockIndicators = [
      'Currently unavailable',
      'Out of stock',
      'Temporarily out of stock',
      'In stock soon'
    ];

    const textContent = item.textContent?.toLowerCase() || '';
    return outOfStockIndicators.some(indicator => 
      textContent.includes(indicator.toLowerCase())
    );
  }

  private updateFilterBadge() {
    // Create or update a small badge showing filter stats
    let badge = document.querySelector('.ai-shopping-filter-badge') as HTMLElement;
    
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'ai-shopping-filter-badge';
      badge.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #232f3e;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-family: Arial, sans-serif;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        cursor: pointer;
        transition: all 0.3s ease;
      `;
      
      // Add click handler to toggle details
      badge.addEventListener('click', () => this.toggleFilterDetails());
      document.body.appendChild(badge);
    }

    const totalHidden = this.filterStats.hiddenSponsored + 
                       this.filterStats.hiddenLowRating + 
                       this.filterStats.hiddenOutOfStock + 
                       this.filterStats.hiddenNonPrime + 
                       this.filterStats.hiddenLowReviews;

    badge.textContent = `AI Filter: ${totalHidden} hidden`;
    
    if (totalHidden === 0) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'block';
    }
  }

  private toggleFilterDetails() {
    let details = document.querySelector('.ai-shopping-filter-details') as HTMLElement;
    
    if (!details) {
      details = document.createElement('div');
      details.className = 'ai-shopping-filter-details';
      details.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        font-size: 11px;
        font-family: Arial, sans-serif;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 200px;
      `;
      document.body.appendChild(details);
    }

    if (details.style.display === 'none') {
      details.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">Filter Statistics</div>
        <div>Total items: ${this.filterStats.totalItems}</div>
        <div>Hidden sponsored: ${this.filterStats.hiddenSponsored}</div>
        <div>Hidden low rating: ${this.filterStats.hiddenLowRating}</div>
        <div>Hidden low reviews: ${this.filterStats.hiddenLowReviews}</div>
        <div>Hidden non-Prime: ${this.filterStats.hiddenNonPrime}</div>
        <div>Hidden out of stock: ${this.filterStats.hiddenOutOfStock}</div>
      `;
      details.style.display = 'block';
    } else {
      details.style.display = 'none';
    }
  }

  private removeFilters() {
    // Show all hidden items
    const hiddenItems = document.querySelectorAll('[data-ai-shopping-hidden]');
    hiddenItems.forEach((item) => {
      (item as HTMLElement).style.display = '';
      item.removeAttribute('data-ai-shopping-hidden');
    });

    // Remove filter badge
    const badge = document.querySelector('.ai-shopping-filter-badge');
    const details = document.querySelector('.ai-shopping-filter-details');
    if (badge) badge.remove();
    if (details) details.remove();
  }

  // ============================================================================
  // ADS STATS AND PAGE DISABLE FUNCTIONALITY
  // ============================================================================

  private getCurrentPageKey(): string {
    // Create a stable key for the current page/search
    const url = window.location;
    if (url.pathname.includes('/s')) {
      // For search pages, include the search query
      const params = new URLSearchParams(url.search);
      const query = params.get('k') || params.get('field-keywords') || 'search';
      return `search:${query}`;
    }
    return url.hostname + url.pathname;
  }

  private async loadAdsStats() {
    try {
      const result = await chrome.storage.local.get(['adsBlockingStats']);
      if (result.adsBlockingStats) {
        this.adsStats = {
          ...result.adsBlockingStats,
          lastUpdated: new Date(result.adsBlockingStats.lastUpdated),
          currentPageAdsBlocked: 0 // Reset for new page
        };
      }
    } catch (error) {
      console.error('Failed to load ads stats:', error);
    }
  }

  private async saveAdsStats() {
    try {
      await chrome.storage.local.set({
        adsBlockingStats: {
          ...this.adsStats,
          lastUpdated: this.adsStats.lastUpdated.toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to save ads stats:', error);
    }
  }

  private async checkPageDisableStatus() {
    try {
      const result = await chrome.storage.local.get(['pageDisableSettings']);
      if (result.pageDisableSettings) {
        const pageSettings: PageDisableSettings = result.pageDisableSettings;
        const pageData = pageSettings[this.currentUrl];
        this.isPageDisabled = pageData?.disabled || false;
        
        if (this.isPageDisabled) {
          console.log(`🚫 Ads blocking disabled for page: ${this.currentUrl}`);
        }
      }
    } catch (error) {
      console.error('Failed to check page disable status:', error);
    }
  }

  private async togglePageDisable() {
    try {
      const result = await chrome.storage.local.get(['pageDisableSettings']);
      const pageSettings: PageDisableSettings = result.pageDisableSettings || {};
      
      if (this.isPageDisabled) {
        // Enable ads blocking for this page
        delete pageSettings[this.currentUrl];
        this.isPageDisabled = false;
        console.log(`✅ Ads blocking enabled for page: ${this.currentUrl}`);
        
        // Apply filters immediately
        if (this.isEnabled) {
          this.applyFilters();
        }
      } else {
        // Disable ads blocking for this page
        pageSettings[this.currentUrl] = {
          disabled: true,
          disabledAt: new Date(),
          reason: 'User disabled'
        };
        this.isPageDisabled = true;
        console.log(`🚫 Ads blocking disabled for page: ${this.currentUrl}`);
        
        // Remove existing filters
        this.removeFilters();
      }
      
      await chrome.storage.local.set({ pageDisableSettings: pageSettings });
      
      // Notify popup of status change
      chrome.runtime.sendMessage({
        type: 'page_disable_changed',
        disabled: this.isPageDisabled,
        url: this.currentUrl
      });
      
    } catch (error) {
      console.error('Failed to toggle page disable:', error);
    }
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.removeFilters();
  }
}

// Initialize Amazon Filter
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AmazonFilter();
  });
} else {
  new AmazonFilter();
}