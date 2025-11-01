// Simplified database error handling without logger dependencies
// Using React state management for error handling instead

import { NextResponse } from 'next/server';

/**
 * Database error types for more specific error handling
 */
export const DatabaseErrorTypes = {
  // Constraint Violations
  UNIQUE_CONSTRAINT_VIOLATION: 'UNIQUE_CONSTRAINT_VIOLATION',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  CHECK_CONSTRAINT_VIOLATION: 'CHECK_CONSTRAINT_VIOLATION',
  
  // Record Issues
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  RECORD_ALREADY_EXISTS: 'RECORD_ALREADY_EXISTS',
  
  // Relationship Issues
  REQUIRED_RELATION_MISSING: 'REQUIRED_RELATION_MISSING',
  RELATION_CONFLICT: 'RELATION_CONFLICT',
  
  // Query Issues
  QUERY_INTERPRETATION_ERROR: 'QUERY_INTERPRETATION_ERROR',
  INVALID_QUERY_PARAMETERS: 'INVALID_QUERY_PARAMETERS',
  VALUE_RANGE_ERROR: 'VALUE_RANGE_ERROR',
  
  // Connection Issues
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  TRANSACTION_CONFLICT: 'TRANSACTION_CONFLICT',
  DEADLOCK_DETECTED: 'DEADLOCK_DETECTED',
  CONNECTION_TIMEOUT_ERROR: 'CONNECTION_TIMEOUT_ERROR',
  
  // Schema Issues
  INVALID_SCHEMA_CHANGE: 'INVALID_SCHEMA_CHANGE',
  MIGRATION_ERROR: 'MIGRATION_ERROR',
  
  // Generic
  UNKNOWN_DATABASE_ERROR: 'UNKNOWN_DATABASE_ERROR'
} as const;

export type DatabaseErrorType = typeof DatabaseErrorTypes[keyof typeof DatabaseErrorTypes];

/**
 * Database error with recovery information
 */
export interface DatabaseError {
  type: DatabaseErrorType;
  message: string;
  technicalDetails?: string;
  field?: string; // Field that caused the error
  table?: string; // Table involved in the error
  constraint?: string; // Constraint name if applicable
  recoverySuggestions: string[];
  userMessage: string;
  logLevel: 'warn' | 'error' | 'critical';
  canRetry: boolean;
  shouldContactSupport: boolean;
}

/**
 * Database error handler that converts Prisma errors to user-friendly messages
 */
export class DatabaseErrorHandler {
  
  /**
   * Handle Prisma-specific database errors
   */
  static handlePrismaError(error: any, context?: string): DatabaseError {
    const prismaError = error?.code;
    
    switch (prismaError) {
      case 'P2002': {
        // Unique constraint violation
        const field = error.meta?.target?.[0] || 'field';
        return this.createUniqueConstraintError(field, context);
      }
      
      case 'P2025': {
        // Record not found
        return this.createRecordNotFoundError(context);
      }
      
      case 'P2003': {
        // Foreign key constraint violation
        const field = error.meta?.field_name || 'field';
        return this.createForeignKeyError(field, context);
      }
      
      case 'P2014': {
        // Required relation not satisfied
        return this.createRelationError(context);
      }
      
      case 'P2016': {
        // Query interpretation error
        return this.createQueryInterpretationError(context);
      }
      
      case 'P2000': {
        // Column value out of range for type
        const field = error.meta?.column || 'field';
        return this.createValueRangeError(field, context);
      }
      
      case 'P2001': {
        // Record does not exist in the required relation
        return this.createRecordRelationError(context);
      }
      
      case 'P2012': {
        // Required value is missing
        const field = error.meta?.path?.[0] || 'field';
        return this.createRequiredValueError(field, context);
      }
      
      case 'P2013': {
        // Missing required argument
        const argument = error.meta?.argument || 'argument';
        return this.createMissingArgumentError(argument, context);
      }
      
      case 'P2015': {
        // Related record not found
        return this.createRelatedRecordNotFoundError(context);
      }
      
      case 'P2017': {
        // The records for relation are not connected
        return this.createDisconnectedRecordsError(context);
      }
      
      case 'P2018': {
        // The required connected records were not found
        return this.createConnectedRecordsNotFoundError(context);
      }
      
      case 'P2019': {
        // Input value is too long
        const field = error.meta?.column || 'field';
        return this.createValueTooLongError(field, context);
      }
      
      case 'P2020': {
        // Value out of range for the type
        return this.createValueOutOfRangeError(context);
      }
      
      case 'P2021': {
        // The table does not exist in the current database
        const table = error.meta?.table || 'table';
        return this.createTableNotExistsError(table, context);
      }
      
      case 'P2022': {
        // The column does not exist in the current database
        const column = error.meta?.column || 'column';
        return this.createColumnNotExistsError(column, context);
      }
      
      case 'P2023': {
        // Inconsistent column provided in where statement
        return this.createInconsistentColumnError(context);
      }
      
      case 'P2024': {
        // Timed out fetching a new connection from the connection pool
        return this.createConnectionTimeoutError(context);
      }
      
      default: {
        // Unknown Prisma error
        return this.createUnknownDatabaseError(error, context);
      }
    }
  }

