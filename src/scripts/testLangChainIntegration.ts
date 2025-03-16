const { createLangChainExecutor, runWithLangChain } = require('../services/ai/LangChainIntegration');
const { FunctionRegistry } = require('../services/ai/FunctionRegistry');
const { AgentRole } = require('../types/agents/Agent');
const { config } = require('../config/config');

/**
 * A simple test script to demonstrate the LangChain integration
 */
async function testLangChainIntegration() {
  console.log('Testing LangChain Integration...');
  
  // Create a simple function registry with test functions
  const functionRegistry = new FunctionRegistry();
  
  // Register some test functions
  functionRegistry.register({
    name: 'getCurrentTime',
    description: 'Get the current time',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: async () => {
      return { time: new Date().toISOString() };
    }
  });
  
  functionRegistry.register({
    name: 'getWeather',
    description: 'Get the weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The location to get weather for'
        }
      },
      required: ['location']
    },
    handler: async (args) => {
      return { 
        location: args.location, 
        temperature: Math.round(Math.random() * 30), 
        conditions: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
      };
    }
  });
  
  // Create a test agent
  const testAgent = {
    id: 'test-agent',
    name: 'Test Agent',
    role: AgentRole.DEVELOPER,
    description: 'A test agent for demonstrating LangChain integration',
    personality: 'Helpful and informative',
    functions: [],
    systemPrompt: `You are a helpful AI assistant. You can help with various tasks using functions available to you.
When appropriate, use functions to get information.
Always respond in a helpful and informative manner.`
  };
  
  // Create the LangChain executor
  const executor = createLangChainExecutor(testAgent, functionRegistry, config.openai.apiKey);
  
  // Test with a few different prompts
  const testPrompts = [
    'What time is it right now?',
    'What\'s the weather like in New York?',
    'Tell me about yourself and what you can do.'
  ];
  
  for (const prompt of testPrompts) {
    console.log(`\n\nTesting prompt: "${prompt}"`);
    try {
      const result = await executor.run(prompt);
      console.log('Response:', result.output);
      if (result.toolCalls.length > 0) {
        console.log('Tool Calls:');
        result.toolCalls.forEach((call, i) => {
          console.log(`  [${i+1}] ${call.name} - Args: ${call.arguments}`);
          console.log(`      Result: ${call.result}`);
        });
      }
    } catch (error) {
      console.error('Error testing prompt:', error);
    }
  }
  
  console.log('\n\nTesting with runWithLangChain function:');
  try {
    const result = await runWithLangChain(
      testAgent,
      functionRegistry,
      'What\'s the weather like in London and what time is it?',
      config.openai.apiKey
    );
    console.log('Response:', result.output);
    console.log('Tool Calls:', result.toolCalls);
  } catch (error) {
    console.error('Error testing runWithLangChain:', error);
  }
  
  console.log('\nLangChain integration test complete!');
}

// Run the test
testLangChainIntegration().catch(console.error); 