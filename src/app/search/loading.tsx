import { PageLoader } from "@/components/ui/loading-spinner";

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <div className="h-10 bg-gray-200 rounded w-full max-w-2xl mb-4 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <PageLoader text="Searching for items..." />
      </div>
    </div>
  );
}
