/**
 * CSRF Token Hook
 *
 * This hook manages CSRF token lifecycle:
 * 1. Gets a fresh CSRF token on mount
 * 2. Stores it in memory
 * 3. Provides it for API requests
 */

import { useState, useCallback, useEffect } from 'react';

export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get a fresh CSRF token
  const getCsrfToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error('Failed to get CSRF token');
      }

      const data = await response.json();
      setCsrfToken(data.csrfToken);
      return data.csrfToken;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get CSRF token with headers for API requests
  const getHeaders = useCallback(() => {
    if (!csrfToken) {
      // CSRF token warning logged
    }

    return {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken || '',
    };
  }, [csrfToken]);

  // Refresh token
  const refreshToken = useCallback(() => {
    return getCsrfToken();
  }, [getCsrfToken]);

  // Auto-get token on mount
  useEffect(() => {
    getCsrfToken().catch(() => {
      // Silently fail - token will be fetched when needed
    });
  }, [getCsrfToken]);

  return {
    csrfToken,
    isLoading,
    error,
    getCsrfToken,
    refreshToken,
    getHeaders,
  };
}
