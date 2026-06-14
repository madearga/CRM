import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "destructive" | "outline" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  textClassName?: string;
}

const variantBase: Record<ButtonVariant, string> = {
  default: "bg-primary active:opacity-90",
  destructive: "bg-destructive active:opacity-90",
  outline: "border border-border bg-transparent active:bg-muted",
  ghost: "bg-transparent active:bg-muted",
  link: "bg-transparent",
};

const variantText: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  destructive: "text-white",
  outline: "text-foreground",
  ghost: "text-foreground",
  link: "text-primary underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  default:
    "min-h-12 min-w-12 px-5 py-3 rounded-md gap-2 flex-row items-center justify-center",
  sm: "min-h-10 min-w-10 px-3 py-2 rounded-md gap-1.5 flex-row items-center justify-center",
  lg: "min-h-14 min-w-14 px-6 py-3 rounded-md gap-2 flex-row items-center justify-center",
  icon: "min-h-12 min-w-12 h-12 w-12 items-center justify-center rounded-md",
};

const textSize: Record<ButtonSize, string> = {
  default: "text-sm font-medium",
  sm: "text-xs font-medium",
  lg: "text-base font-medium",
  icon: "text-sm",
};

/**
 * Primary tap target for the mobile CRM.
 *
 * - Default height is 48 dp (`min-h-12`) for comfortable thumbs.
 * - Icon-only buttons are required to receive `accessibilityLabel`.
 * - Disabled and loading states are non-interactive and visually distinct.
 */
export function Button({
  className,
  textClassName,
  variant = "default",
  size = "default",
  loading = false,
  disabled = false,
  left,
  right,
  children,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const isIcon = size === "icon";
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        variantBase[variant],
        sizeClasses[size],
        isDisabled && "opacity-50",
        className,
      )}
      style={({ pressed }) => ({
        opacity: pressed && !isDisabled ? 0.85 : undefined,
      } as ViewStyle)}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "default" ? "#0a0a0f" : "#f0f0fa"}
        />
      ) : (
        <>
          {left}
          {isIcon ? null : (
            <Text
              className={cn(
                variantText[variant],
                textSize[size],
                textClassName,
              )}
              numberOfLines={1}
            >
              {children}
            </Text>
          )}
          {right}
        </>
      )}
    </Pressable>
  );
}
