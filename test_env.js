import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Check if required configuration is available
function validateConfiguration() {
  const missingEnvVars = [];
  
  // Check for missing variables
  if (!process.env.OPENAI_API_KEY) missingEnvVars.push('OPENAI_API_KEY');
  if (!process.env.SLACK_BOT_TOKEN) missingEnvVars.push('SLACK_BOT_TOKEN');
  if (!process.env.SLACK_SIGNING_SECRET) missingEnvVars.push('SLACK_SIGNING_SECRET');
  if (!process.env.SLACK_APP_TOKEN) missingEnvVars.push('SLACK_APP_TOKEN');
  if (!process.env.GITHUB_TOKEN) missingEnvVars.push('GITHUB_TOKEN');
  if (!process.env.GITHUB_REPOSITORY) missingEnvVars.push('GITHUB_REPOSITORY');
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(variable => console.error(`  - ${variable}`));
    console.error('Please set these variables in your .env file and restart the application.');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set:');
  console.log(`- OPENAI_API_KEY: ${maskToken(process.env.OPENAI_API_KEY)}`);
  console.log(`- SLACK_BOT_TOKEN: ${maskToken(process.env.SLACK_BOT_TOKEN)}`);
  console.log(`- SLACK_SIGNING_SECRET: ${maskToken(process.env.SLACK_SIGNING_SECRET)}`);
  console.log(`- SLACK_APP_TOKEN: ${maskToken(process.env.SLACK_APP_TOKEN)}`);
  console.log(`- GITHUB_TOKEN: ${maskToken(process.env.GITHUB_TOKEN)}`);
  console.log(`- GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`);
  console.log(`- SLACK_CHANNEL_ID: ${process.env.SLACK_CHANNEL_ID}`);
}

// Utility function to mask tokens for security
function maskToken(token) {
  if (!token) return 'undefined';
  if (token.length <= 8) return '********';
  return token.substring(0, 4) + '...' + token.substring(token.length - 4);
}

validateConfiguration(); 