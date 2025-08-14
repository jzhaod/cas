# AI Shopping Assistant - Browser Extension

A revolutionary browser extension that uses AI agents to automatically negotiate better prices on Amazon through the Model Context Protocol (MCP).

## 🚀 Features

- **AI-Powered Negotiation**: CrewAI agents negotiate with seller agents for better prices
- **Non-Intrusive Interface**: Floating UI that doesn't interfere with Amazon's design
- **Real-Time Updates**: Live negotiation status and deal notifications
- **Session Persistence**: Negotiations continue across browser restarts
- **Privacy-First**: Local processing with configurable data retention
- **Multi-LLM Support**: OpenAI, Anthropic, and local model integration

## 🏗️ Architecture

### Core Components

- **Background Service Worker**: Orchestrates negotiations and manages sessions
- **Content Scripts**: Monitor Amazon pages and inject UI elements
- **MCP Client**: Communicates with seller agents using standard protocol
- **CrewAI Integration**: AI-powered decision making and strategy
- **Discovery Service**: Finds available seller agents
- **Storage Manager**: Handles persistent data and settings

### Technology Stack

- **TypeScript**: Type-safe development
- **React**: UI components
- **Webpack**: Build system and bundling
- **MCP Protocol**: Standardized AI agent communication
- **CrewAI**: Multi-agent AI orchestration
- **IndexedDB**: Client-side storage
- **Chrome Extensions API**: Browser integration

## 📦 Installation

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ai-shopping-assistant/browser-extension.git
   cd browser-extension
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Load extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Production Build

1. **Build for production**:
   ```bash
   npm run build
   ```

2. **Create extension package**:
   ```bash
   npm run package
   ```

3. **Install packaged extension**:
   - Use the `.zip` file from the `packages` folder
   - Or load the `dist` folder directly

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server with file watching
npm run watch            # Build and watch for changes
npm run build:dev        # Development build without optimization

# Production
npm run build            # Production build
npm run package          # Create extension package

# Code Quality
npm run type-check       # TypeScript type checking
npm run lint             # ESLint code linting
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier code formatting

# Testing
npm run test             # Run unit tests
npm run test:watch       # Watch mode testing
npm run test:coverage    # Generate coverage report

# Utilities
npm run clean            # Clean build directories
npm run analyze          # Bundle size analysis
```

### Development Workflow

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Make changes to the code** - builds happen automatically

3. **Reload the extension** in Chrome after each build

4. **Test on Amazon** - browse products to trigger negotiations

### Code Structure

```
src/
├── background/          # Service worker and core logic
│   ├── service-worker.ts     # Main orchestration
│   ├── mcp-client.ts         # MCP protocol client
│   ├── crew-ai-agent.ts      # AI decision making
│   ├── discovery-client.ts   # Seller discovery
│   ├── session-manager.ts    # Session persistence
│   └── storage-manager.ts    # Data management
├── content/             # Amazon page integration
│   ├── amazon-monitor.ts     # Main content script
│   ├── product-detector.ts   # Product information extraction
│   └── ui-injector.ts        # UI element injection
├── popup/               # Extension popup interface
│   ├── popup.tsx            # Main popup app
│   └── components/          # React components
├── options/             # Settings page
├── shared/              # Shared utilities and types
│   └── types/              # TypeScript definitions
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
# API Configuration (Local Development)
DISCOVERY_API_URL=http://localhost:8002
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Development Settings
NODE_ENV=development
ENABLE_DEBUG_LOGGING=true
```

### Extension Settings

Configure through the extension popup or options page:

- **AI Provider**: OpenAI, Anthropic, or local models
- **Negotiation Rounds**: Maximum rounds per negotiation
- **Auto-Accept Threshold**: Automatically accept deals above X% savings
- **Privacy Mode**: Control data collection and retention

## 🤝 Integration

### Seller Integration

Sellers can integrate by implementing MCP servers with these tools:

```typescript
// Required MCP tools
- initiateNegotiation(productId, sessionId, buyerContext)
- makeOffer(sessionId, offerType, offerDetails)
- getProductInfo(productId, infoType)
- acceptDeal(sessionId, finalTerms)
```

### Discovery Service

Register seller endpoints:

```bash
POST /api/sellers/register
{
  "sellerName": "Your Store",
  "mcpEndpoint": "wss://your-store.com/mcp",
  "capabilities": ["initiateNegotiation", "makeOffer", "acceptDeal"],
  "specialties": ["electronics", "home_garden"]
}
```

## 🔒 Privacy & Security

### Data Handling

- **Local Processing**: All negotiations happen locally when possible
- **Minimal Data Collection**: Only essential data for negotiations
- **User Control**: Full control over data sharing and retention
- **Encryption**: All communications encrypted in transit

### Security Features

- **API Key Security**: Keys stored securely in extension storage
- **Session Validation**: All negotiation sessions validated
- **Input Sanitization**: All user inputs sanitized
- **HTTPS Only**: All external communications use HTTPS/WSS

## 📊 Monitoring

### Built-in Analytics

- **Negotiation Success Rate**: Track deal completion rates
- **Average Savings**: Monitor savings per negotiation
- **Performance Metrics**: Response times and error rates
- **User Behavior**: Anonymous usage patterns

### Debug Information

Enable debug logging in development:

```bash
# Set in .env
ENABLE_DEBUG_LOGGING=true
LOG_LEVEL=debug
```

## 🧪 Testing

### Unit Tests

```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Manual Testing

