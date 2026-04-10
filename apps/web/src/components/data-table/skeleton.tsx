import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonColumn {
  type: "avatar-text" | "text" | "badge" | "icon" | "checkbox";
  width?: string;
}

export function DataTableSkeleton({
  columns,
  rowCount = 5,
}: {
  columns: SkeletonColumn[];
  rowCount?: number;
}) {
  return (
    <div className="rounded-md border">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          {columns.map((col, j) => (
            <div key={j} style={{ flex: col.type === "avatar-text" ? 2 : 1 }} className="min-w-0">
              {col.type === "checkbox" ? (
                <Skeleton className="size-4 rounded" />
              ) : col.type === "avatar-text" ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className={`h-3.5 ${col.width ?? "w-28"}`} />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
              ) : col.type === "badge" ? (
                <Skeleton className="h-5 w-16 rounded-full" />
              ) : col.type === "icon" ? (
                <Skeleton className="size-8 rounded" />
              ) : (
                <Skeleton className={`h-3.5 ${col.width ?? "w-20"}`} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
