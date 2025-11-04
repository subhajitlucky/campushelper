'use client';

import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

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

  // Only log occasionally to prevent spam during development
  if (typeof window !== 'undefined' && Math.random() < 0.01) { // 1% of the time
    console.log('🔍 [DEBUG] useAuthFetch status:', {
      requireAuth,
      sessionExists: !!session,
      sessionStatus: status,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    });
  }

  const fetchWithAuth = useCallback(
    async (url: string, options: AuthFetchOptions = {}): Promise<Response> => {
      console.log('🔍 [DEBUG] fetchWithAuth called:', {
        url,
        method: options.method || 'GET',
        requireAuth: options.requireAuth || requireAuth,
        showErrorToast: options.showErrorToast
      });
      
      const {
        requireAuth: localRequireAuth = requireAuth,
        showErrorToast = false,
        ...fetchOptions
      } = options;

      // Check authentication if required
      // Only reject if explicitly unauthenticated, not if loading
      console.log('🔍 [DEBUG] Authentication check:', {
        localRequireAuth,
        currentStatus: status,
        isUnauthenticated: status === 'unauthenticated'
      });
      
      if (localRequireAuth && status === 'unauthenticated') {
        console.log('❌ [DEBUG] Authentication required but user is unauthenticated');
        throw new Error('Authentication required');
      }

      // Get CSRF token from cookie or generate one
      let csrfToken = '';
      if (fetchOptions.method && fetchOptions.method !== 'GET') {
        console.log('🔍 [DEBUG] Getting CSRF token for non-GET request');
        // For state-changing requests, fetch CSRF token
        try {
          const csrfResponse = await fetch('/api/csrf-token', {
            credentials: 'include',
          });
          console.log('🔍 [DEBUG] CSRF token response:', {
            ok: csrfResponse.ok,
            status: csrfResponse.status
          });
          
          if (csrfResponse.ok) {
            const csrfData = await csrfResponse.json();
            csrfToken = csrfData.csrfToken;
            console.log('🔍 [DEBUG] CSRF token obtained:', csrfToken ? '✅ Present' : '❌ Missing');
          }
        } catch (error) {
          console.error('❌ [DEBUG] Failed to get CSRF token:', error);
        }
      }

      console.log('🔍 [DEBUG] Making fetch request with headers:', {
        'Content-Type': 'application/json',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        ...fetchOptions.headers,
        credentials: 'include'
      });
      
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
        console.log('❌ [DEBUG] 401 Unauthorized response received');
        console.log('🔍 [DEBUG] Response details:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        
        let errorMessage = 'Authentication required';
        try {
          const errorData = await response.json();
          console.log('🔍 [DEBUG] Error response data:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.log('🔍 [DEBUG] Could not parse error response as JSON');
        }
        
        if (showErrorToast) {
          // Assuming showError is defined elsewhere or will be added.
          // For now, we'll just throw the error.
          // showError(errorMessage); 
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
