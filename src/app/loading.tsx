import { PageLoader } from "@/components/ui/loading-spinner";

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <PageLoader text="Loading page..." />
        <p className="mt-4 text-sm text-muted-foreground">Please wait a moment</p>
      </div>
    </div>
  );
}
