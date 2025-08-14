// MCP Client for Shopping Agent - Communicates with Seller MCP servers
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface MCPConnectionConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
}

export interface NegotiationParams {
  sessionId: string;
  productId: string;
  buyerContext?: {
    urgency?: 'low' | 'medium' | 'high';
    priceTarget?: number;
    quantity?: number;
    interests?: string[];
  };
}

export interface OfferParams {
  sessionId: string;
  offerType: 'price' | 'bundle' | 'quantity';
  offerDetails: {
    price?: number;
    quantity?: number;
    bundleItems?: string[];
    message?: string;
  };
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class MCPClient {
  private client: Client | null = null;
  private currentEndpoint: string | null = null;
  private isConnected: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.client = new Client({
      name: "ai-shopping-assistant",
      version: "1.0.0"
    }, {
      capabilities: {
        roots: {},
        sampling: {}
      }
    });
  }

  async connect(endpoint: string, apiKey?: string, timeout: number = 30000): Promise<void> {
    if (this.isConnected && this.currentEndpoint === endpoint) {
      console.log('✅ Already connected to:', endpoint);
      return;
    }

    // Disconnect from previous endpoint if connected
    if (this.isConnected) {
      await this.disconnect();
    }

    console.log('🔌 Connecting to MCP server:', endpoint);

    try {
      // Use HTTP/SSE transport for HTTP endpoints
      const url = new URL(endpoint);
      console.log('🔄 Using HTTP/SSE transport for:', endpoint);
      
      const transport = new SSEClientTransport(url);

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        transport.close();
        throw new Error(`Connection timeout after ${timeout}ms`);
      }, timeout);

      // Set up error handling
      transport.onerror = (error) => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        throw new Error(`SSE connection failed: ${error.message}`);
      };

      // Connect MCP client (this will start the SSE connection)
      await this.client!.connect(transport);

      // Clear timeout on successful connection
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      this.currentEndpoint = endpoint;
      this.isConnected = true;

      console.log('✅ Connected to MCP server successfully');

      // List available tools for debugging
      const tools = await this.listAvailableTools();
      console.log('🛠️ Available tools:', tools.map(t => t.name));

    } catch (error) {
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      console.error('❌ MCP connection failed:', error);
      throw new Error(`Failed to connect to MCP server: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      console.log('🔌 Disconnecting from MCP server:', this.currentEndpoint);
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      await this.client.close();
      this.isConnected = false;
      this.currentEndpoint = null;

      console.log('✅ Disconnected successfully');
    } catch (error) {
      console.error('❌ Error during disconnect:', error);
    }
  }

  async listAvailableTools(): Promise<Array<{ name: string; description: string; inputSchema: any }>> {
    this.ensureConnected();

    try {
      const response = await this.client!.listTools();
      return response.tools || [];
    } catch (error) {
      console.error('❌ Failed to list tools:', error);
      throw new Error(`Failed to list tools: ${error.message}`);
    }
  }

  async initiateNegotiation(params: NegotiationParams): Promise<MCPResponse> {
    this.ensureConnected();

    try {
      console.log('🤝 Initiating negotiation:', params.sessionId);

      const result = await this.client!.callTool('initiateNegotiation', {
        productId: params.productId,
        sessionId: params.sessionId,
        buyerContext: params.buyerContext || {}
      });

      const responseData = this.parseToolResponse(result);
      
      if (responseData.sessionId) {
        console.log('✅ Negotiation initiated successfully');
        return {
          success: true,
          data: responseData
        };
      } else {
        throw new Error('Invalid response from seller agent');
      }

    } catch (error) {
      console.error('❌ Failed to initiate negotiation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async makeOffer(params: OfferParams): Promise<MCPResponse> {
    this.ensureConnected();

    try {
      console.log('💰 Making offer:', params.offerType, params.offerDetails);

      const result = await this.client!.callTool('makeOffer', {
        sessionId: params.sessionId,
        offerType: params.offerType,
        offerDetails: params.offerDetails
      });

      const responseData = this.parseToolResponse(result);

      console.log('✅ Offer response received');
      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      console.error('❌ Failed to make offer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getProductInfo(productId: string, infoType?: 'basic' | 'detailed' | 'comparisons'): Promise<MCPResponse> {
    this.ensureConnected();

    try {
      console.log('📦 Getting product info:', productId);

      const result = await this.client!.callTool('getProductInfo', {
        productId,
        infoType: infoType || 'basic'
      });

      const responseData = this.parseToolResponse(result);

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      console.error('❌ Failed to get product info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkDealStatus(sessionId: string): Promise<MCPResponse> {
    this.ensureConnected();

    try {
      const result = await this.client!.callTool('checkDealStatus', {
        sessionId
      });

      const responseData = this.parseToolResponse(result);

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      console.error('❌ Failed to check deal status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async acceptDeal(sessionId: string, finalTerms: any): Promise<MCPResponse> {
    this.ensureConnected();

    try {
      console.log('✅ Accepting deal:', sessionId);

      const result = await this.client!.callTool('acceptDeal', {
        sessionId,
        finalTerms
      });

      const responseData = this.parseToolResponse(result);

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      console.error('❌ Failed to accept deal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async callCustomTool(toolName: string, parameters: any): Promise<MCPResponse> {
    this.ensureConnected();

    try {
      console.log(`🔧 Calling custom tool: ${toolName}`);

      const result = await this.client!.callTool(toolName, parameters);
      const responseData = this.parseToolResponse(result);

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      console.error(`❌ Failed to call tool ${toolName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods
  private ensureConnected(): void {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client is not connected. Call connect() first.');
    }
  }

  private parseToolResponse(result: any): any {
    // MCP tool responses come wrapped in a content array
    if (result.content && Array.isArray(result.content) && result.content.length > 0) {
      const content = result.content[0];
      
      if (content.type === 'text' && content.text) {
        try {
          return JSON.parse(content.text);
        } catch (error) {
          // If not JSON, return as plain text
          return { message: content.text };
        }
      }
    }

    // Fallback to returning the raw result
    return result;
  }

  // Connection health monitoring
  async ping(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      // Try to list tools as a health check
      await this.listAvailableTools();
      return true;
    } catch (error) {
      console.warn('🏥 MCP connection health check failed:', error);
      return false;
    }
  }

  // Get connection status
  getConnectionStatus(): {
    connected: boolean;
    endpoint: string | null;
    connectedAt?: Date;
  } {
    return {
      connected: this.isConnected,
      endpoint: this.currentEndpoint,
      // Could add connection timestamp if needed
    };
  }

  // Error recovery
  async reconnect(): Promise<void> {
    if (!this.currentEndpoint) {
      throw new Error('No previous endpoint to reconnect to');
    }

    console.log('🔄 Attempting to reconnect to:', this.currentEndpoint);
    
    const endpoint = this.currentEndpoint;
    await this.disconnect();
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.connect(endpoint);
  }

  // Batch tool calls for efficiency
  async batchToolCalls(calls: Array<{ tool: string; params: any }>): Promise<MCPResponse[]> {
    this.ensureConnected();

    console.log(`📦 Executing ${calls.length} batch tool calls`);

    const results = await Promise.allSettled(
      calls.map(call => this.callCustomTool(call.tool, call.params))
    );

    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { success: false, error: result.reason?.message || 'Unknown error' }
    );
  }
}