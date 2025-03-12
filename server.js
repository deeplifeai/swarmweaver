// CommonJS module for Node.js
const path = require('path');
const dotenv = require('dotenv');
const tsconfig = require('./tsconfig.json');
const tsConfigPaths = require('tsconfig-paths');

// Load environment variables
dotenv.config();

// Register path aliases from tsconfig
const baseUrl = './'; // This must be specified
const cleanup = tsConfigPaths.register({
  baseUrl,
  paths: { '@/*': ['./src/*'] } // Add path mappings here
});

// Load ts-node programmatically
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    baseUrl: '.',
    paths: { '@/*': ['./src/*'] }
  }
});

// Import and run the actual application
try {
  require('./src/index.js');
} catch (err) {
  console.error('Error starting the application:');
  console.error(err);
  process.exit(1);
} 