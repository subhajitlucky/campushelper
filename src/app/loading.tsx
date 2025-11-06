import { PageLoader } from "@/components/ui/loading-spinner";

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center px-4">
      <div className="text-center">
        <PageLoader text="Loading page..." />
        <p className="mt-4 text-sm text-gray-500">Please wait a moment</p>
      </div>
    </div>
  );
}
