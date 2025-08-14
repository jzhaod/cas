// Product detection logic for Amazon pages
export interface ProductInfo {
  id: string;
  asin: string;
  name: string;
  price: number;
  originalPrice?: number;
  currency: string;
  image: string;
  category: string;
  seller: string;
  rating?: number;
  reviewCount?: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited';
  url: string;
}

export class ProductDetector {
  
  detectCurrentProduct(): ProductInfo | null {
    // Check if we're on a product detail page
    if (!this.isProductPage()) {
      return null;
    }

    try {
      const productInfo: ProductInfo = {
        id: this.extractProductId(),
        asin: this.extractASIN(),
        name: this.extractProductName(),
        price: this.extractPrice(),
        originalPrice: this.extractOriginalPrice(),
        currency: this.extractCurrency(),
        image: this.extractMainImage(),
        category: this.extractCategory(),
        seller: this.extractSeller(),
        rating: this.extractRating(),
        reviewCount: this.extractReviewCount(),
        availability: this.extractAvailability(),
        url: window.location.href
      };

      // Validate that we have minimum required info
      if (!productInfo.id || !productInfo.name || !productInfo.price) {
        console.warn('🚫 Incomplete product data detected');
        return null;
      }

      return productInfo;
    } catch (error) {
      console.error('❌ Error detecting product:', error);
      return null;
    }
  }

  private isProductPage(): boolean {
    // Check URL patterns
    const productUrlPatterns = [
      /\/dp\/[A-Z0-9]{10}/,  // Standard product page
      /\/gp\/product\/[A-Z0-9]{10}/,  // Alternative product URL
      /\/exec\/obidos\/ASIN\/[A-Z0-9]{10}/  // Legacy ASIN URL
    ];

    const isProductUrl = productUrlPatterns.some(pattern => 
      pattern.test(window.location.pathname)
    );

    // Check for product page elements
    const hasProductElements = !!(
      document.querySelector('#productTitle') ||
      document.querySelector('[data-asin]') ||
      document.querySelector('#add-to-cart-button')
    );

    return isProductUrl || hasProductElements;
  }

  private extractProductId(): string {
    // Try to get from URL first
    const urlMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Try alternative URL pattern
    const altUrlMatch = window.location.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/);
    if (altUrlMatch) {
      return altUrlMatch[1];
    }

    // Try from data attributes
    const asinElement = document.querySelector('[data-asin]');
    if (asinElement) {
      return asinElement.getAttribute('data-asin') || '';
    }

    // Try from meta tags
    const metaAsin = document.querySelector('meta[name="asin"]');
    if (metaAsin) {
      return metaAsin.getAttribute('content') || '';
    }

    // Try from hidden inputs
    const hiddenAsin = document.querySelector('input[name="ASIN"]') as HTMLInputElement;
    if (hiddenAsin) {
      return hiddenAsin.value;
    }

