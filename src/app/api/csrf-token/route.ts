import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOrCreateCSRFToken, getCSRFCookieOptions } from '@/lib/csrf';

/**
 * GET /api/csrf-token
 *
 * Generates or retrieves a CSRF token for the current session.
 * The token is set as an HTTP-only cookie for security.
 *
 * Usage:
 * 1. Client calls this endpoint to get a CSRF token
 * 2. Client stores the token (from response body)
 * 3. Client sends token in X-CSRF-Token header for all state-changing requests
 */
export async function GET(request: NextRequest) {
  try {
    // Get or create CSRF token
    const { token, cookieValue } = await getOrCreateCSRFToken();

    // Set the CSRF cookie with secure options
    const cookieOptions = getCSRFCookieOptions();

    const response = NextResponse.json({
      csrfToken: token,
      message: 'CSRF token generated successfully',
    });

    // Set the cookie
    response.cookies.set({
      name: cookieOptions.name,
      value: cookieValue,
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
