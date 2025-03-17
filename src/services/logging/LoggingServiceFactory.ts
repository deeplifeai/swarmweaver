import { BrowserLoggingService } from './BrowserLoggingService';

// Interface that both logging services implement
export interface ILoggingService {
  setLogLevel(level: string): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Factory class to get the appropriate logging service implementation
 */
export class LoggingServiceFactory {
  private static instance: ILoggingService;

  /**
   * Get the appropriate logging service instance
   */
  public static getInstance(): ILoggingService {
    if (!LoggingServiceFactory.instance) {
      // In browser environment, use BrowserLoggingService
      LoggingServiceFactory.instance = BrowserLoggingService.getInstance();
    }
    return LoggingServiceFactory.instance;
  }
} 