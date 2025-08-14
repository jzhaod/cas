# Testing Guide for Clean Amazon Search Extension

## Installation Steps

1. **Load the Extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project
   - The extension should appear with the name "Clean Amazon Search"

## Test Scenarios

### 1. Basic Functionality Test
- **URL**: https://www.amazon.com/s?k=laptop
- **Expected Results**:
  - Sponsored products should be hidden immediately
  - Badge should show count of blocked ads
  - Clean search results without promotional content

### 2. Filter Controls Test
- Click the extension icon to open popup
- **Test each filter:**
  - ✅ **Hide Sponsored Products**: Toggle on/off, verify sponsored items appear/disappear
  - ✅ **Prime Only**: Enable to show only Prime-eligible items
  - ✅ **Hide Out of Stock**: Enable to remove unavailable items
  - ✅ **Min Rating**: Slide to 4 stars, verify only 4+ star items show
  - ✅ **Min Reviews**: Set to 100, verify only well-reviewed items show

### 3. Different Search Categories
Test on various Amazon searches:
- Electronics: `https://www.amazon.com/s?k=headphones`
- Books: `https://www.amazon.com/s?k=javascript+books`
- Home & Kitchen: `https://www.amazon.com/s?k=coffee+maker`
- Clothing: `https://www.amazon.com/s?k=mens+shirts`

### 4. Dynamic Content Test
- Scroll down to load more results
- Click "Next page" 
- Verify filters still work on new content

### 5. Statistics Verification
- Check popup shows:
  - Total ads blocked (cumulative)
  - Current page ads blocked
- Verify numbers update as you browse

### 6. Page-Specific Disable
- Click "Disable on This Page" button
- Verify all filters are removed
- Refresh page - setting should persist
- Click "Enable on This Page" to re-enable

## What to Look For

### ✅ **Working Correctly:**
- Sponsored banners removed
- Sponsored products hidden
- "Brands related to your search" sections removed
- "Customers frequently viewed" sections removed
- Shopping advisor sections removed
- Inline ads between results removed

### ⚠️ **Potential Issues:**
- Page layout shifts (should be minimal)
- Legitimate products hidden by mistake
- Performance lag on scroll
- Filters not applying to new content

## Console Debugging

Open Chrome DevTools (F12) and check Console for:
```javascript
// Look for these log messages:
"🔧 Amazon Filter: Initializing content filters"
"🚫 Hidden sponsored content: [selector]"
"🚫 Hidden promotional section"
"🔍 Looking for disguised ads..."
```

## Performance Check

1. Open Chrome DevTools → Performance tab
2. Start recording
3. Scroll through search results
4. Stop recording
5. Check for:
   - Scripting time < 50ms per scroll
   - No layout thrashing
   - Smooth 60fps scrolling

## Report Issues

If you find any issues, note:
1. The specific Amazon URL
2. What filter settings were active
3. What went wrong
4. Any console errors
5. Screenshot if possible

## Quick Fixes

If extension isn't working:
1. Reload the extension in `chrome://extensions/`
2. Refresh the Amazon page
3. Check if JavaScript is enabled
4. Verify you're on a supported Amazon domain (.com, .ca, .co.uk, etc.)

---

## Success Criteria

The extension is working properly if:
- [ ] All sponsored content is hidden when filter is on
- [ ] Rating/review filters work correctly
- [ ] Statistics update accurately
- [ ] No performance issues during scrolling
- [ ] Settings persist between sessions
- [ ] Page-specific disable works
- [ ] No console errors
- [ ] Clean, uncluttered search results