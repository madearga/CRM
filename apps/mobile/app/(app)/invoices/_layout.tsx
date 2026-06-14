/**
 * Nested navigator for the Invoices tab.
 *
 * Hosts the list (`index`) and the read-only detail (`[id]`). Using a dedicated
 * Stack here gives the detail screen its own header with a back button while
 * keeping the tab bar semantics for the list. The parent `(app)/_layout.tsx`
 * hides the tab-level header for this tab (`headerShown: false`) so this Stack
 * is the single source of headers and we never render two stacked headers.
 */
import { Stack } from 'expo-router';

import { colors } from '@/styles/theme';

export default function InvoicesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.foreground,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Invoices' }} />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Invoice' }}
      />
    </Stack>
  );
}
