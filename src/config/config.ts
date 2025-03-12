import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface SlackConfig {
  botToken: string;
  signingSecret: string;
  appToken: string;
}

interface GitHubConfig {
  token: string;
  repository: string;
}

interface OpenAIConfig {
  apiKey: string;
  model: string;
}

interface AppConfig {
  port: number;
  environment: string;
  slack: SlackConfig;
  github: GitHubConfig;
  openai: OpenAIConfig;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || ''
  },
  
  github: {
    token: process.env.GITHUB_TOKEN || '',
    repository: process.env.GITHUB_REPOSITORY || ''
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o'
  }
}; 