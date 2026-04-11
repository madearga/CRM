"use client";

import dynamic from "next/dynamic";

const FloatingSelectionBarInner = dynamic(
  () => import("./floating-selection-bar-inner"),
  { ssr: false },
);

interface FloatingSelectionBarProps {
  count: number;
  onClear: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  showRestore?: boolean;
  isArchiving?: boolean;
}

/** Lazy-loaded floating bar — framer-motion is only fetched when items are selected. */
export function FloatingSelectionBar(props: FloatingSelectionBarProps) {
  if (props.count === 0) return null;
  return <FloatingSelectionBarInner {...props} />;
}
