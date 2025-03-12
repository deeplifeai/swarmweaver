import dotenv from 'dotenv';
import { WebClient } from '@slack/web-api';

// Load environment variables from .env file
dotenv.config();

async function postSlackMessage() {
  try {
    // Initialize Slack client
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const channelId = process.env.SLACK_CHANNEL_ID;
    
    console.log('Connecting to Slack...');
    
    // Create a message with test instructions
    const message = `
Hello! I'm SwarmWeaver, ready for testing. Here are some commands you can try:

*Basic Interaction Tests*
• @swarmweaver Hello! Can you introduce yourself?
• @swarmweaver What agents are available in this system?
• @swarmweaver Help

*GitHub Integration Tests*
• @swarmweaver Create a new issue titled "Test Issue" with description "This is a test issue created by SwarmWeaver"
• @swarmweaver List open issues in the repository

*Agent Collaboration Tests*
• @swarmweaver I need help implementing a simple function to calculate Fibonacci numbers
• @swarmweaver Can you have the Developer and CodeReviewer collaborate on a solution?

I'm ready to assist with your testing!
`;

    // Post the message to the channel
    const result = await slack.chat.postMessage({
      channel: channelId,
      text: message,
      unfurl_links: false,
      unfurl_media: false
    });

    console.log('✅ Message posted to Slack successfully!');
    console.log(`Message sent to channel: ${result.channel}`);
    console.log(`Message timestamp: ${result.ts}`);
    
  } catch (error) {
    console.error('❌ Error posting to Slack:');
    console.error(error.message);
    process.exit(1);
  }
}

// Execute the function
postSlackMessage(); 