  /**
   * Handle general database connection errors
   */
  static handleConnectionError(error: any, context?: string): DatabaseError {
    const message = error?.message || 'Unknown connection error';
    
    if (message.includes('connection') || message.includes('timeout')) {
      return {
        type: DatabaseErrorTypes.DATABASE_CONNECTION_ERROR,
        message: 'Database connection failed',
        technicalDetails: message,
        recoverySuggestions: [
          'Please try again in a few moments',
          'Check your internet connection',
          'Contact support if the problem persists'
        ],
        userMessage: 'Unable to connect to the database. Please try again later.',
        logLevel: 'error',
        canRetry: true,
        shouldContactSupport: true
      };
    }

    if (message.includes('deadlock') || message.includes('lock')) {
      return {
        type: DatabaseErrorTypes.DEADLOCK_DETECTED,
        message: 'Database transaction conflict',
        technicalDetails: message,
        recoverySuggestions: [
          'Please try the operation again',
          'The conflict will resolve automatically'
        ],
        userMessage: 'Multiple users are trying to update the same data. Please try again.',
        logLevel: 'warn',
        canRetry: true,
        shouldContactSupport: false
      };
    }

    return this.createUnknownDatabaseError(error, context);
  }

  /**
   * Create unique constraint violation error
   */
  private static createUniqueConstraintError(field: string, context?: string): DatabaseError {
    const fieldDisplayName = this.getFieldDisplayName(field);
    
    return {
      type: DatabaseErrorTypes.UNIQUE_CONSTRAINT_VIOLATION,
      message: `${fieldDisplayName} already exists`,
      technicalDetails: `Unique constraint violation on field: ${field}`,
      field,
      recoverySuggestions: [
        `Choose a different ${fieldDisplayName.toLowerCase()}`,
        'Check if you already have this record',
        `Contact support if you believe this is an error`
      ],
      userMessage: `This ${fieldDisplayName.toLowerCase()} is already taken. Please choose a different one.`,
      logLevel: 'warn',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create record not found error
   */
  private static createRecordNotFoundError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.RECORD_NOT_FOUND,
      message: 'Record not found',
      technicalDetails: `Record not found in database${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'The record may have been deleted',
        'Check if the record ID is correct',
        'Refresh the page to see the latest data'
      ],
      userMessage: 'The item you are looking for no longer exists. It may have been deleted.',
      logLevel: 'warn',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create foreign key constraint error
   */
  private static createForeignKeyError(field: string, context?: string): DatabaseError {
    const fieldDisplayName = this.getFieldDisplayName(field);
    
    return {
      type: DatabaseErrorTypes.FOREIGN_KEY_VIOLATION,
      message: `Referenced ${fieldDisplayName.toLowerCase()} does not exist`,
      technicalDetails: `Foreign key constraint violation on field: ${field}`,
      field,
      recoverySuggestions: [
        `Select an existing ${fieldDisplayName.toLowerCase()}`,
        'Create the referenced record first',
        'Contact support if this seems incorrect'
      ],
      userMessage: `The selected ${fieldDisplayName.toLowerCase()} is invalid. Please choose from the available options.`,
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create relation error
   */
  private static createRelationError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.REQUIRED_RELATION_MISSING,
      message: 'Required relationship is missing',
      technicalDetails: `Required relation not satisfied${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Ensure all required relationships are provided',
        'Check the form data for missing references',
        'Contact support if you need assistance'
      ],
      userMessage: 'Some required information is missing. Please check the form and try again.',
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create query interpretation error
   */
  private static createQueryInterpretationError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.QUERY_INTERPRETATION_ERROR,
      message: 'Invalid query parameters',
      technicalDetails: `Query interpretation error${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Check your search parameters',
        'Try different search terms',
        'Clear filters and try again'
      ],
      userMessage: 'There was an issue with your search. Please check your filters and try again.',
      logLevel: 'warn',
      canRetry: true,
      shouldContactSupport: false
    };
  }

  /**
   * Create value range error
   */
  private static createValueRangeError(field: string, context?: string): DatabaseError {
    const fieldDisplayName = this.getFieldDisplayName(field);
    
    return {
      type: DatabaseErrorTypes.VALUE_RANGE_ERROR,
      message: `${fieldDisplayName} value is out of acceptable range`,
      technicalDetails: `Column value out of range for type: ${field}`,
      field,
      recoverySuggestions: [
        `Enter a valid ${fieldDisplayName.toLowerCase()}`,
        `Check the maximum allowed length/value`,
        'Use the format specified in the help text'
      ],
      userMessage: `The ${fieldDisplayName.toLowerCase()} you entered is not valid. Please check the format and try again.`,
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create connection timeout error
   */
  private static createConnectionTimeoutError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.CONNECTION_TIMEOUT_ERROR,
      message: 'Database connection timeout',
      technicalDetails: `Connection pool timeout${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Please wait a moment and try again',
        'Check your internet connection',
        'The system may be under heavy load'
      ],
      userMessage: 'The database is taking too long to respond. Please try again in a moment.',
      logLevel: 'error',
      canRetry: true,
      shouldContactSupport: true
    };
  }

