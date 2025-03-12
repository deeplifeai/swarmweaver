/**
 * Types for Slack-related entities in the sandbox environment
 */

export interface SlackMessage {
  text: string;
  user: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  mentions?: string[];
}

export interface SlackChannel {
  id: string;
  name: string;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

export interface SlackAttachment {
  text?: string;
  title?: string;
  footer?: string;
  color?: string;
  fields?: {
    title: string;
    value: string;
    short?: boolean;
  }[];
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'context' | 'actions' | 'header';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
  };
  elements?: any[];
  fields?: any[];
}

export interface EnhancedSlackMessage extends SlackMessage {
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  reactions?: SlackReaction[];
  replies?: SlackMessage[];
  reply_count?: number;
  thread_ts?: string;
} 