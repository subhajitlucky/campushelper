// Simplified API request hook without logger dependencies
// Using React state management for error handling instead

import { useState, useCallback } from 'react';

// Error handling utilities
export interface ApiError {
  error: string;
  code?: string;
  details?: any;
  timestamp?: string;
}

export interface UseApiRequestOptions {
  showToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
  onError?: (error: ApiError) => void;
  onSuccess?: (data: any) => void;
  retryCount?: number;
  retryDelay?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface UseApiRequestReturn<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
}

const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  'AUTHENTICATION_REQUIRED': 'Please log in to continue',
  'AUTHORIZATION_DENIED': 'You do not have permission to perform this action',
  'VALIDATION_ERROR': 'Please check your input and try again',
  'NOT_FOUND': 'The requested resource was not found',
  'DATABASE_ERROR': 'A database error occurred. Please try again later',
  'INTERNAL_SERVER_ERROR': 'An unexpected error occurred. Please try again later',
  'NETWORK_ERROR': 'Network connection error. Please check your internet connection',
  'TIMEOUT_ERROR': 'Request timed out. Please try again',
  'UNKNOWN_ERROR': 'An unexpected error occurred'
};

function getErrorMessage(error: any): { userMessage: string; logMessage: string; code: string } {
  // If it's already an API error from our standardized system
  if (error?.error && error?.code) {
    const userMessage = DEFAULT_ERROR_MESSAGES[error.code] || error.error;
    return {
      userMessage,
      logMessage: `API Error [${error.code}]: ${error.error}`,
      code: error.code
    };
  }

  // Handle network errors
  if (!error?.response) {
    if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
      return {
        userMessage: DEFAULT_ERROR_MESSAGES.NETWORK_ERROR,
        logMessage: `Network Error: ${error.message}`,
        code: 'NETWORK_ERROR'
      };
    }
    
    if (error?.code === 'ECONNABORTED') {
      return {
        userMessage: DEFAULT_ERROR_MESSAGES.TIMEOUT_ERROR,
        logMessage: `Timeout Error: ${error.code}`,
        code: 'TIMEOUT_ERROR'
      };
    }

    return {
      userMessage: DEFAULT_ERROR_MESSAGES.UNKNOWN_ERROR,
      logMessage: `Unknown Error: ${JSON.stringify(error)}`,
      code: 'UNKNOWN_ERROR'
    };
  }

  // Handle HTTP response errors
  const status = error.response.status;
  const statusText = error.response.statusText;

  switch (status) {
    case 400:
      return {
        userMessage: error.response.data?.error || 'Invalid request',
        logMessage: `HTTP 400: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'BAD_REQUEST'
      };
    case 401:
      return {
        userMessage: DEFAULT_ERROR_MESSAGES.AUTHENTICATION_REQUIRED,
        logMessage: `HTTP 401: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'AUTHENTICATION_REQUIRED'
      };
    case 403:
      return {
        userMessage: DEFAULT_ERROR_MESSAGES.AUTHORIZATION_DENIED,
        logMessage: `HTTP 403: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'AUTHORIZATION_DENIED'
      };
    case 404:
      return {
        userMessage: DEFAULT_ERROR_MESSAGES.NOT_FOUND,
        logMessage: `HTTP 404: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'NOT_FOUND'
      };
    case 409:
      return {
        userMessage: error.response.data?.error || 'Conflict occurred',
        logMessage: `HTTP 409: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'CONFLICT'
      };
    case 422:
      return {
        userMessage: error.response.data?.error || 'Validation failed',
        logMessage: `HTTP 422: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'VALIDATION_ERROR'
      };
    case 500:
      return {
        userMessage: DEFAULT_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        logMessage: `HTTP 500: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'INTERNAL_SERVER_ERROR'
      };
    case 503:
      return {
        userMessage: 'Service temporarily unavailable. Please try again later',
        logMessage: `HTTP 503: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: 'SERVICE_UNAVAILABLE'
      };
    default:
      return {
        userMessage: `HTTP ${status}: ${statusText}`,
        logMessage: `HTTP ${status}: ${statusText} - ${JSON.stringify(error.response.data)}`,
        code: `HTTP_${status}`
      };
  }
}

export function useApiRequest<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  options: UseApiRequestOptions = {}
): UseApiRequestReturn<T> {
  const {
    showToast = true,
    successMessage,
    errorMessage,
    onError,
    onSuccess,
    retryCount = 0,
    retryDelay = 1000,
    logLevel = 'info'
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    const startTime = Date.now();

    try {
      
      const result = await apiFunction(...args);
      
      const duration = Date.now() - startTime;
      
      setData(result);
      
      if (onSuccess) {
        onSuccess(result);
      }

      if (successMessage && showToast) {
        // showSuccess(successMessage); // Removed showSuccess - use state management
      }
  
      // logger.info(`API Success: ${apiFunction.name || 'anonymous'}`, { // Removed logger
      //   duration,
      //   success: true,
      //   result: result
      // });
  
      return result;
  
    } catch (err: any) {
      const { userMessage } = getErrorMessage(err);
      const duration = Date.now() - startTime;
      
      const apiError = {
        error: userMessage,
        code: err?.code || 'API_ERROR',
        details: err?.response?.data || err,
        timestamp: new Date().toISOString()
      };

      setError(apiError);
  
      // Call custom error handler
      if (onError) {
        onError(err);
      }
  
      // Use React state management for error display instead of toasts
      // if (showToast) {
      //   // showError(errorMessage || userMessage); // Removed showError - use state management
      // }

      return null;

    } finally {
      setIsLoading(false);
    }
  }, [apiFunction, showToast, successMessage, errorMessage, onError, onSuccess]);

  const retry = useCallback(async (): Promise<T | null> => {
    if (retryCount <= 0) {
      return execute();
    }

    setIsLoading(true);
    
    for (let i = 0; i < retryCount; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
        const result = await execute();
        if (result) return result;
      } catch (err) {
        if (i === retryCount - 1) {
          throw err;
        }
      }
    }

    return null;
  }, [execute, retryCount, retryDelay]);

  return {
    data,
    error,
    isLoading,
    isError: !!error,
    isSuccess: !!data && !error,
    execute,
    reset,
    retry
  };
}
