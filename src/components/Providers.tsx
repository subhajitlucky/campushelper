'use client';

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/contexts/AuthContext";

/**
 * Providers Component
 *
 * PURPOSE:
 * - Wraps SessionProvider and AuthProvider together
 * - Client-side component that provides auth context to entire app
 *
 * WHY SEPARATE COMPONENT?
 * - layout.tsx is a Server Component by default
 * - SessionProvider requires Client Component (uses React hooks)
 * - This wrapper allows us to use providers without making entire layout a client component
 */
interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SessionProvider>
  );
}

/*
FLOW:
Root Layout (Server Component)
  ↓
Providers Component (Client Component)
  ↓
  ├─ SessionProvider (NextAuth)
  └─ AuthProvider (Our Context)
      ↓
      Your App Components
*/
