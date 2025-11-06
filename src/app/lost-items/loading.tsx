import { PageLoader } from "@/components/ui/loading-spinner";

export default function LostItemsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 py-8">
      <div className="container mx-auto px-4">
        <PageLoader text="Loading lost items..." />
      </div>
    </div>
  );
}
