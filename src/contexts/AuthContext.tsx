'use client';

import { createContext, useContext } from 'react';
import { useSession } from 'next-auth/react';

// Define the shape of our auth context
interface AuthContextType {
    user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
    } | null;
    status: 'loading' | 'authenticated' | 'unauthenticated';
    isAuthenticated: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType>({
    user: null,
    status: 'loading',
    isAuthenticated: false,
});

// Hook to use the auth context
export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within AuthProvider');
    }
    return context;
};

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    // Get user data from session
    const user = session?.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
    } : null;

    const value = {
        user,
        status,
        isAuthenticated: !!user && status === 'authenticated',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/*
WHAT THIS DOES:

1. AuthContext:
   - Creates a React context to share auth state across components
   - Instead of calling useSession() everywhere, we centralize it here

2. useSession():
   - NextAuth hook that returns { data: session, status }
   - status: 'loading' | 'authenticated' | 'unauthenticated'
   - data.session contains user information we added in callbacks

3. AuthProvider:
   - Wraps our app and provides auth state to all components
   - Use it in layout.tsx to make auth available everywhere

WHY USE AUTHCONTEXT:
- Single source of truth for auth state
- Easier to manage auth logic
- Can add logout, refresh, etc. functions here later
*/
