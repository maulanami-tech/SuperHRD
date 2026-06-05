import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 px-4">
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[180px]" />
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-4 w-[60px]" />
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-5 w-[200px]" />
          <Skeleton className="h-5 w-[180px]" />
          <Skeleton className="h-5 w-[120px]" />
          <Skeleton className="h-7 w-[40px] rounded-full" />
          <Skeleton className="h-7 w-[80px] rounded-full" />
          <Skeleton className="h-5 w-[100px]" />
        </div>
      ))}
    </div>
  );
}

export function CandidateDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

export function ScreeningResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-[120px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-[150px]" />
              <Skeleton className="h-5 w-[40px]" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-[250px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
