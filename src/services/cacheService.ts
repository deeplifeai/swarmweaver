import { AIModel, AIProvider } from "@/types/agent";

/**
 * Interface for a cache entry
 */
interface CacheEntry {
  provider: AIProvider;
  model: AIModel;
  systemPrompt: string;
  userPrompt: string;
  response: string;
  timestamp: number;
}

/**
 * Class to handle caching AI responses
 */
class ResponseCache {
  private static instance: ResponseCache;
  private cache: Map<string, CacheEntry>;
  private enabled: boolean = true;

  private constructor() {
    this.cache = new Map<string, CacheEntry>();
    console.info('Response cache initialized');
  }

  /**
   * Get the singleton cache instance
   */
  public static getInstance(): ResponseCache {
    if (!ResponseCache.instance) {
      ResponseCache.instance = new ResponseCache();
    }
    return ResponseCache.instance;
  }

  /**
   * Generate a cache key from input parameters
   */
  private generateKey(provider: AIProvider, model: AIModel, systemPrompt: string, userPrompt: string): string {
    // Create a unique key based on all relevant parameters
    return `${provider}:${model}:${systemPrompt.trim()}:${userPrompt.trim()}`;
  }

  /**
   * Cache a response
   */
  public cacheResponse(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string,
    response: string
  ): void {
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
      systemPrompt,
      userPrompt,
      response,
      timestamp: Date.now()
    });
    
    console.info(`Cached response for ${provider}/${model} (key: ${key.substring(0, 20)}...)`);
    console.info(`Cache size: ${this.cache.size} entries`);
  }

  /**
   * Get a cached response if available
   */
  public getCachedResponse(
    provider: AIProvider,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string
  ): string | null {
    if (!this.enabled) return null;
    
    const key = this.generateKey(provider, model, systemPrompt, userPrompt);
    const cached = this.cache.get(key);
    
    if (cached) {
      console.info(`Cache hit for ${provider}/${model} (key: ${key.substring(0, 20)}...)`);
      console.info(`Using cached response from ${new Date(cached.timestamp).toLocaleTimeString()}`);
      return cached.response;
    }
    
    console.info(`Cache miss for ${provider}/${model} (key: ${key.substring(0, 20)}...)`);
    return null;
  }

  /**
   * Clear the entire cache
   */
  public clearCache(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    console.info(`Cache cleared (removed ${previousSize} entries)`);
  }

  /**
   * Enable or disable the cache
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.info(`Response cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if cache is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}

// Export a singleton instance
export const responseCache = ResponseCache.getInstance(); 