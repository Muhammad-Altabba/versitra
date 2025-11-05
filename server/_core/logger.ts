/**
 * Centralized logging utility for the application
 * Provides consistent logging format and levels
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  userId?: string;
  bookId?: string;
  sectionId?: string;
  [key: string]: any;
}

class Logger {
  private formatMessage(level: LogLevel, category: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] [${category}] ${message}${contextStr}`;
  }

  debug(category: string, message: string, context?: LogContext) {
    console.log(this.formatMessage(LogLevel.DEBUG, category, message, context));
  }

  info(category: string, message: string, context?: LogContext) {
    console.log(this.formatMessage(LogLevel.INFO, category, message, context));
  }

  warn(category: string, message: string, context?: LogContext) {
    console.warn(this.formatMessage(LogLevel.WARN, category, message, context));
  }

  error(category: string, message: string, error?: Error, context?: LogContext) {
    const errorContext = error ? { ...context, error: error.message, stack: error.stack } : context;
    console.error(this.formatMessage(LogLevel.ERROR, category, message, errorContext));
  }
}

export const logger = new Logger();

