import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { ILoggingService } from '../logging/LoggingServiceFactory';
import { AgentOrchestrator } from '../ai/AgentOrchestrator';
import { SlackMessage } from '@/types/slack/SlackTypes';
import { AgentMessage } from '@/types/agents/Agent';
import { config } from '@/config/config';

// Our internal SlackMessage interface
interface InternalSlackMessage {
  type: string;
  text: string;
  user: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  reply_to_message_id?: string;
}

export class SlackService {
  private app: App;
  private client: WebClient;
  private logger: ILoggingService;
  private orchestrator: AgentOrchestrator;

  constructor(
    logger: ILoggingService,
    orchestrator: AgentOrchestrator
  ) {
    this.logger = logger;
    this.orchestrator = orchestrator;
    this.app = new App({
      token: config.slack.botToken,
      signingSecret: config.slack.signingSecret,
      socketMode: true,
      appToken: config.slack.appToken
    });
    this.client = new WebClient(config.slack.botToken);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.app) {
      throw new Error('Slack app not initialized');
    }

    this.app.message(async ({ message }) => {
      try {
        await this.handleMessage(message as SlackMessage);
      } catch (error) {
        this.logger.error('Error handling message:', error);
      }
    });

    this.app.event('app_mention', async ({ event }) => {
      try {
        const message: SlackMessage = {
          text: event.text || '',
          channel: event.channel,
          thread_ts: event.thread_ts
        };
        await this.handleMessage(message);
      } catch (error) {
        this.logger.error('Error handling mention:', error);
      }
    });

    this.app.error(async (error) => {
      this.logger.error('Slack app error:', error);
    });
  }

  public async start(): Promise<void> {
    if (!this.app) {
      throw new Error('Slack app not initialized');
    }

    try {
      await this.app.start(config.port);
      this.logger.info(`Slack bot started on port ${config.port}`);
    } catch (error) {
      this.logger.error('Failed to start Slack bot:', error);
      throw error;
    }
  }

  public async sendMessage(message: InternalSlackMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    try {
      await this.client.chat.postMessage({
        channel: message.channel,
        text: message.text,
        thread_ts: message.thread_ts,
        reply_to_message_id: message.reply_to_message_id
      });
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  private convertToInternalMessage(message: SlackMessage): InternalSlackMessage {
    return {
      type: 'message',
      text: message.text,
      user: 'system', // Default to system user for outgoing messages
      channel: message.channel,
      ts: new Date().getTime().toString(),
      thread_ts: message.thread_ts,
      reply_to_message_id: message.thread_ts
    };
  }

  private convertToAgentMessage(message: InternalSlackMessage): AgentMessage {
    return {
      id: message.ts,
      timestamp: new Date().toISOString(),
      agentId: message.user,
      content: message.text,
      channel: message.channel,
      mentions: [],
      replyToMessageId: message.reply_to_message_id
    };
  }

  private async handleMessage(message: SlackMessage): Promise<void> {
    try {
      const internalMessage = this.convertToInternalMessage(message);
      const agentMessage = this.convertToAgentMessage(internalMessage);
      await this.orchestrator.handleMessage(agentMessage);
    } catch (error) {
      this.logger.error('Error processing message:', error);
      throw error;
    }
  }
} 