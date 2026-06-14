/**
 * Dashboard tab — placeholder until U5 builds the mobile-first dashboard.
 *
 * Renders a centered label so the tab is navigable and the auth→app redirect
 * has a visible landing screen. U5 replaces this with KPI cards + attention
 * lists backed by `useQuery`.
 */
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function DashboardScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text variant="h2">Dashboard</Text>
      <Text variant="muted" className="mt-2">
        Mobile dashboard arrives in U5.
      </Text>
    </View>
  );
}
