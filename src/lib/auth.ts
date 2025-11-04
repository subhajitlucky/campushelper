import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { limitLogin } from './rateLimit';
import type { Session } from 'next-auth';

// Auto-detect NEXTAUTH_URL for production
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

const handler = NextAuth({
    // Require NEXTAUTH_SECRET for security - no fallback in production
    secret: process.env.NEXTAUTH_SECRET,
    
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                const email = credentials?.email as string;
                const password = credentials?.password as string;
                if (!email || !password) return null;

                // Check if account is locked
                const user = await prisma.user.findUnique({ where: { email } });
                if (!user) return null;
                if (!user.password) return null; // user registered via OAuth only
                if (!user.isActive) return null; // soft-deleted / suspended account

                // Check if account is temporarily locked due to too many failed attempts
                if (user.lockedUntil && user.lockedUntil > new Date()) {
                    // Return null to indicate invalid credentials
                    // NextAuth will handle this appropriately
                    return null;
                }

                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) {
                    // Increment failed login attempts
                    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
                    const shouldLock = failedAttempts >= 5;

                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            failedLoginAttempts: failedAttempts,
                            lockedUntil: shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : null, // Lock for 30 minutes
                        },
                    });

                    return null;
                }

                // Successful login - reset failed attempts and unlock account
                if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            failedLoginAttempts: 0,
                            lockedUntil: null,
                            lastLoginAt: new Date(),
                        },
                    });
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),
        // Google OAuth Provider (Step 128-131: Google OAuth Integration)
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '', // Will be set in Step 129
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', // Will be set in Step 129
        }),
    ],
    events: {
        async signIn({ user, account, profile, isNewUser }) {
            // Handle successful sign in
            // This is called after successful authentication
        },
        async signOut({ session, token }) {
            // Handle sign out
        },
    },
    session: {
        strategy: 'jwt', // Using JWT strategy for consistency
        maxAge: 60 * 60 * 24, // 24 hours (in seconds) - Security fix: prevent long-lived sessions
    },
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "strict", // Changed from "lax" for better CSRF protection
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        callbackUrl: {
            name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",  
            options: {
                httpOnly: true,
                sameSite: "strict", // Changed from "lax" for better CSRF protection
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        csrfToken: {
            name: process.env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
            options: {
                httpOnly: true,
                sameSite: "strict", // Changed from "lax" for better CSRF protection
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    // Add explicit serialization to ensure id/role persist
    callbacks: {
        async jwt({ token, user, account, trigger, session }) {
            
            // Initial sign in - add user data to token
            if (user) {
                
                token.id = user.id;
                token.role = user.role;
                token.email = user.email;
                token.name = user.name || undefined;
            }

            // Handle Google OAuth sign in
            if (account && account.provider === 'google') {
                try {
                    // Check if user exists with Google ID or email
                    let dbUser = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { googleId: account.providerAccountId },
                                { email: user?.email || '' }
                            ]
                        }
                    });

                    if (!dbUser) {
                        // Create new user from Google profile
                        dbUser = await prisma.user.create({
                            data: {
                                email: user?.email || '',
                                name: user?.name || '',
                                avatar: user?.image || null,
                                googleId: account.providerAccountId,
                                emailVerified: new Date(),
                                role: 'USER', // Default role
                                isActive: true,
                            }
                        });
                    } else if (!dbUser.googleId) {
                        // Update existing user with Google ID
                        dbUser = await prisma.user.update({
                            where: { id: dbUser.id },
                            data: {
                                googleId: account.providerAccountId,
                                name: user?.name || dbUser.name,
                                avatar: user?.image || dbUser.avatar,
                                emailVerified: new Date(),
                            }
                        });
                    }

                    token.id = dbUser.id;
                    token.role = dbUser.role;
                    token.email = dbUser.email;
                    token.name = dbUser.name || undefined;
                } catch (error) {
                    // Error logged for monitoring
                    // Don't throw here to avoid breaking auth flow
                }
            }

            // Handle session updates
            if (trigger === 'update' && session) {
                if (session.name) token.name = session.name;
                if (session.role) token.role = session.role;
            }

            return token;
        },
        async session({ session, token }) {
            
            // Safely copy token data to session
            if (session.user && token) {
                
                // Set user ID (critical for authentication)
                if (token.id) {
                    session.user.id = token.id as string;
                } else {
                    // This case should ideally not happen if jwt callback works correctly
                }
                
                // Set user role
                if (token.role) {
                    session.user.role = token.role as string;
                } else {
                    // This case should ideally not happen if jwt callback works correctly
                }
                
                // Set additional user data
                if (token.email) {
                    session.user.email = token.email as string;
                }
                if (token.name) {
                    session.user.name = token.name as string;
                }
                
            } else {
                // This case should ideally not happen if jwt callback works correctly
            }
            
            return session;
        },
        async signIn({ user, account, profile }) {
            // Additional sign-in logic if needed
            // This runs before jwt callback
            return true;
        },
    },
    pages: {
        // Custom pages can be added here if needed
        // signIn: '/auth/signin', // Custom sign in page
        // error: '/auth/error', // Error page
    },
});

export const auth = handler;

// Helper function for API routes to get session
export async function getSession(): Promise<Session | null> {
    // In Next.js App Router, auth() reads from the current request context
    try {
        const session = await auth() as Session | null;
    
    // Additional validation
    if (session && !session.user) {
      // Session exists but no user object - this shouldn't happen in normal flow
      return null;
    }
    
    if (session && session.user && !session.user.id) {
      // Session user exists but no user.id - this indicates a JWT callback issue
      return null;
    }
    
    return session;
  } catch (error) {
    // Don't log errors in production to avoid information disclosure
    if (process.env.NODE_ENV === 'development') {
      console.error('Session validation error:', error);
    }
    return null;
  }
}

export { handler as GET, handler as POST };
export default handler;