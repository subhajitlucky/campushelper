import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import AdminDashboard from '@/components/AdminDashboard';

// Force dynamic rendering to avoid build-time headers() error
export const dynamic = 'force-dynamic';

/**
 * Admin Dashboard Page - Protected Admin Route
 * Only accessible to users with ADMIN or MODERATOR role
 */
export default async function AdminDashboardPage() {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user) {
      notFound();
    }

    // Check admin authorization
    const userRole = session.user.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';
    
    if (!isAdmin) {
      notFound();
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <AdminDashboard />
      </div>
    );
  } catch (error) {
    notFound();
  }
}
