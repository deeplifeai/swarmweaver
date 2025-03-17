import { AIModel } from '@/types/agent';

interface AnthropicError {
  error: {
    message: string;
    type: string;
  };
}

interface AnthropicResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
}

export class AnthropicService {
  constructor() {}

  /**
   * Get a completion from Anthropic
   */
  public async getCompletion(
    model: AIModel,
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    } = {}
  ): Promise<string> {
    const payload = {
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 1
    };

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json() as AnthropicError;
        throw new Error(`Anthropic API error: ${errorData.error?.message || `HTTP error ${response.status}`}`);
      }

      const data = await response.json() as AnthropicResponse;
      const content = data.content?.[0]?.text;

      if (!content) {
        throw new Error('Empty response from Anthropic API');
      }

      return content;
    } catch (error) {
      throw new Error(`Anthropic API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 