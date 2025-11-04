import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Debug endpoint to test authentication
 * GET /api/debug/auth
 * 
 * ONLY AVAILABLE IN DEVELOPMENT MODE
 */
export async function GET(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoint not available in production' },
      { status: 404 }
    );
  }
  
  try {
    const session = await getSession();
    
    // Check cookies
    const cookies = request.cookies.getAll();
    const nextAuthSession = request.cookies.get('next-auth.session-token');
    const nextAuthCallback = request.cookies.get('next-auth.callback-url');
    
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
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
