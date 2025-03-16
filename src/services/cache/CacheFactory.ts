import { RedisCacheService } from './RedisCacheService';
import { MemoryCacheService } from './MemoryCacheService';
import { config } from '@/config/config';
import { AIModel, AIProvider } from '@/types/agent';

/**
 * Interface for cache services
 */
export interface CacheService {
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  cacheResponse(provider: AIProvider, model: AIModel, systemPrompt: string, userPrompt: string, response: string): Promise<void>;
  getCachedResponse(provider: AIProvider, model: AIModel, systemPrompt: string, userPrompt: string): Promise<string | null>;
  clearCache(): Promise<void>;
  getCacheSize(): Promise<number>;
}

/**
 * Factory class that creates the appropriate cache service based on config
 */
export class CacheFactory {
  private static instance: CacheService;
  
  /**
   * Get the singleton cache service instance
   */
  public static getInstance(): CacheService {
    if (!CacheFactory.instance) {
      // Determine which cache implementation to use based on configuration
      if (config.redis.enabled && config.redis.url) {
        try {
          // Use Redis cache if enabled and configured
          CacheFactory.instance = RedisCacheService.getInstance();
          console.info('Using Redis cache service');
        } catch (error) {
          // Fallback to memory cache if Redis initialization fails
          console.error('Failed to initialize Redis cache, falling back to memory cache:', error);
          CacheFactory.instance = MemoryCacheService.getInstance();
        }
      } else {
        // Use memory cache if Redis is not enabled
        CacheFactory.instance = MemoryCacheService.getInstance();
        console.info('Using in-memory cache service (Redis is disabled)');
      }
    }
    
    return CacheFactory.instance;
  }
} 