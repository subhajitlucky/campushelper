// Simple error handling utilities without external dependencies
// Removed logger for simplicity - using React state management instead

export interface ErrorInfo {
  message: string;
  code?: string;
  status?: number;
}

export function handleApiError(error: any): ErrorInfo {
  return {
    message: error?.message || 'An API error occurred',
    code: error?.code,
    status: error?.status
  };
}

export function handleValidationError(error: any): ErrorInfo {
  return {
    message: error?.message || 'Validation failed',
    code: 'VALIDATION_ERROR'
  };
}

export function handleDatabaseError(error: any): ErrorInfo {
  return {
    message: error?.message || 'Database error occurred',
    code: 'DATABASE_ERROR'
  };
}

export function handleAuthenticationError(error: any): ErrorInfo {
  return {
    message: error?.message || 'Authentication required',
    code: 'AUTH_ERROR'
  };
}

export function handleGenericError(error: any): ErrorInfo {
  return {
    message: error?.message || 'An unexpected error occurred',
    code: 'GENERIC_ERROR'
  };
}

// Success handlers (simplified)
export function handleSuccess(message: string): string {
  return message;
}

export function handleInfo(message: string): string {
  return message;
}

export function handleWarning(message: string): string {
  return message;
}
