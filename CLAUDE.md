# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension called "Clean Amazon Search" that provides AI-powered shopping assistance and search result filtering on Amazon. The extension uses TypeScript, React, and Chrome Extensions API v3.

## Core Architecture

### Entry Points & Build Configuration
The project uses **two parallel architectures** - a simplified version and a full-featured version:

**Simplified Architecture (Currently Active):**
- `src/background/service-worker-simple.ts` - Minimal background script
- `src/popup/popup-simple.tsx` - Basic popup UI
- Entry points defined in `webpack.config.js` lines 17, 23

**Full Architecture (Available):**
- `src/background/service-worker.ts` - Full MCP/CrewAI integration
- `src/popup/popup.tsx` - Complete dashboard UI
- Additional components: MCP client, AI agents, session management

### Key Components

**Content Scripts:**
- `src/content/amazon-filter.ts` - Main filtering logic that removes sponsored products, applies rating filters, etc.
- Comprehensive sponsored content detection with 30+ selectors
- Real-time DOM monitoring via MutationObserver
- Per-page disable functionality with persistent storage

**Background Services:**
- Service worker handles settings synchronization and extension lifecycle
- Storage management for user preferences and filtering statistics
- Cross-tab communication for real-time updates

**UI Components:**
- React-based popup with tabbed interface (Dashboard, Settings)
- `src/popup/components/Settings.tsx` - Filtering preferences UI
- TypeScript interfaces in `src/shared/types/index.ts` define all data structures

### Critical Implementation Details

**Settings Updates:**
- Amazon preferences MUST use `updateAmazonPreference(key, value)` helper function
- DO NOT use `updateSetting('amazonPreferences', {...})` as it breaks state updates
- Settings sync via Chrome storage API and real-time message passing

**Filter Application:**
- Filters apply via `display: none` CSS and `data-ai-shopping-hidden` attributes
- Multiple filter types: sponsored, rating, reviews, Prime, stock status
- Stats tracking with badge display showing hidden item counts

**Chrome Extension Compliance:**
- CSP-compliant build (no eval, no inline scripts)
- Manifest v3 service worker architecture
- Host permissions limited to Amazon domains

## Development Commands

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

## Extension Loading & Testing

1. Run `npm run build` to generate `dist/` folder
2. Load unpacked extension from `dist/` in `chrome://extensions/`
3. Test on Amazon search pages - filtering should work immediately
4. Check console logs for debugging (search filtering shows detailed logs)
5. Extension reload required after each build for testing changes

## Key Files for Common Tasks

**Modifying Filters:**
- Amazon filter logic: `src/content/amazon-filter.ts` (lines 190-415)
- UI controls: `src/popup/components/Settings.tsx` (lines 170-275)
- Type definitions: `src/shared/types/index.ts` (lines 150-160)

**Adding New Preferences:**
1. Update `AmazonPreferences` interface in types
2. Add UI control in Settings component using `updateAmazonPreference()`
3. Implement filter logic in `amazon-filter.ts` `processSearchItem()` method
4. Add to default preferences in `loadPreferences()` method

**Debugging Filter Issues:**
- Check browser console on Amazon pages for filter statistics
- Look for "🔧", "🚫", "🔍" emoji logs showing filter operations
- Verify settings save/load via Chrome storage inspection
- Test with "AI Filter" badge showing hidden item counts

## Architecture Patterns

**Message Passing:**
```typescript
// Content script to background
chrome.runtime.sendMessage({
  type: 'settings_updated',
  settings: newSettings
});

// Background to content script
chrome.tabs.sendMessage(tabId, {
  type: 'toggle_enabled',
  enabled: boolean
});
```

**Storage Pattern:**
```typescript
// Sync storage for user preferences
await chrome.storage.sync.set({ settings });

// Local storage for session data and stats
await chrome.storage.local.set({ adsBlockingStats });
```

**React State Management:**
- Local state with useState for UI components
- Settings synced via Chrome storage API
- Helper functions like `updateAmazonPreference()` for nested state updates

## Extension Architecture Switch

To switch between simplified and full architecture, modify `webpack.config.js` entry points:
- Line 17: `service-worker.ts` vs `service-worker-simple.ts`
- Line 23: `popup.tsx` vs `popup-simple.tsx`

The full architecture includes MCP (Model Context Protocol) integration, CrewAI agents, and advanced negotiation features, while the simplified version focuses on core filtering functionality.