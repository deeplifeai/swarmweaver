export interface SlackMessage {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

export interface SlackAttachment {
  color?: string;
  blocks?: SlackBlock[];
  text?: string;
  title?: string;
  title_link?: string;
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'context' | 'actions' | 'header';
  text?: SlackTextObject;
  elements?: SlackElement[];
  fields?: SlackTextObject[];
  block_id?: string;
  accessory?: SlackElement;
}

export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

export interface SlackElement {
  type: string;
  text?: SlackTextObject;
  action_id?: string;
  elements?: SlackElement[];
  value?: string;
  style?: 'primary' | 'danger';
  url?: string;
  image_url?: string;
  alt_text?: string;
  options?: SlackOption[];
  initial_option?: SlackOption;
}

export interface SlackOption {
  text: SlackTextObject;
  value: string;
}

export interface SlackChannel {
  id: string;
  name: string;
} 