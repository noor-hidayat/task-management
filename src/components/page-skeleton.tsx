import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton halaman bersama untuk state loading.
 * Varian disesuaikan dengan tipe konten tiap halaman.
 */
type PageSkeletonVariant = "table" | "cards" | "kanban" | "stats" | "schedule" | "list";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  rows?: number;
  columns?: number;
  className?: string;
}

function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3" aria-label="Memuat data" role="status">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="flex gap-4 border-b bg-muted/40 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-4 px-4 py-3.5">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-[220px]")} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

function CardsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Memuat data" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5" aria-label="Memuat data" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border bg-card p-3.5">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

function KanbanSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div
      className="grid gap-3 py-4 md:grid-cols-2 xl:grid-cols-4"
      aria-label="Memuat data"
      role="status"
    >
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="flex min-h-48 flex-col rounded-xl border bg-muted/40">
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <div className="flex-1 space-y-2 p-3 pt-0">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="min-h-44 space-y-3 rounded-lg border bg-card p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="mt-auto h-6 w-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Memuat data" role="status">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl border lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl border" />
      </div>
      <Skeleton className="h-56 rounded-xl border" />
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-6" aria-label="Memuat data" role="status">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-xl border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-32 shrink-0" />
            {Array.from({ length: 7 }).map((_, d) => (
              <Skeleton key={d} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PageSkeleton({
  variant = "table",
  rows,
  columns,
  className,
}: PageSkeletonProps) {
  const inner = (() => {
    switch (variant) {
      case "cards":
        return <CardsSkeleton rows={rows} />;
      case "kanban":
        return <KanbanSkeleton columns={columns} />;
      case "stats":
        return <StatsSkeleton />;
      case "schedule":
        return <ScheduleSkeleton />;
      case "list":
        return <ListSkeleton rows={rows} />;
      case "table":
      default:
        return <TableSkeleton rows={rows} columns={columns} />;
    }
  })();

  return <div className={cn(className)}>{inner}</div>;
}

export { PageSkeleton };
