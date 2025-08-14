const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: 'production', // Always use production mode for CSP compliance
  devtool: false, // Disable source maps completely for Chrome extension CSP compliance
  
  entry: {
    // Background service worker
    'background/service-worker': './src/background/service-worker-simple.ts',
    
    // Content scripts
    'content/amazon-filter': './src/content/amazon-filter.ts',
    
    // Popup
    'popup/popup': './src/popup/popup-simple.tsx',
    
    // Options page (if needed)
    'options/options': './src/options/options.tsx'
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
    // Ensure CSP compliance by disabling eval-based features
    environment: {
      dynamicImport: false,
      module: false
    },
    // Additional CSP safety settings
    crossOriginLoading: false
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@background': path.resolve(__dirname, 'src/background'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@popup': path.resolve(__dirname, 'src/popup'),
      '@options': path.resolve(__dirname, 'src/options')
    },
    fallback: {
      // Polyfills for Node.js modules
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser")
    }
  },

  module: {
    rules: [
      // TypeScript and React
      {
        test: /\.(ts|tsx)$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: isDevelopment,
              compilerOptions: {
                noEmit: false
              }
            }
          }
        ],
        exclude: /node_modules/
      },
      
      // SCSS/CSS
      {
        test: /\.(scss|css)$/,
        use: [
          MiniCssExtractPlugin.loader, // Always use MiniCssExtractPlugin for Chrome extension
          {
            loader: 'css-loader',
            options: {
              sourceMap: isDevelopment,
              modules: {
                auto: (resourcePath) => resourcePath.includes('.module.'),
                localIdentName: isDevelopment 
                  ? '[name]__[local]--[hash:base64:5]'
                  : '[hash:base64:8]'
              }
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: isDevelopment,
              postcssOptions: {
                plugins: [
                  ['autoprefixer'],
                  ...(isDevelopment ? [] : [['cssnano', { preset: 'default' }]])
                ]
              }
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: isDevelopment,
              sassOptions: {
                includePaths: [path.resolve(__dirname, 'src')]
              }
            }
          }
        ]
      },

      // Images and assets
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]'
        }
      },

      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext]'
        }
      },

      // JSON files
      {
        test: /\.json$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/data/[name][ext]'
        }
      }
    ]
  },

  plugins: [
    // Clean dist folder
    new CleanWebpackPlugin(),

    // Copy static assets
    new CopyWebpackPlugin({
      patterns: [
        // Manifest
        {
          from: 'manifest.json',
          to: 'manifest.json'
        },
        
        // HTML files
        {
          from: 'src/popup/popup.html',
          to: 'popup/popup.html'
        },
        {
          from: 'src/options/options.html',
          to: 'options/options.html'
        },

        // Content styles
        {
          from: 'src/content/overlay.css',
          to: 'content/overlay.css'
        },

        // Icons and static assets
        {
          from: 'public/icons',
          to: 'icons',
          noErrorOnMissing: true
        },
        {
          from: 'public/fonts',
          to: 'fonts',
          noErrorOnMissing: true
        },
        {
          from: 'public/images',
          to: 'images',
          noErrorOnMissing: true
        }
      ]
    }),

    // Extract CSS
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css'
    }),

    // Define environment variables - Force production mode for React to avoid eval
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'), // Always production for CSP compliance
      'process.env.VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0')
    }),

    // Development only plugins (HMR is added automatically by webpack-dev-server)
    ...(isDevelopment ? [] : []),

    // Provide Node.js globals
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ],

  optimization: {
    minimize: !isDevelopment,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: !isDevelopment,
            drop_debugger: !isDevelopment
          },
          format: {
            comments: false
          }
        },
        extractComments: false
      }),
      new CssMinimizerPlugin()
    ],
    
    // Disable code splitting for Chrome extension CSP compliance
    splitChunks: false
  },

  // Performance hints
  performance: {
    hints: isDevelopment ? false : 'warning',
    maxEntrypointSize: 1024 * 1024, // 1MB
    maxAssetSize: 1024 * 1024 // 1MB
  },

  // External dependencies (don't bundle these)
  externals: {
    // Chrome extension APIs are provided by the browser
    chrome: 'chrome'
  },

  // Development server configuration
  devServer: isDevelopment ? {
    static: {
      directory: path.resolve(__dirname, 'dist')
    },
    hot: true,
    port: 8080,
    devMiddleware: {
      writeToDisk: true // Required for extension development
    },
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  } : undefined,


  // Watch options for development
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000
  },

  // Stats configuration
  stats: {
    colors: true,
    modules: false,
    chunks: false,
    chunkModules: false,
    entrypoints: false,
    assets: isDevelopment ? false : true
  }
};