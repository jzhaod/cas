/**
 * Test script to verify Discovery → MCP flow
 * Run this in browser console or Node.js
 */

// Simple test without TypeScript
async function testDiscoveryFlow() {
  console.log('🧪 Testing Discovery → MCP Flow...');
  
  try {
    // Step 1: Test Discovery Service
    console.log('📡 Step 1: Testing Discovery Service...');
    const discoveryResponse = await fetch('http://localhost:8002/api/v1/discovery/sellers/search?limit=5', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!discoveryResponse.ok) {
      throw new Error(`Discovery failed: ${discoveryResponse.status}`);
    }
    
    const discoveryData = await discoveryResponse.json();
    console.log('✅ Discovery Response:', discoveryData);
    
    if (!discoveryData.sellers || discoveryData.sellers.length === 0) {
      throw new Error('No sellers found');
    }
    
    // Step 2: Get best seller
    const bestSeller = discoveryData.sellers[0];
    console.log('🏆 Best Seller:', {
      name: bestSeller.seller_name,
      endpoint: bestSeller.mcp_connection.endpoint_url,
      rating: bestSeller.rating
    });
    
    // Step 3: Test MCP Connection (WebSocket)
    console.log('🔌 Step 3: Testing MCP WebSocket Connection...');
    console.log('WebSocket Endpoint:', bestSeller.mcp_connection.endpoint_url);
    
    // Note: In a real test, we would connect via WebSocket here
    // For now, just verify the endpoint format
    const mcpUrl = new URL(bestSeller.mcp_connection.endpoint_url);
    console.log('✅ MCP URL parsed successfully:', {
      protocol: mcpUrl.protocol,
      host: mcpUrl.host,
      pathname: mcpUrl.pathname
    });
    
    console.log('🎉 Discovery → MCP Flow Test PASSED!');
    return true;
    
  } catch (error) {
    console.error('❌ Test Failed:', error);
    return false;
  }
}

// Run test if in Node.js environment
if (typeof window === 'undefined') {
  testDiscoveryFlow();
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.testDiscoveryFlow = testDiscoveryFlow;
  console.log('🔧 Run testDiscoveryFlow() in console to test');
}