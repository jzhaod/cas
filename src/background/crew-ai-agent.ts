// CrewAI Integration for Shopping Agent - AI-powered negotiation intelligence
import { MCPClient } from './mcp-client';

export interface AIAgentConfig {
  llmProvider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model: string;
  temperature?: number;
  maxNegotiationRounds: number;
  timeout?: number;
}

export interface NegotiationContext {
  sessionId: string;
  productInfo: {
    id: string;
    name: string;
    price: number;
    currency: string;
    seller: string;
    category?: string;
  };
  behavior: {
    interestScore: number;
    dwellTime: number;
    priceChecks: number;
    addToCartAttempts: number;
  };
  preferences?: {
    desiredDiscount: number;
    maxPrice: number;
    options: {
      openToBundle: boolean;
      interestedInWarranty: boolean;
      willingToBuyMultiple: boolean;
      flexiblePayment: boolean;
    };
    strategy: 'aggressive' | 'balanced' | 'conservative' | 'custom';
    customRequirements?: string;
  };
  sellerCapabilities: string[];
  mcpClient: MCPClient;
}

export interface NegotiationResult {
  success: boolean;
  finalOffer?: {
    price: number;
    currency: string;
    savings: number;
    discountPercent: number;
    terms?: any;
    rounds: number;
  };
  reason?: string;
  savings?: number;
  negotiationLog: NegotiationStep[];
}

interface NegotiationStep {
  round: number;
  action: 'analyze' | 'offer' | 'counter' | 'accept' | 'reject';
  details: any;
  timestamp: Date;
  reasoning?: string;
}

interface LLMResponse {
  decision: 'continue' | 'accept' | 'reject' | 'counter';
  reasoning: string;
  nextAction?: {
    type: 'price_offer' | 'bundle_request' | 'quantity_offer' | 'walk_away';
    parameters: any;
  };
  confidence: number;
}

export class CrewAIAgent {
  private config: AIAgentConfig | null = null;
  private llmClient: any = null; // Will be dynamically imported based on provider

  constructor() {
    // Initialize without config - will be configured later
  }

  async configure(config: AIAgentConfig): Promise<void> {
    this.config = config;
    
    // Initialize LLM client based on provider
    await this.initializeLLMClient();
    
    console.log('🤖 CrewAI Agent configured with:', {
      provider: config.llmProvider,
      model: config.model,
      maxRounds: config.maxNegotiationRounds
    });
  }

  private async initializeLLMClient(): Promise<void> {
    if (!this.config) {
      throw new Error('Agent not configured');
    }

    switch (this.config.llmProvider) {
      case 'openai':
        // For browser extension, we'll use fetch API instead of official SDK to avoid bundling issues
        this.llmClient = {
          provider: 'openai',
          apiKey: this.config.apiKey,
          model: this.config.model,
          baseURL: 'https://api.openai.com/v1'
        };
        break;

      case 'anthropic':
        this.llmClient = {
          provider: 'anthropic',
          apiKey: this.config.apiKey,
          model: this.config.model,
          baseURL: 'https://api.anthropic.com/v1'
        };
        break;

      case 'local':
        // For local models (Ollama, etc.)
        this.llmClient = {
          provider: 'local',
          baseURL: 'http://localhost:11434/v1', // Default Ollama endpoint
          model: this.config.model
        };
        break;

      default:
        throw new Error(`Unsupported LLM provider: ${this.config.llmProvider}`);
    }
  }

