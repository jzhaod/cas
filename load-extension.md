# 🚀 Quick Start - Load Extension in Chrome

## Step 1: Open Chrome Extensions Page
Navigate to: `chrome://extensions/`

## Step 2: Enable Developer Mode
Toggle the "Developer mode" switch in the top right corner

## Step 3: Load the Extension
1. Click "Load unpacked" button
2. Navigate to: `/Users/junzhao/workspace/apps/spblocker/dist`
3. Select the `dist` folder and click "Select"

## Step 4: Verify Installation
✅ Extension should appear as "Clean Amazon Search" with version 1.0.0
✅ Icon should appear in Chrome toolbar

## Step 5: Test the Extension
1. Go to Amazon.com
2. Search for any product (e.g., "laptop" or "headphones")
3. You should see:
   - Sponsored products automatically hidden
   - Badge on extension icon showing count of blocked ads
   - Clean search results without promotional content

## Step 6: Test the Popup
1. Click the extension icon in toolbar
2. You should see:
   - Toggle switch to enable/disable
   - Statistics showing ads blocked
   - Filter controls for ratings, reviews, Prime, etc.
   - Sliders work smoothly

## Quick Test URLs:
- https://www.amazon.com/s?k=laptop
- https://www.amazon.com/s?k=wireless+headphones
- https://www.amazon.com/s?k=coffee+maker
- https://www.amazon.com/s?k=yoga+mat

## If Extension Doesn't Load:
1. Check that the `dist` folder exists and contains:
   - manifest.json
   - background/service-worker.js
   - content/amazon-filter.js
   - popup/popup.html, popup.js, popup.css
   - icons folder with icons

2. Check Chrome console for errors:
   - Right-click extension icon → "Inspect popup"
   - On Amazon page → F12 → Console tab

## Success Indicators:
- ✅ No sponsored products visible when filter is on
- ✅ Statistics update in real-time
- ✅ Filters apply immediately when changed
- ✅ No console errors
- ✅ Smooth scrolling performance