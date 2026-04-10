"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingSelectionBarProps {
  count: number;
  onClear: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  showRestore?: boolean;
  isArchiving?: boolean;
}

export function FloatingSelectionBar({
  count,
  onClear,
  onArchive,
  onRestore,
  showRestore,
  isArchiving,
}: FloatingSelectionBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="relative pointer-events-auto min-w-[340px]">
            <div className="absolute inset-0 rounded-xl border bg-background/80 backdrop-blur-lg shadow-lg" />
            <div className="relative flex h-12 items-center justify-between pl-4 pr-2">
              <span className="text-sm font-medium">
                {count} {count === 1 ? "item" : "items"} selected
              </span>
              <div className="flex items-center gap-2">
                {showRestore && onRestore && (
                  <Button variant="ghost" size="sm" onClick={onRestore} disabled={isArchiving}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Restore
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onArchive} disabled={isArchiving}>
                  <Archive className="mr-1 h-3.5 w-3.5" />
                  Archive
                </Button>
                <Button variant="ghost" size="sm" onClick={onClear}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
