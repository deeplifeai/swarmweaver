// Simple test script for token counting
const tiktoken = require('tiktoken');

// Sample text for token counting
const text = `This is a sample text to test token counting.
OpenAI's GPT models tokenize text in a specific way.
For example, the word "tokenization" might be split into multiple tokens.
Special characters like ! @ # $ % ^ & * ( ) are usually separate tokens.
Numbers like 1234567890 are often broken into separate tokens as well.`;

console.log(`Test text (${text.length} characters):\n${text}\n`);

// Function to count tokens using tiktoken
function countTokens(text, model = 'gpt-4') {
  try {
    console.log(`Counting tokens for model: ${model}`);
    
    // Get the appropriate encoding for the model
    let encoding;
    try {
      // For well-known models, use predefined encoding
      if (model.toLowerCase().includes('gpt-4') || 
          model.toLowerCase().includes('gpt-3.5') ||
          model.toLowerCase().includes('gpt-4o')) {
        encoding = tiktoken.get_encoding('cl100k_base');
        console.log('Using cl100k_base encoding');
      } else if (model.toLowerCase().includes('davinci')) {
        encoding = tiktoken.get_encoding('p50k_base');
        console.log('Using p50k_base encoding');
      } else {
        // Try model-specific encoding
        try {
          encoding = tiktoken.encoding_for_model(model);
          console.log(`Using model-specific encoding for ${model}`);
        } catch (e) {
          encoding = tiktoken.get_encoding('cl100k_base');
          console.log('Falling back to cl100k_base encoding');
        }
      }
    } catch (err) {
      console.error(`Error getting encoding: ${err.message}`);
      return -1;
    }
    
    // Encode the text
    const tokens = encoding.encode(text);
    
    // Show the actual tokens for demonstration
    console.log('First 10 token IDs:', tokens.slice(0, 10));
    
    // Count tokens
    const tokenCount = tokens.length;
    
    // Free resources
    encoding.free();
    
    return tokenCount;
  } catch (error) {
    console.error(`Error counting tokens: ${error.message}`);
    return -1;
  }
}

// Test for different models
const models = ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo', 'davinci'];

models.forEach(model => {
  const tokenCount = countTokens(text, model);
  console.log(`Token count for ${model}: ${tokenCount}`);
  console.log('-'.repeat(50));
});

// Estimate tokens per character ratio
const charCount = text.length;
const tokenCount = countTokens(text);
console.log(`\nCharacter count: ${charCount}`);
console.log(`Token count: ${tokenCount}`);
console.log(`Chars per token: ${(charCount / tokenCount).toFixed(2)}`);
console.log(`Tokens per char: ${(tokenCount / charCount).toFixed(4)}`);

// Compare to simple heuristic
const simpleEstimate = Math.ceil(charCount / 4);
console.log(`\nSimple estimate (chars/4): ${simpleEstimate}`);
console.log(`Error from actual: ${((simpleEstimate - tokenCount) / tokenCount * 100).toFixed(2)}%`); 