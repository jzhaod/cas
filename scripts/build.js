#!/usr/bin/env node

const path = require('path');
const webpack = require('webpack');
const fs = require('fs').promises;
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
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, colors.cyan);
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

async function checkDependencies() {
  logStep('DEPS', 'Checking dependencies...');
  
  try {
    // Check if node_modules exists
    await fs.access(path.join(__dirname, '..', 'node_modules'));
    logSuccess('Dependencies are installed');
  } catch (error) {
    logError('Dependencies not installed. Please run: npm install');
    process.exit(1);
  }
}

async function typeCheck() {
  logStep('TYPE', 'Running TypeScript type checking...');
  
  try {
    execSync('npm run type-check', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    logSuccess('TypeScript type checking passed');
  } catch (error) {
    logError('TypeScript type checking failed');
    process.exit(1);
  }
}

async function lint() {
  logStep('LINT', 'Running ESLint...');
  
  try {
    execSync('npm run lint', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    logSuccess('Linting passed');
  } catch (error) {
    logWarning('Linting issues found. Run `npm run lint:fix` to auto-fix');
    // Don't exit on lint errors in build, just warn
  }
}

async function runWebpack(mode = 'production') {
  logStep('BUILD', `Building extension in ${mode} mode...`);
  
  return new Promise((resolve, reject) => {
    const webpackConfig = require('../webpack.config.js');
    
    // Override mode
    webpackConfig.mode = mode;
    
    const compiler = webpack(webpackConfig);
    
    compiler.run((err, stats) => {
      if (err) {
        logError('Webpack compilation failed:');
        console.error(err);
        reject(err);
        return;
      }
      
      if (stats.hasErrors()) {
        logError('Build completed with errors:');
        console.log(stats.toString({
          colors: true,
          chunks: false,
          modules: false
        }));
        reject(new Error('Build errors'));
        return;
      }
      
      if (stats.hasWarnings()) {
        logWarning('Build completed with warnings:');
        console.log(stats.toString({
          colors: true,
          chunks: false,
          modules: false,
          warnings: true
        }));
      }
      
      logSuccess(`Build completed in ${mode} mode`);
      
      // Log build stats
      const { time, assets } = stats.toJson();
      log(`Build time: ${time}ms`, colors.blue);
      log(`Assets generated: ${assets.length}`, colors.blue);
      
      resolve(stats);
    });
  });
}

async function validateBuild() {
  logStep('VALIDATE', 'Validating build output...');
  
  const distPath = path.join(__dirname, '..', 'dist');
  const manifestPath = path.join(distPath, 'manifest.json');
  
  try {
    // Check if dist directory exists
    await fs.access(distPath);
    
    // Check if manifest.json exists
    await fs.access(manifestPath);
    
    // Validate manifest.json
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    // Basic manifest validation
    const requiredFields = ['name', 'version', 'manifest_version'];
    for (const field of requiredFields) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in manifest: ${field}`);
      }
    }
    
    // Check if main files exist
    const requiredFiles = [
      'background/service-worker.js',
      'content/amazon-monitor.js',
      'popup/popup.js',
      'popup/popup.html'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(distPath, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    logSuccess('Build validation passed');
    
    // Log build size info
    const stats = await fs.stat(distPath);
    log(`Build output directory size: ~${Math.round(stats.size / 1024)}KB`, colors.blue);
    
  } catch (error) {
    logError(`Build validation failed: ${error.message}`);
    process.exit(1);
  }
}

async function createPackage() {
  logStep('PACKAGE', 'Creating extension package...');
  
  try {
    const packagesDir = path.join(__dirname, '..', 'packages');
    
    // Create packages directory if it doesn't exist
    try {
      await fs.access(packagesDir);
    } catch {
      await fs.mkdir(packagesDir, { recursive: true });
    }
    
    // Run web-ext build
    execSync('npm run package:extension', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    logSuccess('Extension package created');
    
    // List created packages
    const packageFiles = await fs.readdir(packagesDir);
    if (packageFiles.length > 0) {
      log(`Package files:`, colors.blue);
      packageFiles.forEach(file => {
        log(`  - ${file}`, colors.blue);
      });
    }
    
  } catch (error) {
    logError(`Package creation failed: ${error.message}`);
    // Don't exit on package error, build is still successful
  }
}

async function generateBuildReport() {
  logStep('REPORT', 'Generating build report...');
  
  try {
    const distPath = path.join(__dirname, '..', 'dist');
    const reportPath = path.join(__dirname, '..', 'build-report.json');
    
    // Get all files in dist directory
    async function getDirectorySize(dir) {
      const files = await fs.readdir(dir, { withFileTypes: true });
      let size = 0;
      
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          size += await getDirectorySize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          size += stats.size;
        }
      }
      
      return size;
    }
    
    const totalSize = await getDirectorySize(distPath);
    
    const report = {
      timestamp: new Date().toISOString(),
      buildMode: process.env.NODE_ENV || 'production',
      totalSizeBytes: totalSize,
      totalSizeKB: Math.round(totalSize / 1024),
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      nodeVersion: process.version,
      npmVersion: execSync('npm --version', { encoding: 'utf8' }).trim()
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    logSuccess(`Build report generated: ${path.relative(process.cwd(), reportPath)}`);
    log(`Total build size: ${report.totalSizeKB}KB`, colors.blue);
    
  } catch (error) {
    logWarning(`Could not generate build report: ${error.message}`);
  }
}

// Main build function
async function build() {
  const startTime = Date.now();
  
  log('🚀 Starting AI Shopping Assistant build process...', colors.bright);
  log('═══════════════════════════════════════════════════', colors.bright);
  
  try {
    // Get build mode from command line arguments
    const mode = process.argv.includes('--dev') ? 'development' : 'production';
    const skipTypeCheck = process.argv.includes('--skip-type-check');
    const skipLint = process.argv.includes('--skip-lint');
    const createPkg = process.argv.includes('--package');
    
    // Run build steps
    await checkDependencies();
    
    if (!skipTypeCheck) {
      await typeCheck();
    } else {
      logWarning('Skipping TypeScript type checking');
    }
    
    if (!skipLint) {
      await lint();
    } else {
      logWarning('Skipping linting');
    }
    
    await runWebpack(mode);
    await validateBuild();
    await generateBuildReport();
    
    if (createPkg) {
      await createPackage();
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    log('═══════════════════════════════════════════════════', colors.bright);
    logSuccess(`Build completed successfully in ${duration}s`);
    log('🎉 Extension is ready for testing or deployment!', colors.bright);
    
    // Show next steps
    log('\nNext steps:', colors.cyan);
    log('1. Load the extension in Chrome:', colors.reset);
    log('   - Open chrome://extensions/', colors.reset);
    log('   - Enable "Developer mode"', colors.reset);
    log('   - Click "Load unpacked" and select the "dist" folder', colors.reset);
    
    if (createPkg) {
      log('2. Or install the packaged extension from the "packages" folder', colors.reset);
    }
    
  } catch (error) {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    log('═══════════════════════════════════════════════════', colors.bright);
    logError(`Build failed after ${duration}s`);
    logError(error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n👋 Build cancelled by user', colors.yellow);
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n⚠️ Build terminated', colors.yellow);
  process.exit(0);
});

// Run build
if (require.main === module) {
  build().catch(error => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { build, runWebpack, validateBuild };