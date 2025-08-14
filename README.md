# Clean Amazon Search - Chrome Extension

A Chrome browser extension that provides AI-powered shopping assistance and search result filtering on Amazon. Clean up your Amazon browsing experience by filtering out sponsored content, low-rated products, and unwanted items.

## 🚀 Features

- **Sponsored Content Filtering**: Automatically hide sponsored products and ads
- **Rating-Based Filtering**: Filter products by minimum star rating
- **Review Count Filtering**: Hide products with insufficient reviews
- **Prime Status Filtering**: Show only Prime eligible items
- **Stock Status Filtering**: Filter out-of-stock products
- **Real-Time Statistics**: Track how many items are filtered with badge counter
- **Per-Page Toggle**: Disable filtering on specific pages when needed

## 🏗️ Architecture

The project uses **two parallel architectures** - a simplified version (currently active) and a full-featured version:

### Current Architecture (Simplified)
- **Background Service Worker**: `service-worker-simple.ts` - Minimal background processing
- **Content Scripts**: `amazon-filter.ts` - Real-time DOM filtering with MutationObserver
- **Popup UI**: `popup-simple.tsx` - Basic settings and statistics interface
- **Storage Management**: Chrome storage API for settings sync

### Available Architecture (Full-Featured)
- **Advanced Service Worker**: `service-worker.ts` - Full MCP/CrewAI integration
- **Complete Dashboard**: `popup.tsx` - Comprehensive UI with tabbed interface
- **AI Integration**: MCP client, AI agents, session management

### Technology Stack

- **TypeScript**: Type-safe development
- **React**: UI components and popup interface
- **Webpack**: Build system and bundling
- **Chrome Extensions API v3**: Service worker architecture
- **CSS/SCSS**: Responsive styling
- **Jest**: Testing framework

## 📦 Installation

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jzhaod/cas.git
   cd cas
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development build**:
   ```bash
   npm run dev
   ```

4. **Load extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder
   - Extension should now appear in your browser

5. **Test on Amazon**:
   - Visit any Amazon search page
   - Filtering should work immediately
   - Check extension badge for filtered item count

### Production Build

1. **Build for production**:
   ```bash
   npm run build
   ```

2. **Create extension package**:
   ```bash
   npm run package
   ```

3. **Load the extension**:
   - Use the generated `dist` folder for unpacked loading
   - Or use the `.zip` file for distribution

## 🛠️ Development

### Available Scripts

```bash
# Development workflow
npm run dev              # Development build with file watching
npm run build            # Production build for extension loading
npm run build:dev        # Development build without optimization

# Code quality
npm run type-check       # TypeScript validation
npm run lint             # ESLint checking
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier formatting

# Testing
npm run test             # Run Jest unit tests
npm run test:watch       # Jest watch mode
npm run test:coverage    # Generate coverage report

# Extension packaging
npm run package          # Create .zip for Chrome Web Store
```

### Development Workflow

1. **Start the development build**:
   ```bash
   npm run dev
   ```

2. **Make changes to the code** - builds happen automatically

3. **Reload the extension** in Chrome after each build

4. **Test on Amazon** - visit Amazon search pages to see filtering in action

5. **Check the console** - look for filter statistics and debugging info

### Code Structure

```
src/
├── background/              # Service worker implementations
│   ├── service-worker-simple.ts    # Current: minimal background processing
│   ├── service-worker.ts           # Full: MCP/CrewAI integration
│   ├── mcp-client.ts              # MCP protocol client
│   ├── crew-ai-agent.ts           # AI decision making
│   └── storage-manager.ts         # Settings and data management
├── content/                 # Amazon page integration
│   ├── amazon-filter.ts           # Main filtering logic with DOM monitoring
│   ├── amazon-monitor.ts          # Page monitoring (unused in simple)
│   ├── product-detector.ts        # Product information extraction
│   └── ui-injector.ts             # UI element injection
├── popup/                   # Extension popup interface
│   ├── popup-simple.tsx           # Current: basic UI with settings
│   ├── popup.tsx                  # Full: comprehensive dashboard
│   └── components/                # React components (Settings, Dashboard)
├── shared/                  # Shared utilities and types
│   └── types/index.ts             # TypeScript definitions
├── options/                 # Extension options page (optional)
└── public/                  # Static assets and icons
```

## 🔧 Configuration

### Extension Settings

Configure through the extension popup interface:

- **Sponsored Content Filtering**: Hide sponsored products and ads
- **Minimum Star Rating**: Filter products below specified rating (1-5 stars)
- **Minimum Review Count**: Hide products with insufficient reviews
- **Prime Only**: Show only Prime eligible items
- **Hide Out of Stock**: Filter unavailable products
- **Per-Page Toggle**: Disable filtering on specific Amazon pages

### Architecture Switching

To switch between simplified and full architecture, modify `webpack.config.js` entry points:
```javascript
// Lines 17 & 23 - Switch between architectures
entry: {
  'service-worker': './src/background/service-worker-simple.ts',  // or service-worker.ts
  popup: './src/popup/popup-simple.tsx',                        // or popup.tsx
}
```

### Storage

- **Chrome Sync Storage**: User preferences synced across devices
- **Chrome Local Storage**: Session data and statistics
- **Settings Helper**: Use `updateAmazonPreference(key, value)` for nested updates

## 🔍 How It Works

### Filter Detection

The extension uses comprehensive selectors to detect and hide:

