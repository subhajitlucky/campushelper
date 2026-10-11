import NextAuth from 'next-auth';
import { getServerSession } from 'next-auth';
import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { limitLogin } from './rateLimit';
import bcrypt from 'bcryptjs';

// The next-auth v4 types do not model the documented "return null from the jwt
// callback" invalidation path, so null returns are cast at the boundary.
function invalidateSession(): JWT {
    return null as unknown as JWT;
}

function invalidateSessionInResponse(): Session {
    return null as unknown as Session;
}

// Auto-detect NEXTAUTH_URL for production
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('NEXTAUTH_SECRET environment variable is required in production');
    }
}

export const authOptions: NextAuthOptions = {
    // Require NEXTAUTH_SECRET for security - no fallback in production
    secret: process.env.NEXTAUTH_SECRET,
    
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials, req) {
                const email = credentials?.email as string;
                const password = credentials?.password as string;
                if (!email || !password) return null;

                // Per-account/IP throttling in addition to the account lockout below
                try {
                    await limitLogin(req as unknown as Request, email);
                } catch {
                    // Rate limited: behave like invalid credentials
                    return null;
                }

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
                    sessionVersion: user.sessionVersion,
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
        async signIn() {
            // Handle successful sign in
            // This is called after successful authentication
        },
        async signOut() {
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
                sameSite: process.env.NODE_ENV === "production" ? "lax" : "strict", // FIX: Use "lax" in production for better compatibility
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        callbackUrl: {
            name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",  
            options: {
                httpOnly: true,
                sameSite: process.env.NODE_ENV === "production" ? "lax" : "strict", // FIX: Use "lax" in production for better compatibility
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        csrfToken: {
            name: process.env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
            options: {
                httpOnly: true,
                sameSite: process.env.NODE_ENV === "production" ? "lax" : "strict", // FIX: Use "lax" in production for better compatibility
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
                token.sessionVersion = user.sessionVersion;
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
                    token.sessionVersion = dbUser.sessionVersion;
                } catch (error) {
                    // Never trust a partially populated token when account
                    // linking fails - force re-authentication instead.
                    console.error('[auth] Google account linking failed:', error);
                    return invalidateSession();
                }
            }

            // Allow only the display name to be updated from the client.
            // Role and other authorization fields are never client-writable.
            let nameUpdatedFromClient = false;
            if (trigger === 'update' && session) {
                const sessionName = (session as { name?: unknown }).name;
                if (typeof sessionName === 'string') {
                    token.name = sessionName.slice(0, 100);
                    nameUpdatedFromClient = true;
                }
            }

            // Re-validate against the database on every invocation so that
            // suspensions, role changes, and forced invalidation take effect
            // without waiting for the JWT to expire.
            if (!token.id) {
                return invalidateSession();
            }

            const dbUser = await prisma.user.findUnique({
                where: { id: token.id },
                select: {
                    id: true,
                    role: true,
                    isActive: true,
                    sessionVersion: true,
                    email: true,
                    name: true,
                },
            });

            if (!dbUser || !dbUser.isActive) {
                return invalidateSession();
            }

            if (
                typeof token.sessionVersion === 'number' &&
                dbUser.sessionVersion !== token.sessionVersion
            ) {
                return invalidateSession();
            }

            // Refresh authorization data from the database only.
            token.role = dbUser.role;
            token.email = dbUser.email;
            if (dbUser.name && !nameUpdatedFromClient) {
                token.name = dbUser.name;
            }
            token.sessionVersion = dbUser.sessionVersion;

            return token;
        },
        async session({ session, token }) {
            // A missing token means the jwt callback invalidated the session.
            if (!token || !token.id) {
                return invalidateSessionInResponse();
            }

            if (session.user) {
                // Set user ID (critical for authentication)
                session.user.id = token.id;

                // Set user role
                if (token.role) {
                    session.user.role = token.role;
                }

                // Set additional user data
                if (token.email) {
                    session.user.email = token.email;
                }
                if (token.name) {
                    session.user.name = token.name;
                }
            }

            return session;
        },
        async signIn() {
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
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export async function auth(): Promise<Session | null> {
    try {
        const session = await getServerSession(authOptions) as Session | null;

        if (session && !session.user) {
            return null;
        }

        if (session?.user && !session.user.id) {
            return null;
        }

        return session;
    } catch {
        // Session validation failed
        return null;
    }
}

// Helper function for API routes to get session
export async function getSession(): Promise<Session | null> {
    return auth();
}

export default handler;