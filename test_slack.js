import dotenv from 'dotenv';
import { WebClient } from '@slack/web-api';

// Load environment variables from .env file
dotenv.config();

async function testSlack() {
  try {
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

    console.log('Testing Slack API connection...');
    
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
    process.exit(1);
  }
}

testSlack(); 