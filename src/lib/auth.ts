import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
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
                if (!user.password) return null;
                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) return null;
                return { id: user.id, email: user.email, name: user.name };
            },
        }),
    ],
});