/**
 * Root layout for the mobile app.
 *
 * Provider tree (outermost → innermost):
 *   SafeAreaProvider  — insets for notch/home-indicator
 *   NetworkProvider    — connectivity state for the Convex listener
 *   AuthProvider        — reactive session state machine driving navigation.
 *                         Mounts OUTSIDE ConvexClientProvider so the session
 *                         is resolved before Convex attempts a token
 *                         handshake (avoids the cold-start
 *                         "unauthenticated despite valid token" gap).
 *   ConvexClientProvider — subscribes to AuthProvider's status, installs the
 *                          Better Auth token fetcher once `authenticated`, and
 *                          provides `useQuery` / `useMutation` to the tree.
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
import { NetworkProvider } from '@/providers/network-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <ConvexClientProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }} />
          </ConvexClientProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
