import { PageLoader } from "@/components/ui/loading-spinner";

export default function LoadingItemDetail() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <PageLoader text="Loading item details..." />
    </div>
  );
}
