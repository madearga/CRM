import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends ViewProps {
  circle?: boolean;
}

/**
 * Placeholder that mirrors the shape of the content being loaded.
 *
 * Keep this static: NativeWind's `animate-pulse` path depends on Reanimated
 * internals that Expo Go can expose differently, causing `makeMutable` crashes.
 */
export function Skeleton({
  className,
  circle,
  ...props
}: SkeletonProps) {
  return (
    <View
      className={cn(
        "rounded-md bg-muted",
        circle && "rounded-full",
        className,
      )}
      {...props}
    />
  );
}
