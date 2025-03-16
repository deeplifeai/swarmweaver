import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { config } from '@/config/config';
import { singleton } from 'tsyringe';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  trace: 'cyan'
};

// Add colors to winston
winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Create formatters
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.metadata ? ' ' + JSON.stringify(info.metadata) : ''}`
  )
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: level()
  })
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Daily rotate file for all logs
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
      level: 'info'
    })
  );
  
  // Separate file for errors
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      level: 'error'
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    winston.format.json()
  ),
  transports,
  exitOnError: false
});

// Create a stream object for Morgan HTTP logger integration
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

// Export a singleton instance
@singleton()
export class LoggingService {
  private static instance: LoggingService;
  
  public constructor() {
    // Set the static instance for backward compatibility
    LoggingService.instance = this;
  }
  
  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }
  
  /**
   * Log an error message
   * @param message Log message
   * @param metadata Additional metadata
   */
  error(message: string, metadata?: any): void {
    logger.error(message, { metadata });
  }
  
  /**
   * Log a warning message
   * @param message Log message
   * @param metadata Additional metadata
   */
  warn(message: string, metadata?: any): void {
    logger.warn(message, { metadata });
  }
  
  /**
   * Log an info message
   * @param message Log message
   * @param metadata Additional metadata
   */
  info(message: string, metadata?: any): void {
    logger.info(message, { metadata });
  }
  
  /**
   * Log an HTTP message
   * @param message Log message
   * @param metadata Additional metadata
   */
  http(message: string, metadata?: any): void {
    logger.http(message, { metadata });
  }
  
  /**
   * Log a debug message
   * @param message Log message
   * @param metadata Additional metadata
   */
  debug(message: string, metadata?: any): void {
    logger.debug(message, { metadata });
  }
  
  /**
   * Log a trace message
   * @param message Log message
   * @param metadata Additional metadata
   */
  trace(message: string, metadata?: any): void {
    logger.log('trace', message, { metadata });
  }
  
  /**
   * Create a child logger with additional context
   * @param context Context object to include in all logs
   * @returns A new LoggingService instance with the context
   */
  child(context: Record<string, any>): LoggingService {
    const childLogger = new LoggingService();
    
    // Override methods to include context
    childLogger.error = (message: string, metadata?: any) => {
      logger.error(message, { ...context, ...(metadata || {}) });
    };
    
    childLogger.warn = (message: string, metadata?: any) => {
      logger.warn(message, { ...context, ...(metadata || {}) });
    };
    
    childLogger.info = (message: string, metadata?: any) => {
      logger.info(message, { ...context, ...(metadata || {}) });
    };
    
    childLogger.http = (message: string, metadata?: any) => {
      logger.http(message, { ...context, ...(metadata || {}) });
    };
    
    childLogger.debug = (message: string, metadata?: any) => {
      logger.debug(message, { ...context, ...(metadata || {}) });
    };
    
    childLogger.trace = (message: string, metadata?: any) => {
      logger.log('trace', message, { ...context, ...(metadata || {}) });
    };
    
    return childLogger;
  }
}

// Export default instance
export const log = LoggingService.getInstance(); 