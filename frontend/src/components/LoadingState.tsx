import { LoaderCircle } from "lucide-react";

export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground" role="status">
      <LoaderCircle className="h-8 w-8 animate-spin" aria-hidden="true" />
      <span className="mt-3 text-sm">Loading products...</span>
    </div>
  );
}
