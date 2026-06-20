import {
  View,
  Text,
  type ViewProps,
  type TextProps,
} from "react-native";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("flex-col gap-1.5 pb-4", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        "text-base font-semibold leading-tight text-card-foreground",
        className,
      )}
      numberOfLines={2}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-sm leading-snug text-muted-foreground", className)}
      numberOfLines={3}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("absolute right-0 top-0", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("flex-col gap-2", className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-end gap-3 pt-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
