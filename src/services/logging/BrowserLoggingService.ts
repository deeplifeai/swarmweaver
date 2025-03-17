/**
 * Browser-compatible logging service
 */
export class BrowserLoggingService {
  private static instance: BrowserLoggingService;
  private logLevel: string = 'info';

  private constructor() {
    console.info('Browser logging service initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BrowserLoggingService {
    if (!BrowserLoggingService.instance) {
      BrowserLoggingService.instance = new BrowserLoggingService();
    }
    return BrowserLoggingService.instance;
  }

  /**
   * Set the log level
   */
  public setLogLevel(level: string): void {
    this.logLevel = level.toLowerCase();
    console.info(`Log level set to: ${level}`);
  }

  /**
   * Log an info message
   */
  public info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.info(message, meta || '');
    }
  }

  /**
   * Log a warning message
   */
  public warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(message, meta || '');
    }
  }

  /**
   * Log an error message
   */
  public error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      console.error(message, meta || '');
    }
  }

  /**
   * Log a debug message
   */
  public debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(message, meta || '');
    }
  }

  /**
   * Check if we should log at the given level
   */
  private shouldLog(level: string): boolean {
    const levels: { [key: string]: number } = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    return levels[level] <= levels[this.logLevel];
  }
} 