    console.warn('⚠️ Could not extract product ID from selectors');
    return ''; // Return empty string instead of throwing error
  }

  private extractASIN(): string {
    // ASIN is typically the same as product ID for Amazon
    return this.extractProductId();
  }

  private extractProductName(): string {
    // Primary product title selector
    const titleElement = document.querySelector('#productTitle');
    if (titleElement?.textContent) {
      return titleElement.textContent.trim();
    }

    // Alternative selectors
    const altSelectors = [
      '.product-title',
      '[data-automation-id="product-title"]',
      'h1.a-size-large',
      '.a-size-large.product-title-word-break',
      'h1[data-automation-id="product-title"]',
      '.product-title-word-break',
      'h1.a-size-base-plus'
    ];

    for (const selector of altSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    // Try meta tags
    const metaTitle = document.querySelector('meta[property="og:title"]');
    if (metaTitle) {
      const content = metaTitle.getAttribute('content');
      if (content) {
        return content.replace(' : Amazon.com', '').replace(' - Amazon.com', '').trim();
      }
    }

    // Try document title as last resort
    const docTitle = document.title;
    if (docTitle && docTitle !== 'Amazon.com') {
      return docTitle.replace(' : Amazon.com', '').replace(' - Amazon.com', '').trim();
    }

    console.warn('⚠️ Could not extract product name from selectors');
    return ''; // Return empty string instead of throwing error
  }

  private extractPrice(): number {
    // Current price selectors in priority order
    const priceSelectors = [
      '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',  // Main price
      '.a-price-whole',  // Whole dollar amount
      '[data-a-price] .a-offscreen',  // Alternative price
      '.a-price .a-offscreen',  // Generic price
      '.price .a-offscreen'  // Legacy price
    ];

    for (const selector of priceSelectors) {
      const priceElement = document.querySelector(selector);
      if (priceElement?.textContent) {
        const price = this.parsePrice(priceElement.textContent);
        if (price > 0) {
          return price;
        }
      }
    }

    // Try structured data
    const structuredData = this.extractStructuredDataPrice();
    if (structuredData > 0) {
      return structuredData;
    }

    console.warn('⚠️ Could not extract price from selectors');
    return 0; // Return 0 instead of throwing error
  }

  private extractOriginalPrice(): number | undefined {
    // Look for crossed-out or "was" prices
    const originalPriceSelectors = [
      '.a-text-strike .a-offscreen',  // Struck through price
      '.a-price.a-text-strike .a-offscreen',
      '[data-a-strike="true"] .a-offscreen',
      '.basisPrice .a-offscreen',  // Basis price
      '.priceBlockStrikePriceString'  // Legacy
    ];

    for (const selector of originalPriceSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        const price = this.parsePrice(element.textContent);
        if (price > 0) {
          return price;
        }
      }
    }

    return undefined;
  }

  private parsePrice(priceText: string): number {
    // Remove currency symbols and extract numeric value
    const cleanPrice = priceText
      .replace(/[$£€¥₹]/g, '')  // Remove currency symbols
      .replace(/[,\s]/g, '')    // Remove commas and spaces
      .replace(/[^\d.]/g, '');  // Keep only digits and decimal

    const price = parseFloat(cleanPrice);
    return isNaN(price) ? 0 : price;
  }

  private extractCurrency(): string {
    // Try to detect currency from price elements
    const priceElement = document.querySelector('.a-price .a-symbol');
    if (priceElement?.textContent) {
      const symbol = priceElement.textContent.trim();
      const currencyMap: { [key: string]: string } = {
        '$': 'USD',
        '£': 'GBP',
        '€': 'EUR',
        '¥': 'JPY',
        '₹': 'INR'
      };
      return currencyMap[symbol] || 'USD';
    }

    // Fallback to domain-based detection
    const domain = window.location.hostname;
    const domainToCurrency: { [key: string]: string } = {
      'amazon.com': 'USD',
      'amazon.co.uk': 'GBP',
      'amazon.de': 'EUR',
      'amazon.fr': 'EUR',
      'amazon.it': 'EUR',
      'amazon.es': 'EUR',
      'amazon.co.jp': 'JPY',
      'amazon.in': 'INR',
      'amazon.ca': 'CAD'
    };

    return domainToCurrency[domain] || 'USD';
  }

  private extractMainImage(): string {
    const imageSelectors = [
      '#landingImage',  // Main product image
      '[data-a-image-name="landingImage"]',
      '.a-dynamic-image',
      '#imgTagWrapperId img',
      '.product-image img'
    ];

    for (const selector of imageSelectors) {
      const imgElement = document.querySelector(selector) as HTMLImageElement;
      if (imgElement?.src) {
        return imgElement.src;
      }
    }

    // Try from meta tags
    const metaImage = document.querySelector('meta[property="og:image"]');
    if (metaImage) {
      return metaImage.getAttribute('content') || '';
    }

    return '';
  }

  private extractCategory(): string {
    // Breadcrumb navigation
    const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div .a-link-normal');
    if (breadcrumbs.length > 0) {
      const categories = Array.from(breadcrumbs)
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      return categories.join(' > ');
    }

    // Alternative breadcrumb selector
    const altBreadcrumbs = document.querySelectorAll('.a-breadcrumb .a-link-normal');
    if (altBreadcrumbs.length > 0) {
      const categories = Array.from(altBreadcrumbs)
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      return categories.join(' > ');
    }

    // Department from sidebar
    const department = document.querySelector('#nav-subnav [data-menu-id]');
    if (department?.textContent) {
      return department.textContent.trim();
    }

    return 'Unknown';
  }

  private extractSeller(): string {
    // Seller information selectors
    const sellerSelectors = [
      '#sellerProfileTriggerId',  // Main seller link
      '[data-seller-name]',  // Seller data attribute
      '.a-link-normal[href*="/seller/"]',  // Seller profile link
      '#merchant-info .a-link-normal',  // Merchant info
      '.tabular-buybox-text[tabular-attribute-name="Sold by"] .a-link-normal'
    ];

    for (const selector of sellerSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    // Check if sold by Amazon
    const amazonSeller = document.querySelector('[aria-label*="Amazon"]');
    if (amazonSeller) {
      return 'Amazon';
    }

    return 'Unknown Seller';
  }

  private extractRating(): number | undefined {
    // Rating selectors
    const ratingSelectors = [
      '[data-hook="average-star-rating"] .a-icon-alt',  // New format
      '.a-icon-alt[title*="out of 5 stars"]',  // Alt text format
      '#acrPopover [title*="out of 5"]',  // Popover format
      '.reviewCountTextLinkedHistogram .a-icon-alt'  // Alternative
    ];

    for (const selector of ratingSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.getAttribute('title') || element.textContent;
        if (text) {
          const match = text.match(/(\d+\.?\d*)\s*out of/);
          if (match) {
            return parseFloat(match[1]);
          }
        }
      }
    }

    return undefined;
  }

  private extractReviewCount(): number | undefined {
    // Review count selectors
    const reviewSelectors = [
      '#acrCustomerReviewText',  // Main review count
      '[data-hook="total-review-count"]',  // Alternative format
      '.a-link-normal[href*="#customerReviews"]'  // Link format
    ];

    for (const selector of reviewSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        const text = element.textContent;
        const match = text.match(/([0-9,]+)\s*customer reviews?/i);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
    }

    return undefined;
  }

  private extractAvailability(): 'in_stock' | 'out_of_stock' | 'limited' {
    // Check availability indicators
    const availabilityElement = document.querySelector('#availability span');
    if (availabilityElement?.textContent) {
      const text = availabilityElement.textContent.toLowerCase();
      
      if (text.includes('in stock')) {
        return 'in_stock';
      } else if (text.includes('out of stock') || text.includes('unavailable')) {
        return 'out_of_stock';
      } else if (text.includes('only') && text.includes('left')) {
        return 'limited';
      }
    }

    // Check add to cart button state
    const addToCartButton = document.querySelector('#add-to-cart-button');
    if (addToCartButton) {
      const isDisabled = addToCartButton.hasAttribute('disabled') || 
                        addToCartButton.classList.contains('a-button-disabled');
      return isDisabled ? 'out_of_stock' : 'in_stock';
    }

    // Default to in stock if we can't determine
    return 'in_stock';
  }

  private extractStructuredDataPrice(): number {
    // Try to find JSON-LD structured data
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        
        // Handle different structured data formats
        const offers = data.offers || data['@graph']?.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (offer.price) {
            return parseFloat(offer.price);
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    return 0;
  }
}