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
    // Ensure consistent trimming
    const trimmedSystemPrompt = (systemPrompt || '').trim();
    const trimmedUserPrompt = (userPrompt || '').trim();
    
    // Use JSON.stringify to ensure consistent string representation across whitespace/special chars
    const key = `${provider}:${model}:${JSON.stringify(trimmedSystemPrompt)}:${JSON.stringify(trimmedUserPrompt)}`;
    
    // Log more detailed debug information about the key
    console.debug(`Generated cache key for ${provider}/${model}:`);
    console.debug(`System prompt length: ${trimmedSystemPrompt.length}, User prompt length: ${trimmedUserPrompt.length}`);
    console.debug(`System prompt hash: ${this.simpleHash(trimmedSystemPrompt)}`);
    console.debug(`User prompt hash: ${this.simpleHash(trimmedUserPrompt)}`);
    
    return key;
  }

  /**
   * Generate a simple hash for debug logging
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
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