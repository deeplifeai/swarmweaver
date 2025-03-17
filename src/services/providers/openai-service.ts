import { AIModel } from '@/types/agent';

interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string;
    param: string | null;
  };
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
}

export class OpenAIService {
  constructor() {}

  /**
   * Get a completion from OpenAI
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
      top_p: options.topP || 1,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json() as OpenAIError;
        throw new Error(`OpenAI API error: ${errorData.error?.message || `HTTP error ${response.status}`}`);
      }

      const data = await response.json() as OpenAIResponse;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenAI API');
      }

      return content;
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 