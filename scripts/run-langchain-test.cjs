#!/usr/bin/env node

/**
 * CommonJS wrapper to run the LangChain test
 * This ensures we can run the test with CommonJS even in an ESM project
 */

// Load environment variables
require('dotenv').config();

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is not set.');
  console.error('Please set it in your .env file or export it in your shell.');
  process.exit(1);
}

// Set environment for development
process.env.NODE_ENV = 'development';

console.log('Starting LangChain integration test...');

// Use require to load the test script with ts-node
require('ts-node').register({
  project: 'tsconfig.scripts.json',
  transpileOnly: true
});

// Now require the test script
try {
  require('../src/scripts/testLangChainIntegration');
  console.log('Test script loaded successfully');
} catch (error) {
  console.error('Error loading test script:', error);
  process.exit(1);
} 