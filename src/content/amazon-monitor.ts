// Amazon content script - monitors user interactions and detects product interest
import { ProductDetector } from './product-detector';
import { UIInjector } from './ui-injector';

interface UserBehavior {
  productId: string;
  dwellTime: number;
  interactions: string[];
  priceChecks: number;
  addToCartAttempts: number;
  wishlistAdds: number;
  timestamp: Date;
}

class AmazonMonitor {
  private productDetector: ProductDetector;
  private uiInjector: UIInjector;
  private currentProduct: string | null = null;
  private startTime: Date | null = null;
  private behavior: Map<string, UserBehavior> = new Map();
  private isEnabled = true;
  private observer: MutationObserver;

  constructor() {
    this.productDetector = new ProductDetector();
    this.uiInjector = new UIInjector();
    
    // Listen for extension state changes
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'toggle_enabled') {
        this.isEnabled = message.enabled;
        if (!this.isEnabled) {
          this.cleanup();
        } else {
          this.initialize();
        }
      }
    });

    this.initialize();
  }

  private async initialize() {
    // Check if extension is enabled
    const result = await chrome.storage.local.get(['isEnabled']);
    this.isEnabled = result.isEnabled ?? true;

    if (!this.isEnabled) return;

    console.log('🤖 AI Shopping Assistant: Monitoring Amazon page');

    // Detect current product if on product page
    const productInfo = this.productDetector.detectCurrentProduct();
    if (productInfo) {
      this.handleProductView(productInfo);
    }

    // Monitor page changes (SPA navigation)
    this.setupPageChangeDetection();

    // Monitor user interactions
    this.setupInteractionTracking();

    // Setup DOM mutation observer for dynamic content
    this.setupMutationObserver();
  }

  private setupPageChangeDetection() {
    // Monitor URL changes for SPA navigation
    let currentUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handlePageChange();
      }
    };

    // Check for URL changes periodically
    setInterval(checkUrlChange, 1000);

    // Also listen for history changes
    window.addEventListener('popstate', () => this.handlePageChange());
  }

  private handlePageChange() {
    console.log('🔄 Page change detected:', window.location.href);
    
    // Reset current tracking
    this.finalizeBehaviorTracking();
    
    // Detect new product
    setTimeout(() => {
      const productInfo = this.productDetector.detectCurrentProduct();
      if (productInfo) {
        this.handleProductView(productInfo);
      }
    }, 500);
  }

  private setupInteractionTracking() {
    // Track price element interactions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Price clicks
      if (this.isPriceElement(target)) {
        this.recordInteraction('price_click');
      }
      
      // Add to cart
      if (this.isAddToCartButton(target)) {
        this.recordInteraction('add_to_cart_attempt');
      }
      
      // Wishlist
      if (this.isWishlistButton(target)) {
        this.recordInteraction('wishlist_add');
      }
      
      // Product images
      if (this.isProductImage(target)) {
        this.recordInteraction('image_click');
      }
      
      // Reviews
      if (this.isReviewElement(target)) {
        this.recordInteraction('review_click');
      }
    });

    // Track scrolling behavior
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.recordInteraction('detailed_scroll');
      }, 1000);
    });

    // Track time spent in different sections
    this.setupSectionTracking();
  }

  private setupSectionTracking() {
    const sections = [
      '.product-description',
      '.product-details',
      '.reviews-section',
      '.similar-products',
      '.product-images'
    ];

    sections.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.recordInteraction(`viewed_${selector.replace('.', '').replace('-', '_')}`);
            }
          });
        }, { threshold: 0.5 });

        observer.observe(element);
      }
    });
  }

  private setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Check for price changes
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (this.containsPriceElements(element)) {
                this.recordInteraction('price_change_detected');
              }
            }
          });
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private handleProductView(productInfo: any) {
    console.log('👀 Product detected:', productInfo);
    
    // Finalize previous product tracking
    this.finalizeBehaviorTracking();
    
    // Start tracking new product
    this.currentProduct = productInfo.id;
    this.startTime = new Date();
    
    // Initialize behavior tracking
    this.behavior.set(productInfo.id, {
      productId: productInfo.id,
      dwellTime: 0,
      interactions: [],
      priceChecks: 0,
      addToCartAttempts: 0,
      wishlistAdds: 0,
      timestamp: new Date()
    });

    // Inject AI assistant UI
    this.uiInjector.showFloatingBadge(productInfo);

    // Notify background script
    chrome.runtime.sendMessage({
      type: 'product_view',
      productInfo,
      url: window.location.href
    });
  }

  private recordInteraction(type: string) {
    if (!this.currentProduct || !this.isEnabled) return;

    const behavior = this.behavior.get(this.currentProduct);
    if (!behavior) return;

    behavior.interactions.push(type);
    
    // Update specific counters
    switch (type) {
      case 'price_click':
      case 'price_change_detected':
        behavior.priceChecks++;
        break;
      case 'add_to_cart_attempt':
        behavior.addToCartAttempts++;
        break;
      case 'wishlist_add':
        behavior.wishlistAdds++;
        break;
    }

    console.log(`📊 Interaction recorded: ${type} for product ${this.currentProduct}`);

    // Check if behavior indicates strong interest
    this.evaluateNegotiationOpportunity();
  }

  private evaluateNegotiationOpportunity() {
    if (!this.currentProduct) return;

    const behavior = this.behavior.get(this.currentProduct);
    if (!behavior) return;

    // Calculate interest score
    const dwellTime = this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0;
    behavior.dwellTime = dwellTime;

    const interestScore = this.calculateInterestScore(behavior);
    
    console.log(`🎯 Interest score for ${this.currentProduct}: ${interestScore}`);

    // Trigger negotiation if high interest
    if (interestScore >= 0.7) {
      this.triggerNegotiation(behavior);
    }
  }

  private calculateInterestScore(behavior: UserBehavior): number {
    let score = 0;

    // Dwell time (max 0.3)
    score += Math.min(behavior.dwellTime / 180, 0.3); // 3 minutes = max score

    // Price checks (max 0.2)
    score += Math.min(behavior.priceChecks * 0.1, 0.2);

    // Add to cart attempts (max 0.2)
    score += Math.min(behavior.addToCartAttempts * 0.2, 0.2);

    // Detailed interactions (max 0.2)
    const detailedInteractions = behavior.interactions.filter(i => 
      ['detailed_scroll', 'review_click', 'viewed_product_details', 'image_click'].includes(i)
    ).length;
    score += Math.min(detailedInteractions * 0.05, 0.2);

    // Wishlist adds (max 0.1)
    score += Math.min(behavior.wishlistAdds * 0.1, 0.1);

    return Math.min(score, 1.0);
  }

  private async triggerNegotiation(behavior: UserBehavior) {
    console.log('🚀 Triggering negotiation for:', behavior.productId);

    // Show negotiation starting UI
    this.uiInjector.showNegotiationStatus('starting');

    // Send to background script for processing
    chrome.runtime.sendMessage({
      type: 'start_negotiation',
      productId: behavior.productId,
      behavior,
      url: window.location.href
    });
  }

  private finalizeBehaviorTracking() {
    if (this.currentProduct && this.startTime) {
      const behavior = this.behavior.get(this.currentProduct);
      if (behavior) {
        behavior.dwellTime = (Date.now() - this.startTime.getTime()) / 1000;
        
        // Send final behavior data to background
        chrome.runtime.sendMessage({
          type: 'behavior_data',
          behavior
        });
      }
    }

    this.currentProduct = null;
    this.startTime = null;
    this.uiInjector.cleanup();
  }

  private cleanup() {
    this.finalizeBehaviorTracking();
    if (this.observer) {
      this.observer.disconnect();
    }
    this.uiInjector.cleanup();
  }

  // Helper methods for element detection
  private isPriceElement(element: HTMLElement): boolean {
    const priceSelectors = [
      '.a-price',
      '.a-price-symbol',
      '.a-price-whole',
      '.a-price-fraction',
      '[data-a-price]',
      '.price',
      '.pricePerUnit'
    ];

    return priceSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private isAddToCartButton(element: HTMLElement): boolean {
    const cartSelectors = [
      '#add-to-cart-button',
      '[name="submit.add-to-cart"]',
      '.a-button-addtocart'
    ];

    return cartSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private isWishlistButton(element: HTMLElement): boolean {
    const wishlistSelectors = [
      '#add-to-wishlist-button',
      '[data-action="add-to-wishlist"]',
      '.a-button-wishlist'
    ];

    return wishlistSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private isProductImage(element: HTMLElement): boolean {
    const imageSelectors = [
      '.product-image',
      '#landingImage',
      '.a-dynamic-image',
      '[data-a-image-name="landingImage"]'
    ];

    return imageSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private isReviewElement(element: HTMLElement): boolean {
    const reviewSelectors = [
      '.review',
      '[data-hook="review"]',
      '.cr-original-review-text',
      '.reviews-link'
    ];

    return reviewSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private containsPriceElements(element: Element): boolean {
    return element.querySelector('.a-price, [data-a-price], .price') !== null;
  }
}

// Initialize monitor when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AmazonMonitor();
  });
} else {
  new AmazonMonitor();
}