  async executeNegotiation(context: NegotiationContext): Promise<NegotiationResult> {
    if (!this.config || !this.llmClient) {
      throw new Error('CrewAI Agent not properly configured');
    }

    console.log('🚀 Starting AI-powered negotiation for:', context.productInfo.name);

    const negotiationLog: NegotiationStep[] = [];
    let currentRound = 0;
    let lastSellerOffer: any = null;

    try {
      // Step 1: Analyze the negotiation opportunity
      const analysis = await this.analyzeNegotiationOpportunity(context);
      negotiationLog.push({
        round: 0,
        action: 'analyze',
        details: analysis,
        timestamp: new Date(),
        reasoning: analysis.reasoning
      });

      if (!analysis.shouldNegotiate) {
        return {
          success: false,
          reason: analysis.reasoning,
          negotiationLog
        };
      }

      // Step 2: Get initial product information from seller
      const productInfoResponse = await context.mcpClient.getProductInfo(
        context.productInfo.id,
        'detailed'
      );

      if (!productInfoResponse.success) {
        return {
          success: false,
          reason: 'Failed to get product information from seller',
          negotiationLog
        };
      }

      // Step 3: Initiate negotiation with seller
      const initiationResponse = await context.mcpClient.initiateNegotiation({
        sessionId: context.sessionId,
        productId: context.productInfo.id,
        buyerContext: this.buildBuyerContext(context, analysis)
      });

      if (!initiationResponse.success) {
        return {
          success: false,
          reason: 'Failed to initiate negotiation with seller',
          negotiationLog
        };
      }

      lastSellerOffer = initiationResponse.data.initialOffer;
      currentRound = 1;

      // Step 4: Negotiation loop
      while (currentRound <= this.config.maxNegotiationRounds) {
        console.log(`🔄 Negotiation Round ${currentRound}`);

        // Analyze current offer using AI
        const decision = await this.analyzeOffer(
          context,
          lastSellerOffer,
          currentRound,
          negotiationLog
        );

        negotiationLog.push({
          round: currentRound,
          action: decision.decision === 'continue' ? 'counter' : decision.decision,
          details: {
            sellerOffer: lastSellerOffer,
            aiDecision: decision
          },
          timestamp: new Date(),
          reasoning: decision.reasoning
        });

        // Handle AI decision
        switch (decision.decision) {
          case 'accept':
            // Accept the current offer
            const acceptResponse = await context.mcpClient.acceptDeal(
              context.sessionId,
              lastSellerOffer
            );

            if (acceptResponse.success) {
              const savings = context.productInfo.price - lastSellerOffer.price;
              return {
                success: true,
                finalOffer: {
                  price: lastSellerOffer.price,
                  currency: context.productInfo.currency,
                  savings,
                  discountPercent: (savings / context.productInfo.price) * 100,
                  terms: lastSellerOffer,
                  rounds: currentRound
                },
                savings,
                negotiationLog
              };
            } else {
              return {
                success: false,
                reason: 'Failed to accept deal',
                negotiationLog
              };
            }

          case 'reject':
            return {
              success: false,
              reason: decision.reasoning,
              negotiationLog
            };

          case 'counter':
          case 'continue':
            // Make counter offer based on AI recommendation
            if (!decision.nextAction) {
              return {
                success: false,
                reason: 'AI failed to provide next action',
                negotiationLog
              };
            }

            const counterResponse = await context.mcpClient.makeOffer({
              sessionId: context.sessionId,
              offerType: this.mapActionToOfferType(decision.nextAction.type),
              offerDetails: decision.nextAction.parameters
            });

            if (!counterResponse.success) {
              return {
                success: false,
                reason: 'Failed to make counter offer',
                negotiationLog
              };
            }

            // Update for next round
            lastSellerOffer = counterResponse.data.counterOffer || counterResponse.data;
            currentRound++;
            
            // Small delay between rounds to avoid overwhelming the seller
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;

          default:
            return {
              success: false,
              reason: 'Unknown AI decision',
              negotiationLog
            };
        }
      }

      // Max rounds reached
      return {
        success: false,
        reason: `Maximum negotiation rounds (${this.config.maxNegotiationRounds}) reached`,
        negotiationLog
      };

    } catch (error) {
      console.error('❌ Negotiation execution failed:', error);
      return {
        success: false,
        reason: error.message,
        negotiationLog
      };
    }
  }

