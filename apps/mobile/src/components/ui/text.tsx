import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/lib/utils";

export type TextVariant =
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "body-sm"
  | "caption"
  | "muted"
  | "mono";

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
}

const variantClasses: Record<TextVariant, string> = {
  h1: "text-xl font-semibold text-foreground",
  h2: "text-lg font-semibold text-foreground",
  h3: "text-base font-semibold text-foreground",
  body: "text-sm text-foreground",
  "body-sm": "text-xs text-foreground",
  caption: "text-xs text-muted-foreground",
  muted: "text-sm text-muted-foreground",
  mono: "font-mono text-sm text-foreground",
};

/**
 * Type-safe text primitive mapped to the CRM typography scale.
 *
 * NativeWind handles the styling; this component only adds semantic variants
 * so screens stay consistent without manually duplicating Tailwind classes.
 */
export function Text({
  className,
  variant = "body",
  ...props
}: TextProps) {
  return (
    <RNText
      className={cn(variantClasses[variant], className)}
      {...props}
    />
  );
}