  /**
   * Create unknown database error
   */
  private static createUnknownDatabaseError(error: any, context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.UNKNOWN_DATABASE_ERROR,
      message: 'Unknown database error',
      technicalDetails: error?.message || 'Unknown error occurred',
      recoverySuggestions: [
        'Please try again',
        'Refresh the page',
        'Contact support if the problem persists'
      ],
      userMessage: 'An unexpected database error occurred. Please try again or contact support.',
      logLevel: 'error',
      canRetry: true,
      shouldContactSupport: true
    };
  }

  /**
   * Create record relation error
   */
  private static createRecordRelationError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.RECORD_NOT_FOUND,
      message: 'Record does not exist in the required relation',
      technicalDetails: `Record relation error${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Check that all referenced records exist',
        'Verify the relationship data is correct',
        'Contact support if you need assistance'
      ],
      userMessage: 'Some referenced information is missing. Please check your data and try again.',
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create required value error
   */
  private static createRequiredValueError(field: string, context?: string): DatabaseError {
    const fieldDisplayName = this.getFieldDisplayName(field);
    
    return {
      type: DatabaseErrorTypes.REQUIRED_RELATION_MISSING,
      message: `Required ${fieldDisplayName.toLowerCase()} is missing`,
      technicalDetails: `Required value missing for field: ${field}`,
      field,
      recoverySuggestions: [
        `Please provide a ${fieldDisplayName.toLowerCase()}`,
        'Check that all required fields are filled',
        'Contact support if you need assistance'
      ],
      userMessage: `Please provide a ${fieldDisplayName.toLowerCase()}. This field is required.`,
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create missing argument error
   */
  private static createMissingArgumentError(argument: string, context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.REQUIRED_RELATION_MISSING,
      message: `Missing required argument: ${argument}`,
      technicalDetails: `Missing required argument${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Check that all required parameters are provided',
        'Verify the API request is complete',
        'Contact support if you need assistance'
      ],
      userMessage: 'Some required information is missing from your request. Please check and try again.',
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create related record not found error
   */
  private static createRelatedRecordNotFoundError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.RECORD_NOT_FOUND,
      message: 'Related record not found',
      technicalDetails: `Related record not found${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Check that all related records exist',
        'Verify the relationships are correctly defined',
        'Contact support if you need assistance'
      ],
      userMessage: 'Some related information could not be found. Please check your data and try again.',
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create disconnected records error
   */
  private static createDisconnectedRecordsError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.RELATION_CONFLICT,
      message: 'Records for relation are not connected',
      technicalDetails: `Disconnected records error${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Ensure all related records are properly connected',
        'Check the relationship configuration',
        'Contact support if you need assistance'
      ],
      userMessage: 'There is an issue with the data relationships. Please contact support.',
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: true
    };
  }

  /**
   * Create connected records not found error
   */
  private static createConnectedRecordsNotFoundError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.RECORD_NOT_FOUND,
      message: 'Required connected records were not found',
      technicalDetails: `Connected records not found${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Check that all required connections exist',
        'Verify the relationship data',
        'Contact support if you need assistance'
      ],
      userMessage: 'Some required connections could not be found. Please check your data and try again.',
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create value too long error
   */
  private static createValueTooLongError(field: string, context?: string): DatabaseError {
    const fieldDisplayName = this.getFieldDisplayName(field);
    
    return {
      type: DatabaseErrorTypes.VALUE_RANGE_ERROR,
      message: `${fieldDisplayName} value is too long`,
      technicalDetails: `Input value too long for column: ${field}`,
      field,
      recoverySuggestions: [
        `Shorten the ${fieldDisplayName.toLowerCase()}`,
        `Check the maximum allowed length`,
        'Use the format specified in the help text'
      ],
      userMessage: `The ${fieldDisplayName.toLowerCase()} you entered is too long. Please shorten it and try again.`,
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create value out of range error
   */
  private static createValueOutOfRangeError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.VALUE_RANGE_ERROR,
      message: 'Value is out of acceptable range',
      technicalDetails: `Value out of range${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Enter a value within the acceptable range',
        'Check the field requirements',
        'Use the format specified in the help text'
      ],
      userMessage: 'The value you entered is not within the acceptable range. Please check and try again.',
      logLevel: 'error',
      canRetry: false,
      shouldContactSupport: false
    };
  }

  /**
   * Create table not exists error
   */
  private static createTableNotExistsError(table: string, context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.UNKNOWN_DATABASE_ERROR,
      message: `Table ${table} does not exist`,
      technicalDetails: `Table not found in database: ${table}`,
      table,
      recoverySuggestions: [
        'The database schema may be outdated',
        'Please contact support'
      ],
      userMessage: 'There is a database configuration issue. Please contact support.',
      logLevel: 'critical',
      canRetry: false,
      shouldContactSupport: true
    };
  }

  /**
   * Create column not exists error
   */
  private static createColumnNotExistsError(column: string, context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.UNKNOWN_DATABASE_ERROR,
      message: `Column ${column} does not exist`,
      technicalDetails: `Column not found in database: ${column}`,
      field: column,
      recoverySuggestions: [
        'The database schema may be outdated',
        'Please contact support'
      ],
      userMessage: 'There is a database configuration issue. Please contact support.',
      logLevel: 'critical',
      canRetry: false,
      shouldContactSupport: true
    };
  }

  /**
   * Create inconsistent column error
   */
  private static createInconsistentColumnError(context?: string): DatabaseError {
    return {
      type: DatabaseErrorTypes.QUERY_INTERPRETATION_ERROR,
      message: 'Inconsistent column in query',
      technicalDetails: `Inconsistent column in where statement${context ? ` (context: ${context})` : ''}`,
      recoverySuggestions: [
        'Check your query parameters',
        'Verify column names are correct',
        'Try clearing your search filters'
      ],
      userMessage: 'There was an issue with your search query. Please check your filters and try again.',
      logLevel: 'warn',
      canRetry: true,
      shouldContactSupport: false
    };
  }

  /**
   * Convert database error to NextResponse
   */
  static toNextResponse(error: DatabaseError, status?: number): NextResponse {
    const responseStatus = status || this.getStatusForErrorType(error.type);
    
    const responseData = {
      error: error.userMessage,
      code: `DB_${error.type}`,
      details: {
        type: error.type,
        field: error.field,
        table: error.table,
        constraint: error.constraint,
        recoverySuggestions: error.recoverySuggestions,
        canRetry: error.canRetry,
        shouldContactSupport: error.shouldContactSupport
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(responseData, { status: responseStatus });
  }

  /**
   * Get HTTP status code for database error type
   */
  private static getStatusForErrorType(errorType: DatabaseErrorType): number {
    switch (errorType) {
      case DatabaseErrorTypes.UNIQUE_CONSTRAINT_VIOLATION:
        return 409; // Conflict
      case DatabaseErrorTypes.RECORD_NOT_FOUND:
        return 404; // Not Found
      case DatabaseErrorTypes.FOREIGN_KEY_VIOLATION:
        return 400; // Bad Request
      case DatabaseErrorTypes.QUERY_INTERPRETATION_ERROR:
        return 400; // Bad Request
      case DatabaseErrorTypes.CONNECTION_TIMEOUT_ERROR:
        return 503; // Service Unavailable
      default:
        return 500; // Internal Server Error
    }
  }

  /**
   * Get user-friendly field display names
   */
  private static getFieldDisplayName(field: string): string {
    const fieldMap: Record<string, string> = {
      'email': 'Email Address',
      'name': 'Name',
      'title': 'Title',
      'description': 'Description',
      'location': 'Location',
      'itemType': 'Item Type',
      'status': 'Status',
      'userId': 'User',
      'postedById': 'Posted By'
    };

    return fieldMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
  }
}

/**
 * Convenience function to handle database errors
 */
export function handleDatabaseError(error: any, context?: string): NextResponse {
  if (error?.code && error?.code.startsWith('P')) {
    const dbError = DatabaseErrorHandler.handlePrismaError(error, context);
    return DatabaseErrorHandler.toNextResponse(dbError);
  }
  
  if (error?.message?.includes('connection') || error?.message?.includes('timeout')) {
    const dbError = DatabaseErrorHandler.handleConnectionError(error, context);
    return DatabaseErrorHandler.toNextResponse(dbError);
  }
  
  // Unknown error
  const unknownError = DatabaseErrorHandler.handlePrismaError(error, context);
  return DatabaseErrorHandler.toNextResponse(unknownError);
}
