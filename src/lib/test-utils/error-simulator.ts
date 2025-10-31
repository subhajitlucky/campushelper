// Error simulation utilities for testing error handling

export interface SimulatedError {
  name: string;
  message: string;
  code?: string;
  status?: number;
  response?: {
    data: any;
    status: number;
    statusText: string;
  };
  stack?: string;
}

/**
 * Create a simulated API error response
 */
export function createSimulatedApiError(
  status: number,
  errorMessage: string,
  errorCode?: string,
  details?: any
): SimulatedError {
  const statusTextMap: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    503: 'Service Unavailable'
  };

  const responseData = {
    error: errorMessage,
    code: errorCode || `HTTP_${status}`,
    details,
    timestamp: new Date().toISOString()
  };

  return {
    name: 'Error',
    message: `Request failed with status ${status}`,
    code: errorCode,
    status,
    response: {
      data: responseData,
      status,
      statusText: statusTextMap[status] || 'Unknown Error'
    },
    stack: `Error: Request failed with status ${status}\n    at createSimulatedApiError (error-simulator.ts:1:1)`
  };
}

/**
 * Create a simulated network error
 */
export function createNetworkError(message: string = 'Network Error'): SimulatedError {
  return {
    name: 'TypeError',
    message,
    stack: `TypeError: ${message}\n    at createNetworkError (error-simulator.ts:1:1)`
  };
}

/**
 * Create a simulated Prisma error
 */
export function createPrismaError(
  code: string,
  message: string,
  meta?: any
): SimulatedError {
  return {
    name: 'PrismaClientKnownRequestError',
    code,
    message: `${code}: ${message}`,
    stack: `PrismaClientKnownRequestError: ${code}: ${message}\n    at createPrismaError (error-simulator.ts:1:1)`
  };
}

// Predefined error scenarios for testing
export const ERROR_SCENARIOS = {
  // Authentication Errors
  AUTHENTICATION_REQUIRED: createSimulatedApiError(
    401,
    'Authentication required. Please log in to access this resource.',
    'AUTHENTICATION_REQUIRED'
  ),
  
  AUTHORIZATION_DENIED: createSimulatedApiError(
    403,
    'You do not have permission to access this resource.',
    'AUTHORIZATION_DENIED'
  ),

  // Validation Errors
  VALIDATION_ERROR: createSimulatedApiError(
    422,
    'Validation failed',
    'VALIDATION_ERROR',
    {
      issues: [
        { field: 'title', message: 'Title is required' },
        { field: 'email', message: 'Email is invalid' }
      ]
    }
  ),

  NOT_FOUND: createSimulatedApiError(
    404,
    'Resource not found',
    'NOT_FOUND'
  ),

  UNIQUE_CONSTRAINT: createPrismaError(
    'P2002',
    'Unique constraint violation',
    { target: ['email'] }
  ),

  FOREIGN_KEY_VIOLATION: createPrismaError(
    'P2003',
    'Foreign key constraint violation',
    { field_name: 'userId' }
  ),

  RECORD_NOT_FOUND: createPrismaError(
    'P2025',
    'Record not found'
  ),

  // Server Errors
  INTERNAL_SERVER_ERROR: createSimulatedApiError(
    500,
    'An unexpected error occurred. Please try again later.',
    'INTERNAL_SERVER_ERROR'
  ),

  DATABASE_ERROR: createSimulatedApiError(
    500,
    'A database error occurred while processing your request',
    'DATABASE_ERROR'
  ),

  CONNECTION_TIMEOUT: createSimulatedApiError(
    503,
    'Service temporarily unavailable. Please try again later.',
    'SERVICE_UNAVAILABLE'
  ),

  // Network Errors
  NETWORK_ERROR: createNetworkError('Failed to fetch'),
  TIMEOUT_ERROR: createNetworkError('Request timed out')
};

/**
 * Simulate different response delays for testing loading states
 */
export function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock fetch function for testing
 */
export function createMockFetch(responses: Record<string, Response>): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    
    // Find matching response
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return response;
      }
    }
    
    // Default response
    return new Response(
      JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  };
}

/**
 * Create a mock Response object
 */
export function createMockResponse(
  data: any,
  status: number = 200,
  statusText: string = 'OK'
): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Create validation errors for form testing
 */
export function createValidationErrors(errors: Record<string, string>): Record<string, string> {
  return { ...errors };
}

/**
 * Helper to test error boundary behavior
 */
export function createComponentError(message: string = 'Test component error'): Error {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at createComponentError (error-simulator.ts:1:1)`;
  return error;
}

/**
 * Simulate database connection issues
 */
export function createConnectionError(): SimulatedError {
  return {
    name: 'Error',
    message: 'Database connection failed',
    stack: 'Error: Database connection failed\n    at createConnectionError (error-simulator.ts:1:1)'
  };
}

/**
 * Simulate different HTTP methods with errors
 */
export const createErrorResponse = {
  GET: (status: number, error: string, code?: string) => 
    createMockResponse({ error, code, timestamp: new Date().toISOString() }, status),
  
  POST: (status: number, error: string, code?: string, details?: any) =>
    createMockResponse({ error, code, details, timestamp: new Date().toISOString() }, status),
  
  PUT: (status: number, error: string, code?: string, details?: any) =>
    createMockResponse({ error, code, details, timestamp: new Date().toISOString() }, status),
  
  DELETE: (status: number, error: string, code?: string) =>
    createMockResponse({ error, code, timestamp: new Date().toISOString() }, status)
};
