import { Pressable, Text, View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export interface NetworkBannerProps extends ViewProps {
  online: boolean;
  onRetry?: () => void;
}

/**
 * Connectivity banner shown at the top of mobile screens.
 *
 * - Offline: warning surface with a retry action.
 * - Online again: a brief success confirmation (consumers typically hide it
 *   after a short delay).
 *
 * Announces state changes to screen readers via `accessibilityLiveRegion`.
 */
export function NetworkBanner({
  online,
  onRetry,
  className,
  ...props
}: NetworkBannerProps) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-between px-4 py-3",
        online ? "bg-success" : "bg-warning",
        className,
      )}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      {...props}
    >
      <Text
        className={cn(
          "text-sm font-medium",
          online ? "text-success-foreground" : "text-warning-foreground",
        )}
      >
        {online ? "Back online" : "No internet connection"}
      </Text>
      {!online && onRetry ? (
        <Pressable
          accessibilityLabel="Retry network request"
          accessibilityRole="button"
          className="min-h-12 min-w-12 justify-center px-2"
          onPress={onRetry}
        >
          <Text className="text-sm font-semibold text-warning-foreground">
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