1. **Load the extension** in development mode
2. **Visit Amazon product pages** 
3. **Trigger negotiations** by showing interest in products
4. **Monitor console logs** for debug information
5. **Test different scenarios** (high-value items, different sellers)

### Test Environment

Use test seller endpoints for development:

```env
TEST_SELLER_ENDPOINT=wss://demo-seller.example.com/mcp
TEST_MODE=true
```

## 🚢 Deployment

### Chrome Web Store

1. **Build production version**:
   ```bash
   npm run build --production
   npm run package
   ```

2. **Upload to Chrome Web Store**:
   - Use the `.zip` file from `packages/` folder
   - Follow Chrome Web Store submission guidelines

3. **Update manifest** for store requirements:
   - Remove development permissions
   - Add store-specific metadata
   - Include proper icons and descriptions

### Self-Hosted Distribution

1. **Build and package**:
   ```bash
   npm run package
   ```

2. **Distribute the `.crx` file** or unpacked extension

3. **Update URLs** in manifest for auto-updates

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** and add tests
4. **Run quality checks**: `npm run lint && npm run type-check && npm run test`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open Pull Request**

### Development Guidelines

- **TypeScript**: Use strict typing
- **Code Style**: Follow ESLint and Prettier configuration
- **Testing**: Add tests for new features
- **Documentation**: Update README and inline comments
- **Performance**: Consider extension performance impact

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

### Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **Documentation**: Check README and inline code comments
- **Discussions**: Community discussions and Q&A

### Common Issues

**Extension not loading**:
- Check console for errors
- Verify manifest.json is valid
- Ensure all required files are built

**Negotiations not starting**:
- Check AI API keys in settings
- Verify discovery service connection
- Review console logs for errors

**Build failures**:
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (>=16 required)
- Verify all environment variables are set

## 🔮 Roadmap

### v1.1 - Enhanced Features
- [ ] Multi-marketplace support (eBay, Walmart)
- [ ] Advanced negotiation strategies
- [ ] Seller reputation system
- [ ] Mobile extension support

### v1.2 - AI Improvements
- [ ] Learning from negotiation outcomes
- [ ] Personalized negotiation strategies
- [ ] Predictive pricing models
- [ ] Natural language negotiation summaries

### v1.3 - Enterprise Features
- [ ] Team/organization accounts
- [ ] Bulk negotiation workflows
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations

---

**Built with ❤️ by the AI Shopping Assistant Team**