  private async analyzeNegotiationOpportunity(context: NegotiationContext): Promise<{
    shouldNegotiate: boolean;
    reasoning: string;
    targetPrice?: number;
    strategy?: string;
  }> {
    // If user has set preferences, they explicitly want to negotiate
    if (context.preferences) {
      return {
        shouldNegotiate: true,
        reasoning: 'User has explicitly set negotiation preferences',
        targetPrice: context.preferences.maxPrice,
        strategy: this.getStrategyFromPreferences(context.preferences)
      };
    }

    const prompt = `
You are an experienced negotiation expert analyzing a shopping opportunity. 

PRODUCT INFORMATION:
- Name: ${context.productInfo.name}
- Current Price: ${context.productInfo.currency}${context.productInfo.price}
- Seller: ${context.productInfo.seller}
- Category: ${context.productInfo.category || 'Unknown'}

USER BEHAVIOR:
- Interest Score: ${context.behavior.interestScore}/1.0
- Time Spent Viewing: ${context.behavior.dwellTime} seconds
- Price Checks: ${context.behavior.priceChecks}
- Add to Cart Attempts: ${context.behavior.addToCartAttempts}

SELLER CAPABILITIES:
- Available negotiation tools: ${context.sellerCapabilities.join(', ')}

Based on this information, analyze whether negotiation is worthwhile and what strategy to use.

Respond in JSON format:
{
  "shouldNegotiate": boolean,
  "reasoning": "Clear explanation of decision",
  "targetPrice": number (if negotiating),
  "strategy": "brief strategy description"
}
`;

    const response = await this.callLLM(prompt);
    return this.parseJSONResponse(response, {
      shouldNegotiate: false,
      reasoning: 'Failed to analyze opportunity'
    });
  }

  private getStrategyFromPreferences(preferences: NegotiationContext['preferences']): string {
    if (!preferences) return 'balanced';
    
    if (preferences.strategy === 'custom' && preferences.customRequirements) {
      return preferences.customRequirements;
    }
    
    const strategies = {
      aggressive: 'Push for maximum discount, willing to walk away if target not met',
      balanced: 'Fair negotiation seeking win-win outcome',
      conservative: 'Accept reasonable offers quickly'
    };
    
    return strategies[preferences.strategy] || 'balanced';
  }

  private async analyzeOffer(
    context: NegotiationContext,
    offer: any,
    round: number,
    history: NegotiationStep[]
  ): Promise<LLMResponse> {
    // Build preferences section if user has set them
    const preferencesSection = context.preferences ? `
USER PREFERENCES:
- Desired Discount: ${context.preferences.desiredDiscount}%
- Maximum Price: ${context.productInfo.currency}${context.preferences.maxPrice}
- Strategy: ${context.preferences.strategy}
- Open to Bundle: ${context.preferences.options.openToBundle}
- Interested in Warranty: ${context.preferences.options.interestedInWarranty}
- Willing to Buy Multiple: ${context.preferences.options.willingToBuyMultiple}
- Flexible Payment: ${context.preferences.options.flexiblePayment}
${context.preferences.customRequirements ? `- Custom Requirements: ${context.preferences.customRequirements}` : ''}
` : '';

    const prompt = `
You are an expert negotiator representing a buyer. Analyze the current seller offer and decide the best action.

CONTEXT:
- Original Price: ${context.productInfo.currency}${context.productInfo.price}
- Current Seller Offer: ${context.productInfo.currency}${offer.price || 'unknown'}
- Negotiation Round: ${round}/${this.config.maxNegotiationRounds}
- User Interest Level: ${context.behavior.interestScore}/1.0
${preferencesSection}
SELLER OFFER DETAILS:
${JSON.stringify(offer, null, 2)}

NEGOTIATION HISTORY:
${history.map(step => `Round ${step.round}: ${step.action} - ${step.reasoning}`).join('\n')}

INSTRUCTIONS:
1. Evaluate if this offer meets the user's preferences and provides good value
2. Consider the negotiation progress and remaining rounds
3. If user has preferences, prioritize achieving their desired outcome
4. Decide whether to accept, reject, or make a counter offer
5. If countering, specify the exact parameters based on user preferences

Respond in JSON format:
{
  "decision": "accept|reject|counter",
  "reasoning": "Clear explanation of your decision",
  "nextAction": {
    "type": "price_offer|bundle_request|quantity_offer|walk_away",
    "parameters": {
      "price": number,
      "quantity": number,
      "message": "persuasive message to seller"
    }
  },
  "confidence": number (0.0-1.0)
}
`;

    const response = await this.callLLM(prompt);
    return this.parseJSONResponse(response, {
      decision: 'reject',
      reasoning: 'Failed to analyze offer',
      confidence: 0.0
    });
  }

