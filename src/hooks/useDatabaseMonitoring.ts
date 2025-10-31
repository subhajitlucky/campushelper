import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { DatabaseError, DatabaseErrorType } from '@/lib/database-errors';

interface DatabaseMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageResponseTime: number;
  errorRate: number;
  lastError?: DatabaseError;
  connectionStatus: 'connected' | 'disconnected' | 'checking';
}

interface DatabaseMonitoringOptions {
  enablePerformanceTracking?: boolean;
  enableErrorTracking?: boolean;
  enableConnectionMonitoring?: boolean;
  alertThreshold?: number; // Alert when error rate exceeds this percentage
}

interface UseDatabaseMonitoringReturn {
  metrics: DatabaseMetrics;
  trackQuery: (duration: number, success: boolean, error?: DatabaseError) => void;
  checkConnection: () => Promise<boolean>;
  resetMetrics: () => void;
  errorRate: number;
  isHealthy: boolean;
}

export function useDatabaseMonitoring(
  options: DatabaseMonitoringOptions = {}
): UseDatabaseMonitoringReturn {
  const {
    enablePerformanceTracking = true,
    enableErrorTracking = true,
    enableConnectionMonitoring = true,
    alertThreshold = 5 // 5% error rate threshold
  } = options;

  const [metrics, setMetrics] = useState<DatabaseMetrics>({
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageResponseTime: 0,
    errorRate: 0,
    connectionStatus: 'checking'
  });

  // Track query performance and errors
  const trackQuery = useCallback((duration: number, success: boolean, error?: DatabaseError) => {
    setMetrics(prev => {
      const newTotal = prev.totalQueries + 1;
      const newSuccessful = success ? prev.successfulQueries + 1 : prev.successfulQueries;
      const newFailed = success ? prev.failedQueries : prev.failedQueries + 1;
      
      // Calculate average response time (using exponential moving average)
      const alpha = 0.1; // Smoothing factor
      const newAverageTime = prev.totalQueries === 0 
        ? duration 
        : (alpha * duration) + ((1 - alpha) * prev.averageResponseTime);
      
      // Calculate error rate
      const errorRate = (newFailed / newTotal) * 100;
      
      const newMetrics: DatabaseMetrics = {
        totalQueries: newTotal,
        successfulQueries: newSuccessful,
        failedQueries: newFailed,
        averageResponseTime: newAverageTime,
        errorRate,
        lastError: error || prev.lastError,
        connectionStatus: 'connected'
      };

      // Log metrics if performance tracking is enabled
      if (enablePerformanceTracking) {
        logger.performance('database_query', duration, {
          success,
          errorType: error?.type,
          totalQueries: newTotal,
          errorRate
        });
      }

      // Log errors if error tracking is enabled
      if (enableErrorTracking && error) {
        logger.error(`Database Error: ${error.type}`, {
          errorType: error.type,
          userMessage: error.userMessage,
          canRetry: error.canRetry,
          shouldContactSupport: error.shouldContactSupport,
          context: error
        });

        // Alert if error rate exceeds threshold
        if (errorRate > alertThreshold) {
          logger.error('High database error rate detected', {
            errorRate,
            threshold: alertThreshold,
            totalQueries: newTotal,
            failedQueries: newFailed,
            lastError: error
          });
        }
      }

      return newMetrics;
    });
  }, [enablePerformanceTracking, enableErrorTracking, alertThreshold]);

  // Check database connection
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setMetrics(prev => ({ ...prev, connectionStatus: 'checking' }));
    
    try {
      const startTime = Date.now();
      
      // Simple connection test - you might want to customize this
      const response = await fetch('/api/items?page=1&limit=1', { 
        method: 'HEAD' // Use HEAD to avoid fetching data
      });
      
      const duration = Date.now() - startTime;
      const isConnected = response.ok || response.status === 200 || response.status === 401; // 401 is ok (means DB is responding)
      
      setMetrics(prev => ({
        ...prev,
        connectionStatus: isConnected ? 'connected' : 'disconnected'
      }));

      if (enableConnectionMonitoring) {
        logger.info('Database connection check', {
          status: isConnected ? 'success' : 'failed',
          responseTime: duration,
          statusCode: response.status
        });
      }

      return isConnected;
    } catch (error) {
      setMetrics(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      
      if (enableConnectionMonitoring) {
        logger.error('Database connection check failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      return false;
    }
  }, [enableConnectionMonitoring]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    setMetrics({
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      errorRate: 0,
      connectionStatus: 'checking'
    });
  }, []);

  // Auto-check connection if monitoring is enabled
  useEffect(() => {
    if (enableConnectionMonitoring) {
      checkConnection();
      
      // Check connection every 30 seconds
      const interval = setInterval(checkConnection, 30000);
      
      return () => clearInterval(interval);
    }
  }, [enableConnectionMonitoring, checkConnection]);

  // Calculate if database is healthy
  const isHealthy = metrics.connectionStatus === 'connected' && metrics.errorRate <= alertThreshold;

  return {
    metrics,
    trackQuery,
    checkConnection,
    resetMetrics,
    errorRate: metrics.errorRate,
    isHealthy
  };
}
