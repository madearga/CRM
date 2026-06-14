/**
 * Root layout for the mobile app.
 *
 * Provider tree (outermost → innermost):
 *   SafeAreaProvider  — insets for notch/home-indicator
 *   ConvexClientProvider — installs the Better Auth token fetcher on the
 *                          shared ConvexReactClient and provides `useQuery`
 *                          / `useMutation` to the tree.
 *   AuthProvider        — reactive session state machine driving navigation.
 *
 * The `<Stack>` renders the route groups: `index` (auth gate redirect),
 * `(auth)` (login), `(app)` (bottom tabs), plus the standalone U4 gallery.
 */
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/providers/auth-provider';
import { ConvexClientProvider } from '@/providers/convex-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConvexClientProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </ConvexClientProvider>
    </SafeAreaProvider>
  );
}
