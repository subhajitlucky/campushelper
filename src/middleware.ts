import { NextResponse } from 'next/server';

/**
 * Middleware for Authentication & Authorization
 * 
 * TEMPORARILY DISABLED: This middleware currently allows all requests through
 * to fix authentication redirect issues. Re-enable authentication protection
 * once the home page is accessible.
 */

export default function middleware(req) {
  // TEMPORARILY DISABLED: Allow all requests through without authentication
  // This removes the redirect to /api/auth/signin
  
  console.log(`Middleware: Allowing request to ${req.nextUrl.pathname}`);
  
  // Allow request to continue
  return NextResponse.next();
}
