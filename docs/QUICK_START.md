# SwarmWeaver Quick Start Guide

This guide will help you quickly set up and start using SwarmWeaver, enabling AI agents to communicate via Slack and integrate with GitHub.

## 1. Prerequisites

Before you begin, make sure you have:

- Node.js v16 or higher installed
- A Slack workspace where you have admin privileges
- A GitHub account with a repository you want to connect to
- An OpenAI API key with access to GPT-4 or later models

## 2. Setting Up Your Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click "Create New App"
2. Choose "From scratch"
3. Name your app "SwarmWeaver" and select your workspace
4. In the sidebar, go to "OAuth & Permissions"
5. Under "Bot Token Scopes", add the following scopes:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`
   - `groups:history`
   - `im:history`
   - `mpim:history`
6. In the sidebar, go to "Socket Mode" and enable it
   - This will generate an app-level token, save this as your `SLACK_APP_TOKEN`
7. In the sidebar, go to "Basic Information"
   - Under "App Credentials", copy the "Signing Secret" as your `SLACK_SIGNING_SECRET`
8. Go back to "OAuth & Permissions" and click "Install to Workspace"
   - After authorizing, copy the "Bot User OAuth Token" as your `SLACK_BOT_TOKEN`

## 3. Setting Up GitHub Access

1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token" (classic)
3. Name your token "SwarmWeaver"
4. Select the following scopes:
   - `repo` (all)
   - `workflow`
5. Generate the token and copy it as your `GITHUB_TOKEN`
6. Note the repository you want to connect to in `owner/repo` format (e.g., `yourusername/yourrepo`)

## 4. Installing SwarmWeaver

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/swarmweaver.git
   cd swarmweaver
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your tokens and settings:
   ```
   OPENAI_API_KEY=your_openai_api_key
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-slack-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   GITHUB_TOKEN=your-github-token
   GITHUB_REPOSITORY=owner/repo
   ```

5. Start the application:
   ```bash
   npm start
   ```

## 5. Inviting Your Bot to Channels

1. In Slack, create a new channel or use an existing one
2. Invite the bot to the channel by typing `/invite @SwarmWeaver`

## 6. Interacting with Agents

Now you can interact with the AI agents by mentioning them in your channel:

- **Project Manager**: `@ProjectManager Can you create a new issue for implementing user authentication?`
- **Developer**: `@Developer Can you help me understand how to implement this feature?`
- **Code Reviewer**: `@CodeReviewer Please review PR #42`
- **QA Tester**: `@QATester Can you create a test plan for the new login feature?`
- **Technical Writer**: `@TechnicalWriter Please update the documentation for the API endpoints`

Agents will respond to your requests and can perform various GitHub operations like creating issues, managing pull requests, and committing code changes.

## 7. Agent Collaboration

Agents can also collaborate with each other. For example, after the Project Manager creates an issue, you might see:

```
@Developer I've created issue #42 for the authentication feature. Can you start working on this?
```

The Developer agent can then respond and collaborate on the task.

## 8. Troubleshooting

If you encounter issues:

1. Check that all environment variables are correctly set in your `.env` file
2. Ensure your Slack bot has been invited to the channels you're using
3. Verify that your GitHub token has the correct permissions
4. Check the console output for any error messages

For more detailed information, refer to the full documentation in the README.md file. 