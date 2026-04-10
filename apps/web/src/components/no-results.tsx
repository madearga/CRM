"use client";

import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoResultsProps {
  searchQuery: string;
  onClear: () => void;
}

export function NoResults({ searchQuery, onClear }: NoResultsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
        <SearchX className="size-7" />
      </div>
      <h3 className="mt-6 text-sm font-semibold">No results found</h3>
      <p className="mt-1 max-w-[260px] text-center text-sm text-muted-foreground">
        No items matching &ldquo;{searchQuery}&rdquo;. Try a different search or clear filters.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}
