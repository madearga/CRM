/**
 * Activities stack (U6).
 *
 * - `index` — the segmented Upcoming / Recent list. Its header is provided by
 *   the parent tab navigator, so we keep it hidden here to avoid a double
 *   header.
 * - `new` — the quick-create screen, presented as a modal with its own header
 *   ("New Activity") and a back button.
 */
import { Stack } from 'expo-router';

import { colors } from '@/styles/theme';

export default function ActivitiesLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.foreground,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="new"
        options={{
          title: 'New Activity',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
