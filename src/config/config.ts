import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface OpenAIConfig {
  apiKey: string;
  models: {
    default: string;
    assistant: string;
  };
}

interface SlackConfig {
  botToken: string;
  signingSecret: string;
  appToken: string;
  channelId: string;
}

interface GitHubConfig {
  token: string;
  repository: string;
  accessToken: string;
  apiUrl: string;
}

export interface AppConfig {
  port: number;
  slack: SlackConfig;
  github: GitHubConfig;
  openai: OpenAIConfig;
}

// Configuration for different environments
const configurations = {
  development: {
    port: parseInt(process.env.PORT || '3000', 10),
    github: {
      token: process.env.GITHUB_TOKEN || '',
      repository: process.env.GITHUB_REPOSITORY || 'owner/repo-name',
      accessToken: process.env.GITHUB_TOKEN || '',
      apiUrl: 'https://api.github.com'
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN || '',
      appToken: process.env.SLACK_APP_TOKEN || '',
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      channelId: process.env.SLACK_CHANNEL_ID || ''
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      models: {
        default: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        assistant: process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4-turbo-preview'
      }
    }
  },
  test: {
    port: parseInt(process.env.PORT || '3000', 10),
    github: {
      token: 'test-token',
      repository: 'test-owner/test-repo',
      accessToken: 'test-token',
      apiUrl: 'https://api.github.com'
    },
    slack: {
      botToken: 'test-bot-token',
      appToken: 'test-app-token',
      signingSecret: 'test-signing-secret',
      channelId: 'test-channel-id'
    },
    openai: {
      apiKey: 'test-api-key',
      models: {
        default: 'gpt-4-turbo-preview',
        assistant: 'gpt-4-turbo-preview'
      }
    }
  },
  production: {
    port: parseInt(process.env.PORT || '3000', 10),
    github: {
      token: process.env.GITHUB_TOKEN || '',
      repository: process.env.GITHUB_REPOSITORY || '',
      accessToken: process.env.GITHUB_TOKEN || '',
      apiUrl: 'https://api.github.com'
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN || '',
      appToken: process.env.SLACK_APP_TOKEN || '',
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      channelId: process.env.SLACK_CHANNEL_ID || ''
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      models: {
        default: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        assistant: process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4-turbo-preview'
      }
    }
  }
};

// Determine current environment
const env = process.env.NODE_ENV || 'development';

// Export configuration for current environment
export const config: AppConfig = 
  env === 'production' ? configurations.production :
  env === 'test' ? configurations.test :
  configurations.development;

// Export environment for use in the application
export const environment = env; 