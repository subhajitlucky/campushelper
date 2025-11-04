import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Debug endpoint to test authentication
 * GET /api/debug/auth
 */
export async function GET(request: NextRequest) {
  console.log('🔍 [DEBUG] Auth debug endpoint called');
  console.log('🔍 [DEBUG] Request method:', request.method);
  console.log('🔍 [DEBUG] Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const session = await getSession();
    
    console.log('🔍 [DEBUG] Full session analysis:');
    console.log('  - Session exists:', !!session);
    console.log('  - Session object:', JSON.stringify(session, null, 2));
    
    if (session) {
      console.log('  - Session keys:', Object.keys(session));
      console.log('  - User exists:', !!session.user);
      if (session.user) {
        console.log('  - User keys:', Object.keys(session.user));
        console.log('  - User ID:', session.user.id);
        console.log('  - User email:', session.user.email);
        console.log('  - User name:', session.user.name);
      }
    }
    
    // Check cookies
    const cookies = request.cookies.getAll();
    console.log('🔍 [DEBUG] All cookies:', cookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })));
    
    // Check specific NextAuth cookies
    const nextAuthSession = request.cookies.get('next-auth.session-token');
    const nextAuthCallback = request.cookies.get('next-auth.callback-url');
    console.log('🔍 [DEBUG] NextAuth session cookie:', !!nextAuthSession);
    console.log('🔍 [DEBUG] NextAuth callback cookie:', !!nextAuthCallback);
    
    return NextResponse.json({
      success: true,
      debug: {
        sessionExists: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        sessionKeys: session ? Object.keys(session) : null,
        userKeys: session?.user ? Object.keys(session.user) : null,
        cookies: {
          totalCookies: cookies.length,
          hasNextAuthSession: !!nextAuthSession,
          hasNextAuthCallback: !!nextAuthCallback
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Auth debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}
