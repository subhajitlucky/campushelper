import { PageLoader } from "@/components/ui/loading-spinner";

export default function PostLoading() {
  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <PageLoader text="Loading post form..." />
      </div>
    </div>
  );
}
