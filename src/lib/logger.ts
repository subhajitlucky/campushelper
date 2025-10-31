// Structured logging utility for error tracking and debugging

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: LogContext;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: LogContext
  ): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    };
  }

  private formatLogEntry(entry: LogEntry): string {
    const { level, message, context, timestamp, url } = entry;
    
    let formatted = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (url) {
      formatted += ` (${url})`;
    }
    
    if (context && Object.keys(context).length > 0) {
      formatted += `\nContext: ${JSON.stringify(context, null, 2)}`;
    }
    
    return formatted;
  }

  private log(entry: LogEntry) {
    // In development, log to console with better formatting
    if (this.isDevelopment) {
      const formattedEntry = this.formatLogEntry(entry);
      
      switch (entry.level) {
        case 'debug':
          console.debug(`🔍 ${formattedEntry}`);
          break;
        case 'info':
          console.info(`ℹ️ ${formattedEntry}`);
          break;
        case 'warn':
          console.warn(`⚠️ ${formattedEntry}`);
          break;
        case 'error':
          console.error(`❌ ${formattedEntry}`);
          break;
      }
    } else {
      // In production, you could send to external logging service
      // For now, just use console methods
      switch (entry.level) {
        case 'debug':
          console.debug(entry);
          break;
        case 'info':
          console.info(entry);
          break;
        case 'warn':
          console.warn(entry);
          break;
        case 'error':
          console.error(entry);
          break;
      }
    }

    // Here you could integrate with external services like:
    // - Sentry
    // - LogRocket
    // - Datadog
    // - AWS CloudWatch
    // etc.
  }

  debug(message: string, context?: LogContext) {
    this.log(this.createLogEntry('debug', message, context));
  }

  info(message: string, context?: LogContext) {
    this.log(this.createLogEntry('info', message, context));
  }

  warn(message: string, context?: LogContext) {
    this.log(this.createLogEntry('warn', message, context));
  }

  error(message: string, context?: LogContext) {
    this.log(this.createLogEntry('error', message, context));
  }

  // Special methods for common use cases
  apiRequest(method: string, url: string, context?: LogContext) {
    this.info(`API Request: ${method} ${url}`, {
      ...context,
      type: 'api_request',
      method,
      url
    });
  }

  apiResponse(method: string, url: string, status: number, duration?: number, context?: LogContext) {
    this.info(`API Response: ${method} ${url} - ${status}`, {
      ...context,
      type: 'api_response',
      method,
      url,
      status,
      duration
    });
  }

  apiError(method: string, url: string, error: any, context?: LogContext) {
    this.error(`API Error: ${method} ${url}`, {
      ...context,
      type: 'api_error',
      method,
      url,
      error: {
        message: error?.message || 'Unknown error',
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        code: error?.code
      }
    });
  }

  userAction(action: string, userId?: string, context?: LogContext) {
    this.info(`User Action: ${action}`, {
      ...context,
      type: 'user_action',
      action,
      userId
    });
  }

  formSubmission(formName: string, success: boolean, context?: LogContext) {
    this.info(`Form Submission: ${formName}`, {
      ...context,
      type: 'form_submission',
      formName,
      success
    });
  }

  authentication(event: 'login' | 'logout' | 'failure', userId?: string, context?: LogContext) {
    this.info(`Authentication: ${event}`, {
      ...context,
      type: 'authentication',
      event,
      userId
    });
  }

  performance(metric: string, value: number, context?: LogContext) {
    this.info(`Performance: ${metric}`, {
      ...context,
      type: 'performance',
      metric,
      value
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export utility functions
export const logApiRequest = (method: string, url: string, context?: LogContext) =>
  logger.apiRequest(method, url, context);

export const logApiResponse = (method: string, url: string, status: number, duration?: number, context?: LogContext) =>
  logger.apiResponse(method, url, status, duration, context);

export const logApiError = (method: string, url: string, error: any, context?: LogContext) =>
  logger.apiError(method, url, error, context);

export const logUserAction = (action: string, userId?: string, context?: LogContext) =>
  logger.userAction(action, userId, context);

export const logFormSubmission = (formName: string, success: boolean, context?: LogContext) =>
  logger.formSubmission(formName, success, context);

export const logAuthentication = (event: 'login' | 'logout' | 'failure', userId?: string, context?: LogContext) =>
  logger.authentication(event, userId, context);

export const logPerformance = (metric: string, value: number, context?: LogContext) =>
  logger.performance(metric, value, context);
