import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";

import Providers from "@/components/Providers";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Analytics } from "@vercel/analytics/next";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * The typeface the interface is actually set in.
 *
 * `globals.css` maps `--font-sans` to `var(--font-geist-sans, <system stack>)`,
 * so these two variable names are the entire wiring: no component carries a
 * font-family. Geist is a variable face (weight 100-900) with a matching mono,
 * which the handover codes and audit ids use. `display: "swap"` keeps the
 * fallback readable on a slow first paint; `next/font` self-hosts the files at
 * build time, so there is no third-party request at runtime.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      // globals.css sets `scroll-behavior: smooth` on <html>. Without this
      // attribute the App Router cannot tell the smoothing is intentional, so
      // it logs a warning on every client navigation and does not suppress it
      // during route transitions.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased">
        <Providers>
          <ErrorBoundary level="page">
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          </ErrorBoundary>
          <Toaster />
        </Providers>
        <Analytics />
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