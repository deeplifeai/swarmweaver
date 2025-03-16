import { AIModel, AIProvider } from '@/types/agent';

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
 * In-memory cache service for AI responses
 * Used as a fallback when Redis is not available
 */
export class MemoryCacheService {
  private static instance: MemoryCacheService;
  private cache: Map<string, CacheEntry>;
  private enabled: boolean = true;
  
  private constructor() {
    this.cache = new Map<string, CacheEntry>();
    console.info('Memory cache initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MemoryCacheService {
    if (!MemoryCacheService.instance) {
      MemoryCacheService.instance = new MemoryCacheService();
    }
    return MemoryCacheService.instance;
  }
  
  /**
   * Enable or disable caching
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.info(`Memory caching ${enabled ? 'enabled' : 'disabled'}`);
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
    
    // Use a simple hash for memory caching
    return Buffer.from(JSON.stringify(keyComponents)).toString('base64');
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
    
    this.cache.set(key, {
      provider,
      model,
      systemPrompt: (systemPrompt || '').trim(),
      userPrompt: (userPrompt || '').trim(),
      response,
      timestamp: Date.now()
    });
    
    // Show more of the key in logs
    console.info(`Cached response for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
    console.info(`Cache size: ${this.cache.size} entries`);
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
    const cached = this.cache.get(key);
    
    if (cached) {
      // Show more of the key in logs
      console.info(`Cache hit for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
      console.info(`Using cached response from ${new Date(cached.timestamp).toLocaleTimeString()}`);
      return cached.response;
    }
    
    // Show more of the key in logs
    console.info(`Cache miss for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
    return null;
  }
  
  /**
   * Clear the entire cache
   */
  public async clearCache(): Promise<void> {
    const previousSize = this.cache.size;
    this.cache.clear();
    console.info(`Cache cleared (removed ${previousSize} entries)`);
  }
  
  /**
   * Get current cache size (number of entries)
   */
  public async getCacheSize(): Promise<number> {
    return this.cache.size;
  }
} 