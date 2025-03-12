import dotenv from 'dotenv';
import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';
import { WebClient } from '@slack/web-api';

// Load environment variables from .env file
dotenv.config();

// Utility function to mask tokens for security
function maskToken(token) {
  if (!token) return 'undefined';
  if (token.length <= 8) return '********';
  return token.substring(0, 4) + '...' + token.substring(token.length - 4);
}

async function testAllAPIs() {
  console.log('🔍 Testing environment variables and API connections...\n');
  
  // Check environment variables
  const envVars = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'SLACK_BOT_TOKEN': process.env.SLACK_BOT_TOKEN,
    'SLACK_SIGNING_SECRET': process.env.SLACK_SIGNING_SECRET,
    'SLACK_APP_TOKEN': process.env.SLACK_APP_TOKEN,
    'GITHUB_TOKEN': process.env.GITHUB_TOKEN,
    'GITHUB_REPOSITORY': process.env.GITHUB_REPOSITORY,
    'SLACK_CHANNEL_ID': process.env.SLACK_CHANNEL_ID
  };
  
  const missingVars = Object.entries(envVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(variable => console.error(`  - ${variable}`));
    console.error('Please set these variables in your .env file and restart the application.');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set:');
  Object.entries(envVars).forEach(([key, value]) => {
    if (key === 'GITHUB_REPOSITORY' || key === 'SLACK_CHANNEL_ID') {
      console.log(`- ${key}: ${value}`);
    } else {
      console.log(`- ${key}: ${maskToken(value)}`);
    }
  });
  
  console.log('\n');
  
  // Test OpenAI API
  try {
    console.log('🔄 Testing OpenAI API connection...');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: 'Hello, are you working?' }],
      model: 'gpt-4o',
    });

    console.log('✅ OpenAI API connection successful!');
    console.log('Response:', completion.choices[0].message.content);
  } catch (error) {
    console.error('❌ Error connecting to OpenAI API:');
    console.error(error.message);
  }
  
  console.log('\n');
  
  // Test GitHub API
  try {
    console.log('🔄 Testing GitHub API connection...');
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    // Parse the repository string
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    
    // Get repository information
    const { data } = await octokit.repos.get({
      owner,
      repo: repo.replace('.git', '') // Remove .git if present
    });

    console.log('✅ GitHub API connection successful!');
    console.log('Repository:', data.full_name);
    console.log('Description:', data.description);
    console.log('Stars:', data.stargazers_count);
  } catch (error) {
    console.error('❌ Error connecting to GitHub API:');
    console.error(error.message);
  }
  
  console.log('\n');
  
  // Test Slack API
  try {
    console.log('🔄 Testing Slack API connection...');
    
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    // Get information about the bot
    const botInfo = await slack.auth.test();
    
    console.log('✅ Slack API connection successful!');
    console.log('Bot User:', botInfo.user);
    console.log('Team:', botInfo.team);
    
    // Test channel access if SLACK_CHANNEL_ID is provided
    if (process.env.SLACK_CHANNEL_ID) {
      try {
        const channelInfo = await slack.conversations.info({
          channel: process.env.SLACK_CHANNEL_ID
        });
        
        console.log('✅ Channel access successful!');
        console.log('Channel:', channelInfo.channel.name);
      } catch (channelError) {
        console.error('❌ Error accessing channel:');
        console.error(channelError.message);
      }
    }
  } catch (error) {
    console.error('❌ Error connecting to Slack API:');
    console.error(error.message);
  }
  
  console.log('\n🎉 API testing completed!');
}

testAllAPIs(); 