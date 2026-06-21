/**
 * Nested navigator for the Companies group (P2.1, Task D).
 *
 * Hosts the list (`index`). Detail (`[id]`) is added in Task E. Mirrors the
 * contacts `_layout.tsx`: a single Stack provides the themed header + back
 * button so list screens stay header-less bodies.
 */
import { Stack } from 'expo-router';

import { colors } from '@/styles/theme';

export default function CompaniesLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Companies' }} />
      <Stack.Screen name="[id]" options={{ title: 'Company' }} />
    </Stack>
  );
}