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
 * Browser-based cache service for AI responses using localStorage
 */
export class BrowserCacheService {
  private static instance: BrowserCacheService;
  private enabled: boolean = true;
  private readonly cachePrefix = 'ai-response:';
  private readonly defaultTTL = 60 * 60 * 24 * 7; // 1 week in seconds
  
  private constructor() {
    console.info('Browser cache service initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): BrowserCacheService {
    if (!BrowserCacheService.instance) {
      BrowserCacheService.instance = new BrowserCacheService();
    }
    return BrowserCacheService.instance;
  }
  
  /**
   * Enable or disable caching
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.info(`Browser caching ${enabled ? 'enabled' : 'disabled'}`);
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
    
    // Use btoa for base64 encoding in the browser
    return this.cachePrefix + btoa(JSON.stringify(keyComponents));
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
      // Store in localStorage with TTL
      const storageItem = {
        entry,
        expires: Date.now() + (this.defaultTTL * 1000)
      };
      
      localStorage.setItem(key, JSON.stringify(storageItem));
      
      // Log cache update
      console.info(`Cached response for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
    } catch (error) {
      console.error('Error caching response in localStorage:', error);
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
      const cached = localStorage.getItem(key);
      
      if (cached) {
        const { entry, expires } = JSON.parse(cached);
        
        // Check if cache has expired
        if (Date.now() > expires) {
          localStorage.removeItem(key);
          console.info(`Cache expired for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
          return null;
        }
        
        console.info(`Cache hit for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
        console.info(`Using cached response from ${new Date(entry.timestamp).toLocaleTimeString()}`);
        return entry.response;
      }
      
      console.info(`Cache miss for ${provider}/${model} (key: ${key.substring(0, 40)}...)`);
      return null;
    } catch (error) {
      console.error('Error getting cached response from localStorage:', error);
      return null;
    }
  }
  
  /**
   * Clear the entire cache
   */
  public async clearCache(): Promise<void> {
    try {
      // Find and remove all keys with our prefix
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.cachePrefix));
      
      keys.forEach(key => localStorage.removeItem(key));
      console.info(`Cache cleared (removed ${keys.length} entries)`);
    } catch (error) {
      console.error('Error clearing localStorage cache:', error);
    }
  }
  
  /**
   * Get current cache size (number of entries)
   */
  public async getCacheSize(): Promise<number> {
    try {
      return Object.keys(localStorage).filter(key => key.startsWith(this.cachePrefix)).length;
    } catch (error) {
      console.error('Error getting localStorage cache size:', error);
      return 0;
    }
  }
} 