import { LoggingServiceFactory, ILoggingService } from './LoggingServiceFactory';

/**
 * @deprecated Use LoggingServiceFactory instead
 */
export class LoggingService {
  private static instance: ILoggingService;

  /**
   * Get the singleton logging service instance
   * @deprecated Use LoggingServiceFactory.getInstance() instead
   */
  public static getInstance(): ILoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = LoggingServiceFactory.getInstance();
    }
    return LoggingService.instance;
  }
} 