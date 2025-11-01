import { cookies } from 'next/headers';
import crypto from 'crypto';

/**
 * CSRF Protection Utility
 *
 * Cross-Site Request Forgery (CSRF) is an attack that forces authenticated users
 * to execute unwanted actions on a web application.
 *
 * This utility provides protection by:
 * 1. Generating a unique CSRF token per session
 * 2. Storing it in a secure HTTP-only cookie
 * 3. Requiring the token to be sent in state-changing requests
 * 4. Validating the token matches the stored one
 */

/**
 * Generate a cryptographically secure random CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the CSRF token from the request
 */
function getTokenFromRequest(request: Request): string | null {
  // Try to get token from header (X-CSRF-Token)
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) {
    return headerToken;
  }

  // Try to get token from body (form data)
  // This is a fallback for form submissions
  return null;
}

/**
 * Get or create a CSRF token for the current session
 */
export async function getOrCreateCSRFToken(): Promise<{
  token: string;
  cookieValue: string;
}> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get('csrf_token');

  if (existingToken) {
    // Token exists, return it
    return {
      token: existingToken.value,
      cookieValue: existingToken.value,
    };
  }

  // Generate new token
  const newToken = generateToken();

  // The token will be set as a cookie by the calling function
  // This is because cookies() is read-only in this context
  return {
    token: newToken,
    cookieValue: newToken,
  };
}

/**
 * Validate CSRF token from request
 */
export async function validateCSRFToken(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get('csrf_token');

  // If no CSRF cookie exists, validation fails
  if (!csrfCookie) {
    return false;
  }

  // Get token from request
  const requestToken = getTokenFromRequest(request);

  // If no token in request, validation fails
  if (!requestToken) {
    return false;
  }

  // Compare tokens
  return csrfCookie.value === requestToken;
}

/**
 * Get CSRF token cookie options (for secure deployment)
 */
export function getCSRFCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    name: 'csrf_token',
    httpOnly: true, // Not accessible via JavaScript (prevents XSS attacks)
    secure: isProduction, // Only sent over HTTPS in production
    sameSite: 'strict' as const, // CSRF protection mode
    path: '/', // Available for all routes
    maxAge: 60 * 60 * 24, // 24 hours (matches session duration)
  };
}

/**
 * Extract CSRF token from various sources
 */
export function extractCSRFToken(request: Request): string | null {
  // Method 1: Header
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) {
    return headerToken;
  }

  // Method 2: Form data
  // This would require parsing form data, which is less common for API calls
  // For JSON APIs, we'll rely on the header method

  return null;
}