```typescript
// Sponsored content detection (30+ selectors)
const sponsoredSelectors = [
  '[data-component-type="sp-sponsored-result"]',
  '.AdHolder',
  '.s-sponsored-list-item',
  // ... and many more
];

// Product information extraction
const extractProductInfo = (element) => ({
  rating: parseFloat(element.querySelector('.a-icon-alt')?.textContent),
  reviewCount: parseInt(element.querySelector('.a-size-base')?.textContent),
  primeEligible: !!element.querySelector('.a-icon-prime'),
  inStock: !element.querySelector('.a-color-state.a-text-bold')
});
```

### Real-Time Monitoring

- **MutationObserver**: Watches for new content and applies filters instantly
- **Badge Updates**: Shows filtered item count in extension badge
- **Statistics Tracking**: Logs filtering activity for debugging

## 🔒 Privacy & Security

### Data Handling

- **Local Processing**: All filtering happens locally in the browser
- **No External Requests**: No data sent to external servers
- **Minimal Storage**: Only user preferences and anonymous statistics
- **Chrome Storage**: Uses Chrome's secure storage APIs

### Security Features

- **Content Security Policy**: CSP-compliant build with no eval or inline scripts
- **Manifest v3**: Uses latest Chrome extension architecture
- **Host Permissions**: Limited to Amazon domains only
- **Input Sanitization**: All DOM interactions sanitized

## 📊 Monitoring & Debugging

### Built-in Statistics

- **Badge Counter**: Shows number of filtered items on current page
- **Filter Statistics**: Tracks what types of items are being hidden
- **Console Logging**: Detailed filtering activity in browser console
- **Performance Metrics**: Filter processing time and efficiency

### Debug Information

Check browser console on Amazon pages for detailed logs:

```javascript
// Look for these log prefixes
🔧 Filter: Item processing information
🚫 Hidden: Items that were filtered out  
🔍 Stats: Filtering statistics and counts
⚡ Performance: Processing time metrics
```

## 🧪 Testing

### Unit Tests

```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Manual Testing

1. **Load the extension** in development mode (`npm run build` → load `dist/` folder)
2. **Visit Amazon search pages** (e.g., search for "laptops")
3. **Check filtering** - sponsored items should be hidden automatically
4. **Adjust settings** - change rating filter and see results update
5. **Monitor console** - look for filter statistics and debug information
6. **Test badge counter** - extension badge should show number of hidden items

### Testing Specific Features

- **Sponsored filtering**: Search for popular items, check for sponsored content removal
- **Rating filter**: Set minimum 4+ stars, verify low-rated items are hidden
- **Prime filter**: Enable Prime-only, check non-Prime items are filtered
- **Per-page toggle**: Disable filtering on a page, verify items reappear

## 🚢 Deployment

### Chrome Web Store

1. **Build production version**:
   ```bash
   npm run build
   npm run package
   ```

2. **Prepare for submission**:
   - Use the `.zip` file generated by `npm run package`
   - Ensure all required icons are present in `public/icons/`
   - Verify manifest.json has proper descriptions and permissions

3. **Chrome Web Store submission**:
   - Create developer account at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - Upload the packaged extension
   - Fill out store listing with screenshots and descriptions
   - Submit for review

### Development Distribution

1. **Build for local testing**:
   ```bash
   npm run build
   ```

2. **Share unpacked extension**:
   - Share the `dist/` folder
   - Users load via "Load unpacked" in developer mode

### Key Files for Distribution
- `manifest.json` - Extension metadata and permissions
- `public/icons/` - Extension icons (16, 32, 48, 128px)
- `dist/` - Compiled extension files

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-filter`
3. **Make changes** and add tests
4. **Run quality checks**: `npm run lint && npm run type-check && npm run test`
5. **Commit changes**: `git commit -m 'Add new filter feature'`
6. **Push to branch**: `git push origin feature/new-filter`
7. **Open Pull Request**

### Development Guidelines

- **TypeScript**: Use strict typing for all components
- **Code Style**: Follow ESLint and Prettier configuration
- **Testing**: Add tests for filtering logic and UI components
- **Documentation**: Update README and add inline comments
- **Performance**: Minimize DOM queries and optimize filter processing
- **Settings**: Use `updateAmazonPreference()` helper for settings updates

## 🙋‍♂️ Support

### Getting Help

- **GitHub Issues**: Bug reports and feature requests at [github.com/jzhaod/cas](https://github.com/jzhaod/cas)
- **Documentation**: Check README and CLAUDE.md for implementation details
- **Console Debugging**: Check browser console for filtering debug information

### Common Issues

**Extension not loading**:
- Run `npm run build` to generate `dist/` folder
- Check that all files are present in `dist/`
- Verify manifest.json is valid JSON
- Enable Developer mode in Chrome extensions

**Filtering not working**:
- Check browser console for error messages
- Verify you're on Amazon search or product pages
- Try refreshing the page after changing settings
- Check if extension badge shows filtered item count

**Settings not saving**:
- Use `updateAmazonPreference(key, value)` helper function
- Avoid using `updateSetting('amazonPreferences', {...})`
- Check Chrome storage permissions in manifest

**Build failures**:
- Clear cache: `rm -rf node_modules && npm install`
- Check Node.js version (>=16 required)
- Verify TypeScript compilation: `npm run type-check`

## 🔮 Roadmap

### v1.1 - Enhanced Filtering
- [ ] Price range filtering
- [ ] Brand filtering with whitelist/blacklist
- [ ] Seller rating filtering
- [ ] Shipping speed filtering

### v1.2 - UI Improvements
- [ ] Visual filter indicators on Amazon pages
- [ ] Advanced settings with presets
- [ ] Better mobile extension support
- [ ] Dark mode for popup interface

### v1.3 - Advanced Features
- [ ] Multi-marketplace support (eBay, Walmart)
- [ ] Wishlist integration
- [ ] Price tracking and alerts
- [ ] Export filtering statistics

---

**Built with ❤️ for cleaner Amazon browsing**