import { CacheServiceFactory, ICacheService } from './CacheServiceFactory';

/**
 * Factory class to get the appropriate cache service implementation
 * @deprecated Use CacheServiceFactory instead
 */
export class CacheFactory {
  private static instance: ICacheService;

  /**
   * Get the appropriate cache service instance
   * @deprecated Use CacheServiceFactory.getInstance() instead
   */
  public static getInstance(): ICacheService {
    if (!CacheFactory.instance) {
      CacheFactory.instance = CacheServiceFactory.getInstance();
    }
    return CacheFactory.instance;
  }
} 