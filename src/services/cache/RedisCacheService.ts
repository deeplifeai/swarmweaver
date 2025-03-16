import Redis from 'ioredis';
import { AIModel, AIProvider } from '@/types/agent';
import { config } from '@/config/config';

// Interface for cache entries
interface CacheEntry {
  provider: AIProvider;
  model: AIModel;
  systemPrompt: string;
  userPrompt: string;
  response: string;
  timestamp: number;
}

/**
 * Redis-based cache service for AI responses
 */
export class RedisCacheService {
  private static instance: RedisCacheService;
  private client: Redis;
  private enabled: boolean = true;
  private readonly cachePrefix = 'ai-response:';
  private readonly defaultTTL = 60 * 60 * 24 * 7; // 1 week in seconds
  
  private constructor() {
    // Initialize Redis client
    const redisUrl = config.redis?.url || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
    
    // Set up error handling
    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
      // Don't crash the application, just disable caching
      this.enabled = false;
    });
    
    // Set up connection success handling
    this.client.on('connect', () => {
      console.info('Redis cache connected successfully');
      this.enabled = true;
    });
    
    console.info('Redis cache service initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }
  
  /**
   * Enable or disable caching
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.info(`Redis caching ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if caching is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Generate a cache key from request parameters
   */
  private generateKey(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string
  ): string {
    // Normalize inputs to handle whitespace variations
    const normalizedSystem = (systemPrompt || '').trim();
    const normalizedUser = (userPrompt || '').trim();
    
    // Create a deterministic string from all parameters
    const keyComponents = [
      provider,
      model,
      normalizedSystem,
      normalizedUser
    ];
    
    // Use a cryptographic hash for more uniform key distribution
    return this.cachePrefix + Buffer.from(JSON.stringify(keyComponents)).toString('base64');
  }
  
  /**
   * Cache a response
   */
  public async cacheResponse(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string,
    response: string
  ): Promise<void> {
    if (!this.enabled) return;
    
    // Don't cache error responses
    if (response.startsWith('[ERROR::') || response.startsWith('[Error:')) {
      console.info('Not caching error response');
      return;
    }
    
    const key = this.generateKey(provider, model, systemPrompt, userPrompt);
    
    const entry: CacheEntry = {
      provider,
      model,
      systemPrompt: (systemPrompt || '').trim(),
      userPrompt: (userPrompt || '').trim(),
      response,
      timestamp: Date.now()
    };
    
    try {
      // Store in Redis with TTL
      await this.client.setex(
        key,
        this.defaultTTL,
        JSON.stringify(entry)
      );
      
      // Log cache update
      console.info(`Cached response for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
    } catch (error) {
      console.error('Error caching response in Redis:', error);
    }
  }
  
  /**
   * Get a cached response if available
   */
  public async getCachedResponse(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string | null> {
    if (!this.enabled) return null;
    
    const key = this.generateKey(provider, model, systemPrompt, userPrompt);
    
    try {
      const cached = await this.client.get(key);
      
      if (cached) {
        const entry = JSON.parse(cached) as CacheEntry;
        console.info(`Cache hit for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
        console.info(`Using cached response from ${new Date(entry.timestamp).toLocaleTimeString()}`);
        return entry.response;
      }
      
      console.info(`Cache miss for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
      return null;
    } catch (error) {
      console.error('Error getting cached response from Redis:', error);
      return null;
    }
  }
  
  /**
   * Clear the entire cache
   */
  public async clearCache(): Promise<void> {
    try {
      // Find all keys with our prefix
      const keys = await this.client.keys(`${this.cachePrefix}*`);
      
      if (keys.length > 0) {
        // Delete all matching keys
        await this.client.del(...keys);
        console.info(`Cache cleared (removed ${keys.length} entries)`);
      } else {
        console.info('No cache entries to clear');
      }
    } catch (error) {
      console.error('Error clearing Redis cache:', error);
    }
  }
  
  /**
   * Get current cache size (number of entries)
   */
  public async getCacheSize(): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.cachePrefix}*`);
      return keys.length;
    } catch (error) {
      console.error('Error getting Redis cache size:', error);
      return 0;
    }
  }
  
  /**
   * Close the Redis connection
   * Should be called when shutting down the application
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit();
      console.info('Redis cache connection closed');
    } catch (error) {
      console.error('Error closing Redis cache connection:', error);
    }
  }
} 