  private buildBuyerContext(context: NegotiationContext, analysis: any) {
    // Map interest score to urgency
    const urgency = context.behavior.interestScore > 0.8 ? 'high' :
                   context.behavior.interestScore > 0.5 ? 'medium' : 'low';

    const buyerContext: any = {
      urgency,
      priceTarget: analysis.targetPrice,
      quantity: 1,
      interests: [context.productInfo.category].filter(Boolean)
    };

    // Add user preferences if available
    if (context.preferences) {
      buyerContext.preferences = {
        desiredDiscount: context.preferences.desiredDiscount,
        maxPrice: context.preferences.maxPrice,
        negotiationOptions: context.preferences.options,
        strategy: context.preferences.strategy,
        customRequirements: context.preferences.customRequirements
      };
    }

    return buyerContext;
  }

  private mapActionToOfferType(actionType: string): 'price' | 'bundle' | 'quantity' {
    switch (actionType) {
      case 'price_offer': return 'price';
      case 'bundle_request': return 'bundle';
      case 'quantity_offer': return 'quantity';
      default: return 'price';
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    const requestBody = this.buildLLMRequest(prompt);
    const response = await this.makeAPIRequest(requestBody);

    return this.extractLLMResponse(response);
  }

  private buildLLMRequest(prompt: string) {
    const baseRequest = {
      model: this.llmClient.model,
      temperature: this.config?.temperature || 0.7,
      max_tokens: 1000
    };

    switch (this.llmClient.provider) {
      case 'openai':
        return {
          ...baseRequest,
          messages: [
            {
              role: 'system',
              content: 'You are an expert negotiator and shopping assistant. Always respond in valid JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        };

      case 'anthropic':
        return {
          ...baseRequest,
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nRespond in valid JSON format.`
            }
          ]
        };

      case 'local':
        return {
          ...baseRequest,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        };

      default:
        throw new Error('Unknown LLM provider');
    }
  }

  private async makeAPIRequest(requestBody: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add authentication headers based on provider
    if (this.llmClient.provider === 'openai') {
      headers['Authorization'] = `Bearer ${this.llmClient.apiKey}`;
    } else if (this.llmClient.provider === 'anthropic') {
      headers['x-api-key'] = this.llmClient.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }

    const endpoint = this.llmClient.provider === 'anthropic' 
      ? `${this.llmClient.baseURL}/messages`
      : `${this.llmClient.baseURL}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API request failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  private extractLLMResponse(response: any): string {
    switch (this.llmClient.provider) {
      case 'openai':
      case 'local':
        return response.choices?.[0]?.message?.content || '';

      case 'anthropic':
        return response.content?.[0]?.text || '';

      default:
        throw new Error('Unknown provider response format');
    }
  }

  private parseJSONResponse<T>(response: string, fallback: T): T {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Try parsing the entire response
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse LLM JSON response:', error);
      console.error('Raw response:', response);
      return fallback;
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    if (!this.config || !this.llmClient) {
      return false;
    }

    try {
      const testPrompt = 'Respond with: {"status": "ok"}';
      const response = await this.callLLM(testPrompt);
      const parsed = this.parseJSONResponse(response, { status: 'error' });
      return parsed.status === 'ok';
    } catch (error) {
      console.error('CrewAI health check failed:', error);
      return false;
    }
  }

  // Get current configuration
  getConfig(): AIAgentConfig | null {
    return this.config;
  }

  // Update configuration
  async updateConfig(newConfig: Partial<AIAgentConfig>): Promise<void> {
    if (this.config) {
      this.config = { ...this.config, ...newConfig };
      await this.initializeLLMClient();
    }
  }
}