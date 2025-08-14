// Discovery Service Client - Finds available seller MCP servers
export interface SellerEndpoint {
  sellerId: string;
  sellerName: string;
  mcpEndpoint: string;
  apiKey?: string;
  capabilities: string[];
  metadata: {
    rating: number;
    averageResponseTime: number;
    successRate: number;
    specialties: string[];
    supportedPayments: string[];
    shippingRegions: string[];
  };
  contact: {
    email?: string;
    website?: string;
    supportUrl?: string;
  };
}

export interface SellerSearchCriteria {
  productId?: string;
  category?: string;
  priceRange?: [number, number];
  location?: string;
  specialty?: string;
  minRating?: number;
  maxResponseTime?: number;
}

export interface DiscoveryServiceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
}

export class DiscoveryClient {
  private config: DiscoveryServiceConfig;
  private cache: Map<string, { data: SellerEndpoint[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(config?: Partial<DiscoveryServiceConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || 'http://localhost:8002',
      apiKey: config?.apiKey,
      timeout: config?.timeout || 10000,
      retryAttempts: config?.retryAttempts || 3
    };

    console.log('🔍 Discovery Client initialized:', {
      baseUrl: this.config.baseUrl,
      hasApiKey: !!this.config.apiKey
    });
  }

  async findSellers(criteria: SellerSearchCriteria): Promise<SellerEndpoint[]> {
    console.log('🔎 Searching for sellers:', criteria);

    // Check cache first
    const cacheKey = this.generateCacheKey(criteria);
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      console.log('✅ Returning cached sellers:', cached.length);
      return cached;
    }

    try {
      const sellers = await this.searchSellers(criteria);
      
      // Filter and sort results
      console.log(`📋 Raw sellers from API: ${sellers.length}`);
      const filtered = this.filterSellers(sellers, criteria);
      console.log(`🔍 Filtered sellers: ${filtered.length}`);
      const sorted = this.sortSellers(filtered, criteria);

      // Cache results
      this.setCached(cacheKey, sorted);

      console.log(`✅ Found ${sorted.length} matching sellers`);
      return sorted;

    } catch (error) {
      console.error('❌ Seller discovery failed:', error);
      
      // Return fallback sellers if available
      const fallback = await this.getFallbackSellers(criteria);
      if (fallback.length > 0) {
        console.log('🔄 Using fallback sellers:', fallback.length);
        return fallback;
      }

      throw error;
    }
  }

  private async searchSellers(criteria: SellerSearchCriteria): Promise<SellerEndpoint[]> {
    const url = new URL(`${this.config.baseUrl}/api/v1/discovery/sellers/search`);
    
    // Add query parameters (match backend API)
    if (criteria.category) url.searchParams.set('category', criteria.category);
    if (criteria.minRating) url.searchParams.set('min_rating', criteria.minRating.toString());
    if (criteria.maxResponseTime) url.searchParams.set('max_response_time', criteria.maxResponseTime.toString());
    if (criteria.specialty) {
      url.searchParams.append('specialty_tags', criteria.specialty);
    }
    
    // Optional parameters with defaults
    url.searchParams.set('limit', '10');
    url.searchParams.set('sort_by', 'rating');
    url.searchParams.set('sort_order', 'desc');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AI-Shopping-Assistant/1.0.0'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`📡 API Request (attempt ${attempt}):`, url.toString());

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.sellers || !Array.isArray(data.sellers)) {
          throw new Error('Invalid response format: missing sellers array');
        }

        // Validate seller data
        const validSellers = data.sellers
          .filter(seller => this.validateSellerEndpoint(seller))
          .map(seller => this.normalizeSellerEndpoint(seller));

