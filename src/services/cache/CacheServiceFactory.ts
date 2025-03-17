import { BrowserCacheService } from './BrowserCacheService';
import { AIModel, AIProvider } from '@/types/agent';

// Interface that both cache services implement
export interface ICacheService {
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  cacheResponse(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string,
    response: string
  ): Promise<void>;
  getCachedResponse(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string | null>;
  clearCache(): Promise<void>;
  getCacheSize(): Promise<number>;
}

/**
 * Factory class to get the appropriate cache service implementation
 */
export class CacheServiceFactory {
  private static instance: ICacheService;

  /**
   * Get the appropriate cache service instance
   */
  public static getInstance(): ICacheService {
    if (!CacheServiceFactory.instance) {
      // In browser environment, use BrowserCacheService
      CacheServiceFactory.instance = BrowserCacheService.getInstance();
    }
    return CacheServiceFactory.instance;
  }
} 