import { Text, View } from "react-native";

// Proves the Turborepo workspace bridge works from RN: @crm/domain is resolved
// by Metro via the pnpm workspace, with zero web-only transitive deps.
import { DEAL_STAGES } from "@crm/domain";

/**
 * U1 hello-world screen.
 *
 * Uses NativeWind v4 classes (bg-background, text-foreground, ...). If NativeWind
 * is ever disabled, swap to StyleSheet + tokens from src/styles/theme.ts.
 */
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">CRM Mobile</Text>
      <Text className="mt-2 text-sm text-muted-foreground">
        U1 scaffold ready · Expo SDK 53 + React 19 + NativeWind v4
      </Text>
      <Text className="mt-6 font-mono text-xs text-muted-foreground">
        @crm/domain deal stages: {DEAL_STAGES.join(", ")}
      </Text>
    </View>
  );
}
