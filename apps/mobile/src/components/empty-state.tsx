import { memo } from "react";
import { View, Text, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends ViewProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Native EmptyState matching the web component semantics.
 *
 * Uses a muted circular surface for the icon and supports an optional action
 * below the description. Centered by default; pass `className` to override.
 */
export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <View
      className={cn(
        "flex-col items-center justify-center py-16 px-6",
        className,
      )}
      {...props}
    >
      <View className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-muted-foreground">
        {icon}
      </View>
      <Text className="mt-5 text-sm font-semibold text-foreground text-center">
        {title}
      </Text>
      {description ? (
        <Text className="mt-1.5 max-w-[260px] text-center text-sm text-muted-foreground">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
});