        return validSellers;

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All discovery attempts failed');
  }

  private validateSellerEndpoint(seller: any): boolean {
    return !!(
      seller.seller_id &&
      seller.seller_name &&
      seller.mcp_connection?.endpoint_url &&
      seller.capabilities &&
      Array.isArray(seller.capabilities)
    );
  }

  private normalizeSellerEndpoint(seller: any): SellerEndpoint {
    return {
      sellerId: seller.seller_id,
      sellerName: seller.seller_name,
      mcpEndpoint: seller.mcp_connection.endpoint_url,
      apiKey: seller.mcp_connection.api_key,
      capabilities: seller.capabilities || [],
      metadata: {
        rating: seller.rating || 0,
        averageResponseTime: seller.response_time_minutes * 60 * 1000 || 5000, // Convert minutes to milliseconds
        successRate: seller.success_rate || 0.5,
        specialties: seller.specialties || [],
        supportedPayments: seller.metadata?.supportedPayments || ['credit_card'],
        shippingRegions: seller.metadata?.shippingRegions || ['US']
      },
      contact: {
        email: seller.contact_email,
        website: seller.website_url,
        supportUrl: seller.support_url
      }
    };
  }

  private filterSellers(sellers: SellerEndpoint[], criteria: SellerSearchCriteria): SellerEndpoint[] {
    return sellers.filter(seller => {
      console.log(`🔎 Checking seller: ${seller.sellerName}`, {
        rating: seller.metadata.rating,
        capabilities: seller.capabilities
      });
      // Rating filter
      if (criteria.minRating && seller.metadata.rating < criteria.minRating) {
        return false;
      }

      // Response time filter
      if (criteria.maxResponseTime && seller.metadata.averageResponseTime > criteria.maxResponseTime) {
        return false;
      }

      // Specialty filter
      if (criteria.specialty && !seller.metadata.specialties.includes(criteria.specialty)) {
        return false;
      }

      // Skip capability filtering - let MCP handle tool discovery
      // MCP servers should expose their available tools via tools/list
      // Rather than hardcoding capability requirements
      
      console.log(`✅ Seller ${seller.sellerName} passed all filters (capabilities will be discovered via MCP)`);
      return true;
    });
  }

  private sortSellers(sellers: SellerEndpoint[], criteria: SellerSearchCriteria): SellerEndpoint[] {
    return sellers.sort((a, b) => {
      // Calculate composite score for ranking
      const scoreA = this.calculateSellerScore(a, criteria);
      const scoreB = this.calculateSellerScore(b, criteria);
      
      return scoreB - scoreA; // Higher scores first
    });
  }

  private calculateSellerScore(seller: SellerEndpoint, criteria: SellerSearchCriteria): number {
    let score = 0;

    // Base rating (40% weight)
    score += seller.metadata.rating * 0.4;

    // Success rate (30% weight)
    score += seller.metadata.successRate * 0.3;

    // Response time (20% weight) - lower is better
    const responseTimeScore = Math.max(0, 1 - (seller.metadata.averageResponseTime / 10000));
    score += responseTimeScore * 0.2;

    // Specialty match bonus (10% weight)
    if (criteria.specialty && seller.metadata.specialties.includes(criteria.specialty)) {
      score += 0.1;
    }

    // Additional capabilities bonus
    const advancedCaps = ['getProductInfo', 'checkDealStatus', 'acceptDeal'];
    const capabilityBonus = (seller.capabilities && Array.isArray(seller.capabilities)) 
      ? advancedCaps.filter(cap => seller.capabilities.includes(cap)).length * 0.02 
      : 0;
    score += capabilityBonus;

    return score;
  }

  private generateCacheKey(criteria: SellerSearchCriteria): string {
    const keyParts = [
      criteria.productId || '',
      criteria.category || '',
      criteria.location || '',
      criteria.specialty || '',
      criteria.minRating?.toString() || '',
      criteria.priceRange?.join('-') || ''
    ];
    
    return keyParts.join('|');
  }

  private getCached(key: string): SellerEndpoint[] | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCached(key: string, data: SellerEndpoint[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Cleanup old cache entries periodically
    if (this.cache.size > 50) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  private async getFallbackSellers(criteria: SellerSearchCriteria): Promise<SellerEndpoint[]> {
    // Return hardcoded fallback sellers for testing/demo purposes
    const fallbackSellers: SellerEndpoint[] = [
      {
        sellerId: 'demo-seller-001',
        sellerName: 'Demo Electronics Store',
        mcpEndpoint: 'wss://demo-seller.example.com/mcp',
        capabilities: ['initiateNegotiation', 'makeOffer', 'getProductInfo', 'acceptDeal'],
        metadata: {
          rating: 4.2,
          averageResponseTime: 2000,
          successRate: 0.75,
          specialties: ['electronics', 'computers'],
          supportedPayments: ['credit_card', 'paypal'],
          shippingRegions: ['US', 'CA']
        },
        contact: {
          email: 'support@demo-seller.example.com',
          website: 'https://demo-seller.example.com'
        }
      },
      {
        sellerId: 'demo-seller-002',
        sellerName: 'Budget Deals Outlet',
        mcpEndpoint: 'wss://budget-deals.example.com/mcp',
        capabilities: ['initiateNegotiation', 'makeOffer', 'acceptDeal'],
        metadata: {
          rating: 3.8,
          averageResponseTime: 3500,
          successRate: 0.65,
          specialties: ['home_garden', 'electronics'],
          supportedPayments: ['credit_card'],
          shippingRegions: ['US']
        },
        contact: {
          email: 'deals@budget-deals.example.com',
          website: 'https://budget-deals.example.com'
        }
      }
    ];

    // Filter fallback sellers based on criteria
    return this.filterSellers(fallbackSellers, criteria);
  }

  // Health check for discovery service
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/health`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'AI-Shopping-Assistant/1.0.0'
        }
      });

      return response.ok;
    } catch (error) {
      console.warn('Discovery service health check failed:', error);
      return false;
    }
  }

  // Register a new seller (for seller onboarding)
  async registerSeller(sellerInfo: {
    sellerName: string;
    mcpEndpoint: string;
    capabilities: string[];
    contact: {
      email: string;
      website?: string;
    };
    metadata: {
      specialties: string[];
      supportedPayments: string[];
      shippingRegions: string[];
    };
  }): Promise<{ success: boolean; sellerId?: string; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Shopping-Assistant/1.0.0'
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(`${this.config.baseUrl}/api/sellers/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sellerInfo)
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Seller registered successfully:', result.sellerId);
        return { success: true, sellerId: result.sellerId };
      } else {
        return { success: false, error: result.error || 'Registration failed' };
      }

    } catch (error) {
      console.error('❌ Seller registration failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<DiscoveryServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Discovery client config updated');
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Discovery cache cleared');
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to track hits/misses for real implementation
    };
  }
}