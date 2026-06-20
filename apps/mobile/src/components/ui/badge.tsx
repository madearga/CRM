import { View, Text, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
}

const containerClasses: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary",
  secondary: "border-transparent bg-muted",
  destructive: "border-transparent bg-destructive",
  outline: "border border-border bg-transparent",
  success: "border-transparent bg-success",
  warning: "border-transparent bg-warning",
};

const textClasses: Record<BadgeVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-muted-foreground",
  destructive: "text-white",
  outline: "text-foreground",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
};

/**
 * Status badge for CRM entities (deal stage, invoice status, attendance,
 * sync state, etc.). Maps to the web badge variants used in the MVP.
 */
export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <View
      className={cn(
        "inline-flex flex-row items-center justify-center gap-1 self-start rounded-md px-2.5 py-1",
        containerClasses[variant],
        className,
      )}
      {...props}
    >
      <Text
        className={cn(
          "text-xs font-medium leading-none",
          textClasses[variant],
        )}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
}
