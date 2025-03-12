import dotenv from 'dotenv';
import { App } from '@slack/bolt';
import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000
});

// Listen for messages mentioning the bot
app.event('app_mention', async ({ event, say }) => {
  try {
    console.log(`Received message: ${event.text}`);
    
    // Extract the actual message content (removing the mention)
    const messageText = event.text.replace(/<@[A-Z0-9]+>/, '').trim();
    
    // Special case for GitHub commands
    if (messageText.toLowerCase().includes('create a new issue')) {
      await handleGitHubIssueCreation(messageText, say);
      return;
    }
    
    if (messageText.toLowerCase().includes('list open issues')) {
      await handleGitHubListIssues(say);
      return;
    }
    
    // Default: Use OpenAI to respond
    await handleOpenAIResponse(messageText, say);
    
  } catch (error) {
    console.error('Error processing message:', error);
    await say("I'm sorry, I encountered an error while processing your request.");
  }
});

// Handle GitHub issue creation
async function handleGitHubIssueCreation(message, say) {
  try {
    // Very basic parsing - in a real app you'd want more sophisticated extraction
    const titleMatch = message.match(/titled "([^"]+)"/);
    const descriptionMatch = message.match(/description "([^"]+)"/);
    
    if (!titleMatch) {
      await say("Please provide a title for the issue in quotes: 'titled \"Your Title Here\"'");
      return;
    }
    
    const title = titleMatch[1];
    const description = descriptionMatch ? descriptionMatch[1] : "Issue created via SwarmWeaver";
    
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    
    // Create the issue
    const { data } = await octokit.issues.create({
      owner,
      repo: repo.replace('.git', ''),
      title,
      body: description
    });
    
    await say(`✅ Created GitHub issue #${data.number}: "${data.title}"\nView it here: ${data.html_url}`);
  } catch (error) {
    console.error('Error creating GitHub issue:', error);
    await say("Sorry, I couldn't create the GitHub issue. Please check the repository permissions and try again.");
  }
}

// Handle listing GitHub issues
async function handleGitHubListIssues(say) {
  try {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    
    // Get open issues
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo: repo.replace('.git', ''),
      state: 'open'
    });
    
    if (data.length === 0) {
      await say("There are no open issues in the repository.");
      return;
    }
    
    let response = "📋 *Open Issues in Repository:*\n\n";
    
    data.forEach(issue => {
      response += `• #${issue.number}: ${issue.title}\n`;
    });
    
    await say(response);
  } catch (error) {
    console.error('Error listing GitHub issues:', error);
    await say("Sorry, I couldn't retrieve the GitHub issues. Please check the repository permissions and try again.");
  }
}

// Handle OpenAI-generated responses
async function handleOpenAIResponse(message, say) {
  try {
    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: `You are SwarmWeaver, a helpful AI assistant that specializes in software development and project management.
                    You have access to a team of specialized agents with distinct roles:
                    1. ProjectManager: Oversees development, creates tasks, tracks progress
                    2. Developer: Implements features, fixes bugs, creates pull requests
                    3. CodeReviewer: Evaluates code quality, provides feedback
                    4. QATester: Verifies functionality, finds bugs
                    5. TechnicalWriter: Creates documentation and guides
                    
                    When asked to role-play as one of these agents, adopt their perspective and expertise.
                    Keep responses concise and helpful.`
        },
        { role: 'user', content: message }
      ],
      model: 'gpt-4o',
    });

    await say(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error getting OpenAI response:', error);
    await say("I'm sorry, I couldn't generate a response. Please try again later.");
  }
}

// Start the app
(async () => {
  try {
    await app.start();
    console.log('⚡️ SwarmWeaver is running!');
    console.log('Connected to Slack workspace successfully');
  } catch (error) {
    console.error('Error starting app:', error);
  }
})(); 