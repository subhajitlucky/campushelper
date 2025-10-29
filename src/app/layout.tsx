import "./globals.css";
import Providers from "@/components/Providers";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}

/*
WHAT THIS DOES:

1. Providers Component (from @/components/Providers):
   - Client-side wrapper for SessionProvider and AuthProvider
   - Enables React Context (hooks) in a client component
   - Provides auth state to entire app tree

2. Why This Pattern?
   - layout.tsx remains a Server Component (better performance)
   - Providers.tsx is a Client Component (handles auth)
   - Best of both worlds: Server rendering + Client interactivity

FLOW:
RootLayout (Server)
  ↓
Providers (Client)
  ├─ SessionProvider (NextAuth)
  └─ AuthProvider (Our Context)
      ↓
      Your App Components
*/