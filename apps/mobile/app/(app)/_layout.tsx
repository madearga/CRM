/**
 * Authenticated app shell — bottom tab navigation.
 *
 * Five tabs put the core modules one tap away:
 *   1. Dashboard  — what needs attention right now
 *   2. CRM        — Contacts + Companies hub (was "More")
 *   3. Activities — list + quick-create
 *   4. Invoices   — overdue / outstanding read-only
 *   5. Settings   — account, workspace, sign-out (far right)
 *
 * Active icons are filled; inactive icons are outlined so each tab has a clear,
 * non-uniform silhouette. The tab bar uses the theme background/border tokens
 * and a primary-tinted active label so it reads as part of the CRM design
 * system rather than the default iOS/Android chrome.
 */
import { Redirect, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { NetworkBanner } from '@/components/network-banner';
import { useNetwork } from '@/hooks/use-network';
import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/styles/theme';

type TabKey = 'dashboard' | 'crm' | 'activities' | 'invoices' | 'settings';
type IconName = keyof typeof Ionicons.glyphMap;

// Explicit filled/outline pairs (not string-derived) so a tab whose glyph lacks
// an -outline variant (logo-*, brand marks) is a compile error, not a blank
// icon at runtime. CRM tab is briefcase (not people) to avoid clashing with
// the person-circle row inside the CRM hub.
const TAB_CONFIG: Record<TabKey, { title: string; filled: IconName; outline: IconName }> = {
  dashboard: { title: 'Dashboard', filled: 'grid', outline: 'grid-outline' },
  crm: { title: 'CRM', filled: 'briefcase', outline: 'briefcase-outline' },
  activities: { title: 'Activities', filled: 'calendar', outline: 'calendar-outline' },
  invoices: { title: 'Invoices', filled: 'receipt', outline: 'receipt-outline' },
  settings: { title: 'Settings', filled: 'settings', outline: 'settings-outline' },
};

/** Tab bar icon: filled when focused, outlined otherwise. */
const tabIcon = (k: TabKey) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
    <Ionicons name={focused ? TAB_CONFIG[k].filled : TAB_CONFIG[k].outline} size={size} color={color} />;

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
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
          tabBarButton: (props) => <Pressable {...(props as object)} />,
        }}
      >
      <Tabs.Screen name="index" options={{ title: TAB_CONFIG.dashboard.title, tabBarIcon: tabIcon('dashboard') }} />
      {/* Route file is still more.tsx (kept to avoid deep-link churn); the
          tab itself is the CRM hub — hence key/title "CRM". */}
      <Tabs.Screen name="more" options={{ title: TAB_CONFIG.crm.title, tabBarIcon: tabIcon('crm') }} />
      <Tabs.Screen name="activities" options={{ title: TAB_CONFIG.activities.title, tabBarIcon: tabIcon('activities') }} />
      {/* Invoices owns a nested Stack that renders its own headers; hide the
          tab-level header so we never stack two. */}
      <Tabs.Screen name="invoices" options={{ title: TAB_CONFIG.invoices.title, headerShown: false, tabBarIcon: tabIcon('invoices') }} />
      <Tabs.Screen name="settings" options={{ title: TAB_CONFIG.settings.title, tabBarIcon: tabIcon('settings') }} />
    </Tabs>
    </View>
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
