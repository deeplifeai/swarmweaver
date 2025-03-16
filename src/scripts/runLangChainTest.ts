/**
 * Simple runner for the LangChain integration test
 */

const path = require('path');
const { fork } = require('child_process');

// Set up environment for testing
process.env.NODE_ENV = 'development';

// Path to the test script
const testScript = path.join(__dirname, 'testLangChainIntegration.ts');

console.log('Starting LangChain integration test...');
console.log(`Running script: ${testScript}`);

// Run the test script using ts-node
const child = fork(testScript, [], {
  execArgv: ['-r', 'ts-node/register'],
  env: process.env
});

child.on('message', (message) => {
  console.log('Message from test:', message);
});

child.on('exit', (code) => {
  console.log(`Test script exited with code: ${code}`);
  if (code !== 0) {
    console.error('Test failed!');
    process.exit(code || 1);
  }
  console.log('Test completed successfully!');
});

child.on('error', (err) => {
  console.error('Error running test script:', err);
  process.exit(1);
}); 