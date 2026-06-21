/**
 * Nested navigator for the Contacts group (P2.1, Task B).
 *
 * Hosts the list (`index`). Detail (`[id]`) is added in Task C. Mirrors the
 * invoices `_layout.tsx`: a single Stack provides the themed header + back
 * button so list screens stay header-less bodies.
 */
import { Stack } from 'expo-router';

import { colors } from '@/styles/theme';

export default function ContactsLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Contacts' }} />
      <Stack.Screen name="[id]" options={{ title: 'Contact' }} />
    </Stack>
  );
}