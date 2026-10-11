// Simple error handling utilities without external dependencies
// Removed logger for simplicity - using React state management instead

export interface ErrorInfo {
  message: string;
  code?: string;
  status?: number;
}

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

function toErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
}

export function handleApiError(error: unknown): ErrorInfo {
  const err = toErrorLike(error);
  return {
    message: typeof err.message === 'string' ? err.message : 'An API error occurred',
    code: typeof err.code === 'string' ? err.code : undefined,
    status: typeof err.status === 'number' ? err.status : undefined
  };
}

export function handleValidationError(error: unknown): ErrorInfo {
  const err = toErrorLike(error);
  return {
    message: typeof err.message === 'string' ? err.message : 'Validation failed',
    code: 'VALIDATION_ERROR'
  };
}

export function handleDatabaseError(error: unknown): ErrorInfo {
  const err = toErrorLike(error);
  return {
    message: typeof err.message === 'string' ? err.message : 'Database error occurred',
    code: 'DATABASE_ERROR'
  };
}

export function handleAuthenticationError(error: unknown): ErrorInfo {
  const err = toErrorLike(error);
  return {
    message: typeof err.message === 'string' ? err.message : 'Authentication required',
    code: 'AUTH_ERROR'
  };
}

export function handleGenericError(error: unknown): ErrorInfo {
  const err = toErrorLike(error);
  return {
    message: typeof err.message === 'string' ? err.message : 'An unexpected error occurred',
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
