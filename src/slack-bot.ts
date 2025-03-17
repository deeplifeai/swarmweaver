import { App, LogLevel } from '@slack/bolt';
import { config } from '@/config/config';
import { LoggingServiceFactory } from './services/logging/LoggingServiceFactory';

const logger = LoggingServiceFactory.getInstance();

// Initialize the Slack app
const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  socketMode: true,
  appToken: config.slack.appToken,
  logLevel: LogLevel.INFO
});

// Import and register all Slack event handlers
import './slack/events';
import './slack/commands';
import './slack/actions';

// Start the app
(async () => {
  try {
    await app.start();
    logger.info('⚡️ Bolt app is running!');
  } catch (error) {
    logger.error('Failed to start Slack bot', error);
    process.exit(1);
  }
})(); 