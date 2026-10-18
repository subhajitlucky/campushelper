import { PageLoader } from "@/components/ui/loading-spinner";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <div className="h-8 bg-muted rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-96 animate-pulse"></div>
        </div>
        <PageLoader text="Loading your dashboard..." />
      </div>
    </div>
  );
}
