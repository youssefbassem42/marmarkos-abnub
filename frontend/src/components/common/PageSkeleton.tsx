import { Skeleton } from "@/components/ui/skeleton";

/** Suspense fallback for the lazily loaded attendance pages. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-5 py-6">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
