import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth/next';

const handler = NextAuth({
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

                const user = await prisma.user.findUnique({ where: { email } });
                if (!user) return null;
                if (!user.password) return null; // user registered via OAuth only
                if (!user.isActive) return null; // soft-deleted / suspended account

                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) return null;

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
    callbacks: {
        async jwt({ token, user, account }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
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
                } catch (error) {
                    // Log error for debugging and monitoring
                    console.error('OAuth JWT callback error:', {
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                        userEmail: user?.email,
                        providerAccountId: account?.providerAccountId,
                        timestamp: new Date().toISOString(),
                        timestampMs: Date.now()
                    });

                    // Clear any partial token data to prevent authentication with incomplete session
                    delete token.id;
                    delete token.role;

                    // Re-throw error to block authentication and show error page
                    throw error;
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
            }

            return session;
        },
        async signIn({ user, account, profile }) {
            // Additional sign-in logic if needed
            // This runs before jwt callback
            return true;
        },
    },
    session: {
        strategy: 'jwt', // Using JWT strategy for consistency
    },
    pages: {
        // Custom pages can be added here if needed
        // signIn: '/auth/signin', // Custom sign in page
        // error: '/auth/error', // Error page
    },
});

export const auth = handler;

// Helper function for API routes to get session
export async function getSession() {
  return await getServerSession();
}

export { handler as GET, handler as POST };
export default handler;