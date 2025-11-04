'use client';

import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { showError } from './toast-config';

interface AuthFetchOptions extends RequestInit {
  // Extend RequestInit with our custom options
  requireAuth?: boolean;
  showErrorToast?: boolean;
}

interface AuthFetchReturn {
  fetchWithAuth: (url: string, options?: AuthFetchOptions) => Promise<Response>;
  isLoading: boolean;
}

/**
 * Custom hook for authenticated fetch requests
 * Automatically includes NextAuth session cookies and handles authentication
 *
 * @param requireAuth - If true, throws error when not authenticated
 * @returns Object with fetchWithAuth function and isLoading state
 */
export function useAuthFetch(requireAuth: boolean = false): AuthFetchReturn {
  const { data: session, status } = useSession();
  
  const fetchWithAuth = useCallback(
    async (url: string, options: AuthFetchOptions = {}): Promise<Response> => {
      const {
        requireAuth: localRequireAuth = requireAuth,
        showErrorToast = false,
        ...fetchOptions
      } = options;

      // Check authentication if required
      if (localRequireAuth) {
        // Don't proceed if session is still loading
        if (status === 'loading') {
          const errorMessage = 'Please wait, loading session...';
          if (showErrorToast) {
            showError(errorMessage);
          }
          throw new Error(errorMessage);
        }
        
        // Check if authenticated
        if (status === 'unauthenticated' || !session?.user?.id) {
          const errorMessage = 'Please log in to continue';
          if (showErrorToast) {
            showError(errorMessage);
          }
          throw new Error(errorMessage);
        }
      }

      // Get CSRF token from cookie or generate one
      let csrfToken = '';
      if (fetchOptions.method && fetchOptions.method !== 'GET') {
        // For state-changing requests, fetch CSRF token
        try {
          const csrfResponse = await fetch('/api/csrf-token', {
            credentials: 'include',
          });
          
          if (csrfResponse.ok) {
            const csrfData = await csrfResponse.json();
            csrfToken = csrfData.csrfToken;
          }
        } catch (error) {
          console.error('Failed to get CSRF token:', error);
        }
      }
      
      const response = await fetch(url, {
        ...fetchOptions,
        credentials: 'include', // ⭐ CRITICAL: Include NextAuth cookies
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
          ...fetchOptions.headers,
        },
      });

      // Handle authentication errors
      if (response.status === 401) {
        let errorMessage = 'Authentication required';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Use default error message
        }
        
        if (showErrorToast) {
          showError(errorMessage);
        }
        throw new Error(errorMessage);
      }

      return response;
    },
    [session, status, requireAuth]
  );

  return {
    fetchWithAuth,
    isLoading: status === 'loading',
  };
}

/**
 * Non-hook version for use in non-client components
 * Uses fetch with credentials: 'include' for same-origin requests
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include', // ⭐ CRITICAL: Include NextAuth cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Helper to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { status } = useSession();
  return status === 'authenticated';
}

/**
 * Helper to get current user
 */
export function useCurrentUser() {
  const { data: session } = useSession();
  return session?.user || null;
}
