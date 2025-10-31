import { useState, useCallback, useRef } from 'react';

interface UseLoadingOptions {
  initialState?: boolean;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  successDelay?: number;
}

interface UseLoadingReturn {
  // State
  loading: boolean;
  isLoading: boolean;
  progress: number;
  
  // Actions
  startLoading: () => void;
  stopLoading: () => void;
  setProgress: (progress: number) => void;
  resetProgress: () => void;
  withLoading: <T>(asyncFn: () => Promise<T>) => Promise<T>;
  
  // Utility
  isIdle: boolean;
}

/**
 * Comprehensive loading state hook with progress tracking
 * Provides consistent loading states across the application
 */
export function useLoading(options: UseLoadingOptions = {}): UseLoadingReturn {
  const { initialState = false, onSuccess, onError, successDelay = 0 } = options;
  const [loading, setLoading] = useState(initialState);
  const [progress, setProgressValue] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    setProgressValue(0);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
    setProgressValue(100);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setProgress = useCallback((newProgress: number) => {
    setProgressValue(Math.max(0, Math.min(100, newProgress)));
  }, []);

  const resetProgress = useCallback(() => {
    setProgressValue(0);
  }, []);

  const withLoading = useCallback(async <T>(
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    try {
      startLoading();
      const result = await asyncFn();
      
      // Call success callback after delay if provided
      if (onSuccess) {
        if (successDelay > 0) {
          timeoutRef.current = setTimeout(() => {
            onSuccess();
            timeoutRef.current = null;
          }, successDelay);
        } else {
          onSuccess();
        }
      }
      
      return result;
    } catch (error) {
      // Call error callback
      if (onError) {
        onError(error);
      }
      throw error;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading, onSuccess, onError, successDelay]);

  const isIdle = !loading && progress === 0;
  const isLoading = loading;

  return {
    // State
    loading,
    isLoading,
    progress,
    
    // Actions
    startLoading,
    stopLoading,
    setProgress,
    resetProgress,
    withLoading,
    
    // Utility
    isIdle,
  };
}

/**
 * Simplified loading hook for basic use cases
 */
export function useSimpleLoading(initialState = false) {
  const [loading, setLoading] = useState(initialState);

  const startLoading = useCallback(() => setLoading(true), []);
  const stopLoading = useCallback(() => setLoading(false), []);
  const toggleLoading = useCallback(() => setLoading(prev => !prev), []);

  return {
    loading,
    startLoading,
    stopLoading,
    toggleLoading,
    isLoading: loading,
    isIdle: !loading,
  };
}

/**
 * Loading hook specifically for API requests
 */
export function useApiLoading(initialState = false) {
  const [loading, setLoading] = useState(initialState);
  const [progress, setProgressValue] = useState(0);
  const [error, setErrorValue] = useState<any>(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    setProgressValue(0);
    setErrorValue(null);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
    setProgressValue(100);
  }, []);

  const setError = useCallback((error: any) => {
    setErrorValue(error);
    setLoading(false);
  }, []);

  const executeWithLoading = useCallback(async <T>(
    apiCall: () => Promise<T>
  ): Promise<T | null> => {
    try {
      startLoading();
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgressValue(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await apiCall();
      
      clearInterval(progressInterval);
      setProgressValue(100);
      return result;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading, setError]);

  return {
    // State
    loading,
    isLoading: loading,
    progress,
    error,
    isIdle: !loading && !error,
    isSuccess: !loading && !error && progress === 100,
    hasError: !!error,
    
    // Actions
    startLoading,
    stopLoading,
    executeWithLoading,
    
    // Utility
    reset: () => {
      setLoading(false);
      setProgressValue(0);
      setErrorValue(null);
    }
  };
}
