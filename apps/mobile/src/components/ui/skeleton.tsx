import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends ViewProps {
  circle?: boolean;
}

/**
 * Pulse placeholder that mirrors the shape of the content being loaded.
 *
 * NativeWind v4 resolves `animate-pulse` to a React Native-compatible opacity
 * animation. If NativeWind is ever disabled, replace with a StyleSheet opacity
 * loop driven by `react-native-reanimated` or `Animated`.
 */
export function Skeleton({
  className,
  circle,
  ...props
}: SkeletonProps) {
  return (
    <View
      className={cn(
        "animate-pulse rounded-md bg-muted",
        circle && "rounded-full",
        className,
      )}
      {...props}
    />
  );
}
