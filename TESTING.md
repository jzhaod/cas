# AI Shopping Assistant - Testing Guide

## 🧪 End-to-End Testing

### Prerequisites ✅
- [x] Discovery Server running on port 8002 
- [x] MCP Server running on port 8005
- [x] Browser extension built in `/dist` folder

### Testing Steps

## 1. Load Extension in Chrome

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer Mode** (toggle in top right)
3. **Click "Load unpacked"**
4. **Select the `dist` folder**: `/Users/junzhao/workspace/apps/browser/browser-extension/dist`
5. **Verify extension loaded** - should see "AI Shopping Assistant" in extensions list

## 2. Test Discovery Flow

### Method A: Browser Console Test
1. Open any webpage
2. Open Developer Tools (F12)  
3. In Console, run:
```javascript
// Test discovery service directly
fetch('http://localhost:8002/api/v1/discovery/sellers/search?limit=5')
  .then(r => r.json())
  .then(d => console.log('Sellers found:', d.sellers.length, d.sellers[0]));
```

### Method B: Extension Popup Test
1. **Click the extension icon** in Chrome toolbar
2. **Open Developer Tools** on the popup window
3. **Check Console** for discovery logs like:
   - `🔍 Discovery Client initialized`
   - `📡 Finding sellers...`

## 3. Test Amazon Integration

1. **Navigate to an Amazon product page**, e.g.:
   - https://amazon.com/dp/B08N5WRWNW (Echo Dot example)
   - https://amazon.com/dp/B0B7BP6CJN (iPad example)

2. **Open Extension Popup** - should show:
   - Product detected
   - "Start Negotiation" button
   - Current product info

3. **Click "Start Negotiation"** - should see:
   - Status: "Negotiating..."
   - Console logs showing discovery → MCP flow
   - Notification when complete

## 4. Test Notification System

### Test Notifications
1. **Click extension icon** 
2. **Open Settings** → **Notification Settings**
3. **Click "Test Notification"** - should see Chrome notification
4. **Test different notification types**:
   - Deal completed
   - Negotiation failed
   - Offer received

### Test Notification Preferences
1. **Disable specific notification types**
2. **Set quiet hours**
3. **Test rate limiting**

## 5. Test Complete Negotiation Flow

1. **Go to Amazon product page**
2. **Click extension** → **Start Negotiation**
3. **Monitor console for logs**:
   ```
   🔍 Discovering sellers for: [Product Name]
   📡 API Request: http://localhost:8002/api/v1/discovery/sellers/search...
   ✅ Found 1 matching sellers
   🤝 Negotiating with seller: AI Shopping Assistant
   🔌 Connecting to MCP: http://localhost:8005/mcp
   ```
4. **Check for notifications**
5. **Verify final result** in popup

## 6. Expected Test Results

### ✅ Success Indicators:
- Extension loads without errors
- Discovery service returns sellers
- MCP connection established  
- Negotiations complete (even if mock)
- Notifications appear
- No console errors

### ⚠️ Known Limitations:
- Mock negotiation data (until real sellers are integrated)
- Limited to localhost testing
- MCP WebSocket may timeout (expected for testing)

## 7. Troubleshooting

### Common Issues:

**Extension won't load:**
- Check manifest.json syntax
- Verify all files in dist folder
- Check Chrome console for errors

**Discovery fails:**
- Verify backend server running on 8002
- Check CORS settings
- Test API endpoint directly with curl

**MCP connection fails:**
- Verify MCP server running on 8005
- Check WebSocket endpoint
- Look for connection timeouts (expected in testing)

**No notifications:**
- Check Chrome notification permissions
- Verify extension permissions in manifest
- Test with simple notification first

## 8. Debug Console Commands

Open extension popup → F12 → Console:

```javascript
// Test discovery directly
chrome.runtime.sendMessage({
  type: 'start_negotiation', 
  productId: 'test-123',
  productInfo: { name: 'Test Product', price: 100 }
});

// Test notification
chrome.runtime.sendMessage({
  type: 'TEST_NOTIFICATION',
  event: 'deal_completed',
  context: { productName: 'Test', savings: 25 }
});

// Check active sessions
chrome.runtime.sendMessage({type: 'get_active_deals'}, (response) => {
  console.log('Active deals:', response.deals);
});
```

## 9. Production Testing Checklist

- [ ] Extension loads in Chrome
- [ ] Discovery service accessible 
- [ ] Amazon product detection works
- [ ] Negotiation flow completes
- [ ] Notifications display correctly
- [ ] Settings save properly
- [ ] Error handling works
- [ ] Performance acceptable

---

**Ready to test!** 🚀

Load the extension and try the flow on a real Amazon product page!