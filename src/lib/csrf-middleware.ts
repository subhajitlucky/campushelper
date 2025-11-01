import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFToken } from './csrf';
import { ForbiddenError } from './errors';

/**
 * CSRF Protection Middleware
 *
 * Use this to protect state-changing routes (POST, PUT, DELETE, PATCH)
 *
 * @param request - The incoming Next.js request
 * @returns Response if CSRF validation fails, null if validation passes
 */
export async function checkCSRF(request: NextRequest): Promise<NextResponse | null> {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  // These are safe methods that don't modify state
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null;
  }

  // Skip CSRF check for NextAuth callback routes
  // These have their own security mechanisms
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/auth/')) {
    return null;
  }

  // Validate CSRF token
  const isValid = await validateCSRFToken(request);

  if (!isValid) {
    throw ForbiddenError(
      'Invalid CSRF token. This could be a cross-site request forgery (CSRF) attack.'
    );
  }

  // CSRF validation passed
  return null;
}
