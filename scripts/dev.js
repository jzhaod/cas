#!/usr/bin/env node

const path = require('path');
const webpack = require('webpack');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

class ExtensionDevServer {
  constructor() {
    this.compiler = null;
    this.isBuilding = false;
    this.buildQueue = false;
    this.watchers = new Map();
    this.lastBuildTime = 0;
    this.buildStats = {
      successful: 0,
      failed: 0,
      warnings: 0
    };
  }

  async start() {
    log('🚀 Starting AI Shopping Assistant development server...', colors.bright);
    log('═══════════════════════════════════════════════════', colors.bright);

    try {
      await this.checkDependencies();
      await this.setupWebpack();
      await this.setupFileWatcher();
      await this.initialBuild();
      this.showInstructions();
      this.setupProcessHandlers();
    } catch (error) {
      logError(`Failed to start development server: ${error.message}`);
      process.exit(1);
    }
  }

  async checkDependencies() {
    logInfo('Checking dependencies...');
    
    try {
      await fs.access(path.join(__dirname, '..', 'node_modules'));
      logSuccess('Dependencies are installed');
    } catch (error) {
      logError('Dependencies not installed. Please run: npm install');
      process.exit(1);
    }
  }

  async setupWebpack() {
    logInfo('Setting up Webpack compiler...');
    
    const webpackConfig = require('../webpack.config.js');
    
    // Override for development
    webpackConfig.mode = 'development';
    webpackConfig.watch = true;
    webpackConfig.watchOptions = {
      ignored: /node_modules/,
      aggregateTimeout: 300,
      poll: false
    };

    // Add development plugins
    webpackConfig.plugins = webpackConfig.plugins || [];
    webpackConfig.plugins.push(
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.DEV_SERVER': JSON.stringify('true')
      })
    );

    this.compiler = webpack(webpackConfig);
    logSuccess('Webpack compiler configured');
  }

  async setupFileWatcher() {
    logInfo('Setting up file watchers...');

    // Watch for manifest changes
    const manifestWatcher = chokidar.watch('./manifest.json', {
      cwd: path.join(__dirname, '..'),
      ignoreInitial: true
    });

    manifestWatcher.on('change', () => {
      logInfo('Manifest file changed, rebuilding...');
      this.triggerBuild();
    });

    // Watch for HTML changes
    const htmlWatcher = chokidar.watch('./src/**/*.html', {
      cwd: path.join(__dirname, '..'),
      ignoreInitial: true
    });

    htmlWatcher.on('change', (filePath) => {
      logInfo(`HTML file changed: ${filePath}`);
      this.copyStaticFiles();
    });

    // Watch for public assets
    const assetsWatcher = chokidar.watch('./public/**/*', {
      cwd: path.join(__dirname, '..'),
      ignoreInitial: true
    });

    assetsWatcher.on('change', (filePath) => {
      logInfo(`Asset file changed: ${filePath}`);
      this.copyStaticFiles();
    });

    this.watchers.set('manifest', manifestWatcher);
    this.watchers.set('html', htmlWatcher);
    this.watchers.set('assets', assetsWatcher);

    logSuccess('File watchers configured');
  }

  async initialBuild() {
    logInfo('Performing initial build...');
    return this.build();
  }

  async build() {
    if (this.isBuilding) {
      this.buildQueue = true;
      return;
    }

    this.isBuilding = true;
    const buildStartTime = Date.now();

    try {
      await new Promise((resolve, reject) => {
        this.compiler.run((err, stats) => {
          if (err) {
            this.buildStats.failed++;
            logError('Build failed:');
            console.error(err);
            reject(err);
            return;
          }

          if (stats.hasErrors()) {
            this.buildStats.failed++;
            logError('Build completed with errors:');
            console.log(stats.toString({
              colors: true,
              chunks: false,
              modules: false,
              errors: true,
              warnings: false
            }));
            reject(new Error('Build errors'));
            return;
          }

          if (stats.hasWarnings()) {
            this.buildStats.warnings++;
            logWarning('Build completed with warnings:');
            console.log(stats.toString({
              colors: true,
              chunks: false,
              modules: false,
              errors: false,
              warnings: true
            }));
          }

          const buildTime = Date.now() - buildStartTime;
          this.lastBuildTime = buildTime;
          this.buildStats.successful++;

          logSuccess(`Build completed in ${buildTime}ms`);
          this.showBuildStats();
          resolve();
        });
      });

      await this.copyStaticFiles();
      await this.validateBuild();

    } catch (error) {
      logError(`Build failed: ${error.message}`);
    } finally {
      this.isBuilding = false;

      // Process queued build if any
      if (this.buildQueue) {
        this.buildQueue = false;
        setTimeout(() => this.build(), 100);
      }
    }
  }

  async copyStaticFiles() {
    try {
      const { execSync } = require('child_process');
      execSync('npm run build:dev', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      logWarning('Failed to copy static files');
    }
  }

  async validateBuild() {
    try {
      const distPath = path.join(__dirname, '..', 'dist');
      await fs.access(distPath);
      
      const manifestPath = path.join(distPath, 'manifest.json');
      await fs.access(manifestPath);
      
      // Quick validation
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      if (!manifest.name || !manifest.version) {
        throw new Error('Invalid manifest file');
      }

    } catch (error) {
      logWarning(`Build validation warning: ${error.message}`);
    }
  }

  triggerBuild() {
    if (!this.isBuilding) {
      setTimeout(() => this.build(), 300); // Debounce builds
    } else {
      this.buildQueue = true;
    }
  }

  showBuildStats() {
    const stats = this.buildStats;
    log(`📊 Build Stats: ${stats.successful} successful, ${stats.failed} failed, ${stats.warnings} with warnings`, colors.blue);
  }

  showInstructions() {
    log('═══════════════════════════════════════════════════', colors.bright);
    logSuccess('Development server is running!');
    log('');
    log('📁 Extension files are in: ./dist', colors.cyan);
    log('');
    log('🔧 To load extension in Chrome:', colors.cyan);
    log('  1. Open chrome://extensions/', colors.reset);
    log('  2. Enable "Developer mode"', colors.reset);
    log('  3. Click "Load unpacked"', colors.reset);
    log('  4. Select the "dist" folder', colors.reset);
    log('');
    log('🔄 Auto-reload:', colors.cyan);
    log('  • Code changes trigger automatic rebuilds', colors.reset);
    log('  • Reload the extension after each build', colors.reset);
    log('  • Use Ctrl+R on extension pages to see changes', colors.reset);
    log('');
    log('📝 Development commands:', colors.cyan);
    log('  • Ctrl+C: Stop development server', colors.reset);
    log('  • npm run lint: Check code quality', colors.reset);
    log('  • npm run type-check: Validate TypeScript', colors.reset);
    log('');
    log('═══════════════════════════════════════════════════', colors.bright);
    log('👀 Watching for changes...', colors.green);
  }

  setupProcessHandlers() {
    process.on('SIGINT', () => {
      log('');
      log('🛑 Shutting down development server...', colors.yellow);
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      log('⚠️  Development server terminated', colors.yellow);
      this.cleanup();
      process.exit(0);
    });
  }

  cleanup() {
    // Close all file watchers
    for (const [name, watcher] of this.watchers) {
      try {
        watcher.close();
        logInfo(`Closed ${name} watcher`);
      } catch (error) {
        logWarning(`Failed to close ${name} watcher: ${error.message}`);
      }
    }

    // Close webpack compiler
    if (this.compiler) {
      try {
        this.compiler.close(() => {
          logInfo('Webpack compiler closed');
        });
      } catch (error) {
        logWarning(`Failed to close webpack compiler: ${error.message}`);
      }
    }

    logSuccess('Development server cleanup completed');
  }
}

