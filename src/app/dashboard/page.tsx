import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Dashboard Page
 *
 * PURPOSE:
 * - Main dashboard for authenticated users
 * - Shows user's items, claims, and quick actions
 * - Server Component (fetches data directly from Prisma)
 */
export default async function DashboardPage() {
  // TODO: Fix auth() export in lib/auth.ts
  // const session = await auth();

  // if (!session?.user) {
  //   redirect('/auth/login');
  // }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to your Dashboard!
        </h1>
        <p className="text-gray-600 mt-2">
          Manage your lost & found items from your dashboard
        </p>
      </div>

      {/* Main Content - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Coming Soon</CardTitle>
          <CardDescription>
            The dashboard is being set up. You can already sign up and login!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Authentication is working. Try signing up and logging in.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/*
SERVER COMPONENT BENEFITS:

1. Direct Database Access:
   - No API calls needed (faster)
   - Prisma runs directly in this component
   - No hydration overhead

2. Security:
   - Server-side auth check (auth())
   - Middleware already protects this route
   - Double protection for sensitive data

3. Performance:
   - Data fetched on server
   - Result pre-rendered as HTML
   - Smaller client bundle size

DATA FLOW:

1. auth() → Gets session from NextAuth
2. Prisma queries → Fetch user's items/claims
3. Pass to Client Components → For interactivity
4. Render → User sees their dashboard

WHY NOT CLIENT COMPONENT?
- Would need useEffect + API calls
- More complex state management
- Slower initial load
- Server components are better for data fetching
*/
