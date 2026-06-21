/**
 * Authenticated app shell — bottom tab navigation.
 *
 * Four tabs map to the MVP attention model (U3 layout, screens fleshed out in
 * U5–U7):
 *   1. Dashboard  — what needs attention right now (U5)
 *   2. Activities — list + quick-create (U6)
 *   3. Invoices   — overdue / outstanding read-only (U7)
 *   4. More       — profile, sign-out, settings
 *
 * The tab bar uses the theme background/border tokens and a primary-tinted
 * active label so it reads as part of the CRM design system rather than the
 * default iOS/Android chrome.
 */
import { Redirect, Tabs, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { NetworkBanner } from '@/components/network-banner';
import { useNetwork } from '@/hooks/use-network';
import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/styles/theme';

type TabKey = 'dashboard' | 'activities' | 'invoices' | 'more';

const TAB_CONFIG: Record<
  TabKey,
  { title: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  dashboard: { title: 'Dashboard', icon: 'grid-outline' },
  activities: { title: 'Activities', icon: 'checkbox-outline' },
  invoices: { title: 'Invoices', icon: 'receipt-outline' },
  more: { title: 'More', icon: 'menu-outline' },
};

export default function AppLayout() {
  const { status } = useAuth();

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View className="flex-1">
      <TabNetworkBanner />
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTintColor: colors.foreground,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.foreground },
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarButton: (props) => <Pressable {...(props as object)} />,
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: TAB_CONFIG.dashboard.title,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_CONFIG.dashboard.icon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: TAB_CONFIG.activities.title,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={TAB_CONFIG.activities.icon}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: TAB_CONFIG.invoices.title,
          // The invoices tab owns a nested Stack (invoices/_layout.tsx) that
          // renders its own headers (list + detail). Hide the tab-level header
          // here so we never stack two headers on top of each other.
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_CONFIG.invoices.icon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: TAB_CONFIG.more.title,
          // Settings as a gear icon on the far right of the header (not a list
          // row) so the More list stays focused on feature navigation and
          // scales cleanly as Phase 2 adds more rows.
          headerRight: () => <SettingsGearAction />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_CONFIG.more.icon} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}

/**
 * Header settings gear (far-right). Big hit target via hitSlop; aria-label so
 * the icon-only button is announced. Pushes the settings stack.
 */
function SettingsGearAction() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/(app)/settings')}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={{ top: 10, bottom: 10, left: 12, right: 8 }}
      className="px-3"
    >
      <Ionicons name="settings-outline" size={22} color={colors.foreground} />
    </Pressable>
  );
}

/**
 * Global connectivity banner rendered above the bottom tabs.
 *
 * Shows a persistent warning when offline, and a brief success confirmation
 * when connectivity is restored. Hidden the rest of the time so it does not
 * compete with screen content for attention.
 */
function TabNetworkBanner() {
  const { isOnline, wasRecentlyOffline, checkNow } = useNetwork();

  if (isOnline && !wasRecentlyOffline) return null;

  return (
    <NetworkBanner
      online={isOnline}
      onRetry={checkNow}
    />
  );
}