// Enhanced watch mode with Webpack
class WebpackWatcher {
  constructor(compiler) {
    this.compiler = compiler;
    this.watching = null;
  }

  start() {
    const watchOptions = {
      aggregateTimeout: 300,
      poll: false,
      ignored: /node_modules/
    };

    this.watching = this.compiler.watch(watchOptions, (err, stats) => {
      if (err) {
        logError('Webpack watch error:');
        console.error(err);
        return;
      }

      if (stats.hasErrors()) {
        logError('Build errors:');
        console.log(stats.toString({
          colors: true,
          chunks: false,
          modules: false,
          errors: true,
          warnings: false
        }));
        return;
      }

      if (stats.hasWarnings()) {
        logWarning('Build warnings:');
        console.log(stats.toString({
          colors: true,
          chunks: false,
          modules: false,
          errors: false,
          warnings: true
        }));
      }

      const { time } = stats.toJson();
      logSuccess(`Rebuild completed in ${time}ms`);
      
      // Notify about extension reload
      log('🔄 Extension updated! Reload it in chrome://extensions/', colors.cyan);
    });
  }

  stop() {
    if (this.watching) {
      this.watching.close(() => {
        logInfo('Webpack watcher stopped');
      });
    }
  }
}

// Main function
async function startDev() {
  const devServer = new ExtensionDevServer();
  await devServer.start();
}

// Handle command line arguments
const args = process.argv.slice(2);
const enableHotReload = args.includes('--hot');
const skipTypeCheck = args.includes('--skip-type-check');

if (skipTypeCheck) {
  logWarning('Skipping TypeScript type checking in development mode');
}

if (enableHotReload) {
  logInfo('Hot reload enabled (experimental)');
}

// Start development server
if (require.main === module) {
  startDev().catch(error => {
    logError(`Failed to start development server: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { ExtensionDevServer, WebpackWatcher };