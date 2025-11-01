import { useState, useEffect, useCallback } from 'react';

interface DatabaseError {
  type: string;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
}

interface DatabaseStats {
  totalQueries: number;
  avgResponseTime: number;
  errorRate: number;
  connectionStatus: 'healthy' | 'degraded' | 'error';
}

interface UseDatabaseMonitoringReturn {
  stats: DatabaseStats | null;
  errors: DatabaseError[];
  checkConnection: () => Promise<boolean>;
  clearErrors: () => void;
}

export function useDatabaseMonitoring(
  enabled: boolean = true,
  thresholdMs: number = 1000,
  errorRateThreshold: number = 0.1
): UseDatabaseMonitoringReturn {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [errors, setErrors] = useState<DatabaseError[]>([]);

  const recordQuery = useCallback((duration: number, success: boolean) => {
    if (!enabled) return;

    const timestamp = new Date();
    
    setStats(prevStats => {
      if (!prevStats) {
        return {
          totalQueries: 1,
          avgResponseTime: duration,
          errorRate: success ? 0 : 1,
          connectionStatus: success ? 'healthy' : 'degraded'
        };
      }

      const newTotal = prevStats.totalQueries + 1;
      const newAvgTime = ((prevStats.avgResponseTime * prevStats.totalQueries) + duration) / newTotal;
      const newErrorRate = success 
        ? (prevStats.errorRate * prevStats.totalQueries) / newTotal
        : ((prevStats.errorRate * prevStats.totalQueries) + 1) / newTotal;

      // Determine connection status based on error rate and response time
      let connectionStatus: DatabaseStats['connectionStatus'] = 'healthy';
      if (newErrorRate >= errorRateThreshold || newAvgTime > thresholdMs) {
        connectionStatus = 'degraded';
      }
      if (newErrorRate >= errorRateThreshold * 2 || newAvgTime > thresholdMs * 2) {
        connectionStatus = 'error';
      }

      return {
        totalQueries: newTotal,
        avgResponseTime: newAvgTime,
        errorRate: newErrorRate,
        connectionStatus
      };
    });
  }, [enabled, thresholdMs, errorRateThreshold]);

  const recordError = useCallback((errorType: string, message: string, context?: Record<string, any>) => {
    if (!enabled) return;

    const error: DatabaseError = {
      type: errorType,
      message,
      timestamp: new Date(),
      context
    };

    setErrors(prev => [...prev.slice(-9), error]); // Keep last 10 errors
  }, [enabled]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const start = Date.now();
      
      // Perform a simple database query to check connection
      const response = await fetch('/api/admin/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const duration = Date.now() - start;
      
      const success = response.ok && duration < thresholdMs;
      recordQuery(duration, success);

      return success;
    } catch (error) {
      recordError('CONNECTION_CHECK_ERROR', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }, [thresholdMs, recordQuery, recordError]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Monitor connection health periodically
  useEffect(() => {
    if (!enabled) return;

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    // Initial connection check
    checkConnection();

    return () => clearInterval(interval);
  }, [enabled, checkConnection]);

  return {
    stats,
    errors,
    checkConnection,
    clearErrors
  };
}

// Simplified utility function for use in API routes (without logger)
export function createDatabaseMonitor() {
  return {
    recordQuery: (duration: number, success: boolean) => {
      // No logging - just return success status
      return success;
    },

    recordError: (errorType: string, message: string, context?: Record<string, any>) => {
      // No logging - just record the error info
      return {
        type: errorType,
        message,
        context,
        timestamp: new Date().toISOString()
      };
    }
  };
}

export default useDatabaseMonitoring;

