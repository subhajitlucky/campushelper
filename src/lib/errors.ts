import { NextResponse } from 'next/server';
import { DatabaseErrorHandler } from './database-errors';

/**
 * Standardized error codes for consistent API responses
 */
export const ErrorCodes = {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  INVALID_SESSION: 'INVALID_SESSION',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation & Input
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_EMAIL: 'INVALID_EMAIL',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  
  // Resource Operations
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
  
  // Database & Server
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Permission & Access
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ADMIN_ACCESS_REQUIRED: 'ADMIN_ACCESS_REQUIRED',
  SELF_MODIFICATION_DENIED: 'SELF_MODIFICATION_DENIED',
  CANNOT_MODIFY_ADMIN: 'CANNOT_MODIFY_ADMIN',
  
  // Business Logic
  INVALID_ITEM_STATUS: 'INVALID_ITEM_STATUS',
  COMMENT_NOT_EDITABLE: 'COMMENT_NOT_EDITABLE',
  CLAIM_ALREADY_PROCESSED: 'CLAIM_ALREADY_PROCESSED',
  USER_ALREADY_SUSPENDED: 'USER_ALREADY_SUSPENDED',
  USER_ALREADY_ACTIVE: 'USER_ALREADY_ACTIVE',
  ROLE_ALREADY_ASSIGNED: 'ROLE_ALREADY_ASSIGNED',
  
  // Rate Limiting & Security
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_CSRF_TOKEN: 'INVALID_CSRF_TOKEN',
  
  // General
  BAD_REQUEST: 'BAD_REQUEST',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  UNSUPPORTED_ACTION: 'UNSUPPORTED_ACTION'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Standardized error response interface
 */
export interface ApiError {
  error: string;
  code: ErrorCode;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  code: ErrorCode,
  status: number = 500,
  details?: Record<string, any>
): NextResponse {
  const error: ApiError = {
    error: message,
    code,
    details,
    timestamp: new Date().toISOString()
  };
  
  return NextResponse.json(error, { status });
}

/**
 * Common error response creators
 */

// Authentication Errors
export const AuthenticationRequired = (message: string = 'Authentication required. Please log in to access this resource.') =>
  createErrorResponse(message, ErrorCodes.AUTHENTICATION_REQUIRED, 401);

export const AuthorizationDenied = (message: string = 'You do not have permission to access this resource.') =>
  createErrorResponse(message, ErrorCodes.AUTHORIZATION_DENIED, 403);

export const InvalidSession = (message: string = 'Your session is invalid or has expired. Please log in again.') =>
  createErrorResponse(message, ErrorCodes.INVALID_SESSION, 401);

export const ForbiddenError = (message: string = 'You do not have permission to access this resource.') =>
  createErrorResponse(message, ErrorCodes.AUTHORIZATION_DENIED, 403);

// Validation Errors
export const ValidationError = (message: string, details?: Record<string, any>) =>
  createErrorResponse(message, ErrorCodes.VALIDATION_ERROR, 400, details);

export const MissingRequiredField = (field: string) =>
  createErrorResponse(`Required field '${field}' is missing or invalid`, ErrorCodes.MISSING_REQUIRED_FIELD, 400);

export const InvalidInput = (message: string) =>
  createErrorResponse(message, ErrorCodes.INVALID_INPUT, 400);

// Resource Errors
export const NotFound = (resource: string = 'Resource') =>
  createErrorResponse(`${resource} not found`, ErrorCodes.NOT_FOUND, 404);

export const AlreadyExists = (resource: string) =>
  createErrorResponse(`${resource} already exists`, ErrorCodes.ALREADY_EXISTS, 409);

export const Conflict = (message: string) =>
  createErrorResponse(message, ErrorCodes.CONFLICT, 409);

// Permission Errors
export const AdminAccessRequired = () =>
  createErrorResponse('Admin or moderator access required to perform this action', ErrorCodes.ADMIN_ACCESS_REQUIRED, 403);

export const InsufficientPermissions = () =>
  createErrorResponse('You do not have sufficient permissions to perform this action', ErrorCodes.INSUFFICIENT_PERMISSIONS, 403);

export const SelfModificationDenied = () =>
  createErrorResponse('You cannot modify your own account', ErrorCodes.SELF_MODIFICATION_DENIED, 400);

export const CannotModifyAdmin = () =>
  createErrorResponse('Only super administrators can modify admin accounts', ErrorCodes.CANNOT_MODIFY_ADMIN, 403);

// Business Logic Errors
export const InvalidItemStatus = () =>
  createErrorResponse('Invalid item status for this operation', ErrorCodes.INVALID_ITEM_STATUS, 400);

export const CommentNotEditable = () =>
  createErrorResponse('Comments cannot be edited after item resolution or deletion', ErrorCodes.COMMENT_NOT_EDITABLE, 400);

export const UserAlreadySuspended = () =>
  createErrorResponse('User is already suspended', ErrorCodes.USER_ALREADY_SUSPENDED, 400);

export const UserAlreadyActive = () =>
  createErrorResponse('User is already active', ErrorCodes.USER_ALREADY_ACTIVE, 400);

export const RoleAlreadyAssigned = () =>
  createErrorResponse('User already has this role', ErrorCodes.ROLE_ALREADY_ASSIGNED, 400);

// Database & Server Errors
export const DatabaseError = () =>
  createErrorResponse(
    'A database error occurred while processing your request',
    ErrorCodes.DATABASE_ERROR,
    500,
    undefined // Never leak error details
  );

export const InternalServerError = (message: string = 'An unexpected error occurred') =>
  createErrorResponse(message, ErrorCodes.INTERNAL_SERVER_ERROR, 500);

// General Errors
export const BadRequest = (message: string) =>
  createErrorResponse(message, ErrorCodes.BAD_REQUEST, 400);

export const MethodNotAllowed = () =>
  createErrorResponse('HTTP method not allowed for this endpoint', ErrorCodes.METHOD_NOT_ALLOWED, 405);

export const UnsupportedAction = (action: string) =>
  createErrorResponse(`Action '${action}' is not supported`, ErrorCodes.UNSUPPORTED_ACTION, 400);

/**
 * Parse Prisma errors and return appropriate standardized response
 */
export function handlePrismaError(error: any): NextResponse {
  // Use our comprehensive database error handler
  const dbError = DatabaseErrorHandler.handlePrismaError(error);
  return DatabaseErrorHandler.toNextResponse(dbError);
}

/**
 * Safe async wrapper that catches all errors and returns standardized response
 */
export async function safeApiHandler<T>(
  handler: () => Promise<T>,
  onError?: (error: any) => NextResponse
): Promise<NextResponse | T> {
  try {
    return await handler();
  } catch (error) {
    // If handler already returned a NextResponse, return it as is
    if (error instanceof Response && 'cookies' in error) {
      return error as NextResponse;
    }
    
    // If custom error handler provided, use it
    if (onError) {
      return onError(error);
    }
    
    // Handle Prisma errors
    if ((error as any)?.name === 'PrismaClientKnownRequestError' || (error as any)?.code) {
      const dbError = DatabaseErrorHandler.handlePrismaError(error);
      return DatabaseErrorHandler.toNextResponse(dbError);
    }
    
    // Handle validation errors
    if ((error as any)?.name === 'ZodError') {
      const validationErrors = (error as any).issues?.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return ValidationError(`Validation failed: ${validationErrors}`, { issues: (error as any).issues });
    }
    
    // Handle NextAuth errors
    if ((error as any)?.name === 'NextAuthError') {
      return AuthenticationRequired('Authentication failed. Please log in again.');
    }
    
    // Handle generic Error objects
    if (error instanceof Error) {
      return InternalServerError(error.message);
    }
    
    // Return internal server error
    return InternalServerError();
  }
}
