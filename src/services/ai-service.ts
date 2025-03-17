import { AIModel, AIProvider } from '@/types/agent';
import { OpenAIService } from './providers/openai-service';
import { AnthropicService } from '@/services/providers/anthropic-service';
import { CacheFactory } from './cache/CacheFactory';
import { LoggingServiceFactory } from './logging/LoggingServiceFactory';
import { singleton } from 'tsyringe';

/**
 * Service for interacting with AI providers
 */
@singleton()
export class AIService {
  private logger = LoggingServiceFactory.getInstance();
  private cache = CacheFactory.getInstance();
  private openAI: OpenAIService;
  private anthropic: AnthropicService;

  constructor() {
    this.openAI = new OpenAIService();
    this.anthropic = new AnthropicService();
  }

  /**
   * Get a completion from the AI model
   */
  public async getCompletion(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      useCache?: boolean;
    } = {}
  ): Promise<string> {
    try {
      // Check cache first if enabled
      if (options.useCache !== false) {
        const cached = await this.cache.getCachedResponse(provider, model, systemPrompt, userPrompt);
        if (cached) return cached;
      }

      // Get completion from provider
      let response: string;
      switch (provider) {
        case 'openai':
          response = await this.openAI.getCompletion(model, systemPrompt, userPrompt, options);
          break;
        case 'anthropic':
          response = await this.anthropic.getCompletion(model, systemPrompt, userPrompt, options);
          break;
        default:
          throw new Error(`Invalid AI provider: ${provider}`);
      }

      // Cache successful response if enabled
      if (options.useCache !== false) {
        await this.cache.cacheResponse(provider, model, systemPrompt, userPrompt, response);
      }

      return response;
    } catch (error) {
      this.logger.error('Error getting AI completion', {
        provider,
        model,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
