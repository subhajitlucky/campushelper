import { PageLoader } from "@/components/ui/loading-spinner";

export default function LoadingItemDetail() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center px-4">
      <PageLoader text="Loading item details..." />
    </div>
  );
}
