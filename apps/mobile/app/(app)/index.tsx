/**
 * Dashboard tab — mobile-first home screen (U5).
 *
 * Attention over analytics: the screen leads with what the user owes right now
 * (overdue activities + overdue invoices), then a compact pipeline readout
 * (open deals, revenue MTD), then their next few activities.
 *
 * Data comes from a single consolidated query, `api.dashboard.mobileOverview`,
 * so the whole screen loads in one round trip (no 8-query web pattern). States:
 *  - loading  → skeleton mirroring the real layout (never partial numbers).
 *  - data     → Attention section → KPIs → recent activities.
 *  - empty    → friendly first-run EmptyState with a primary CTA.
 *  - error    → inline retry card (query errors throw; caught here).
 *
 * Navigation uses expo-router's `useRouter()`; attention items deep-link to the
 * Activities and Invoices tabs.
 */
import React, { Component, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ActivityRow } from '@/components/activity-row';
import { AttentionCard } from '@/components/attention-card';
import { EmptyState } from '@/components/empty-state';
import { KpiCard } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { formatCurrencyCompact } from '@/lib/format';
import { colors } from '@/styles/theme';

// ---------------------------------------------------------------------------
// Error boundary — `useQuery` throws on server-side errors (e.g. ConvexError).
// Transient network errors do NOT throw (the client retries; value stays
// `undefined` → skeleton). This boundary renders an inline retry card and
// remounts the data subtree when the user taps Retry.
// ---------------------------------------------------------------------------

interface DashboardErrorBoundaryProps {
  onRetry: () => void;
  children: ReactNode;
}

interface DashboardErrorBoundaryState {
  error: Error | null;
}

class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[dashboard] mobileOverview query failed', error, info);
  }

  handleRetry = () => {
    // Clear local error first; the parent also bumps a remount key so the
    // data subtree re-runs the query subscription cleanly.
    this.setState({ error: null });
    this.props.onRetry();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message =
      (error instanceof Error && error.message) ||
      'We could not load your dashboard right now.';

    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted">
          <Ionicons name="cloud-offline-outline" size={26} color={colors.mutedForeground} />
        </View>
        <Text variant="h3" className="mt-5 text-center">
          Couldn’t load dashboard
        </Text>
        <Text variant="muted" className="mt-1.5 max-w-[280px] text-center">
          {message}
        </Text>
        <Button variant="outline" className="mt-6" onPress={this.handleRetry}>
          Retry
        </Button>
      </View>
    );
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DashboardScreen() {
  const [retryNonce, setRetryNonce] = useState(0);
  const handleRetry = () => setRetryNonce((n) => n + 1);

  return (
    <DashboardErrorBoundary key={retryNonce} onRetry={handleRetry}>
      <DashboardContent />
    </DashboardErrorBoundary>
  );
}

function DashboardContent() {
  const data = useDashboardData();
  const router = useRouter();

  const goToActivities = () => router.navigate('/(app)/activities');
  const goToInvoices = () => router.navigate('/(app)/invoices');

  // Loading: never render partial numbers — wait for the whole payload.
  if (data === undefined) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
        accessibilityLabel="Loading dashboard"
      >
        <DashboardSkeleton />
      </ScrollView>
    );
  }

  // Empty workspace (first-run / nothing owed): friendly full empty state.
  const isWorkspaceEmpty =
    data.openDealsCount === 0 &&
    data.overdueActivitiesCount === 0 &&
    data.recentActivities.length === 0 &&
    data.overdueInvoices.length === 0;

  if (isWorkspaceEmpty) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <EmptyState
          className="flex-1"
          icon={
            <Ionicons name="sparkles-outline" size={26} color={colors.mutedForeground} />
          }
          title="Nothing on your plate yet"
          description="Activities you log and deals you open will show up here."
          action={
            <Button onPress={goToActivities} left={<Ionicons name="add" size={18} color={colors.primaryForeground} />}>
              Log an activity
            </Button>
          }
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 20 }}
      accessibilityLabel="Dashboard"
    >
      {/* 1. Attention section */}
      <AttentionCard
        overdueActivitiesCount={data.overdueActivitiesCount}
        overdueInvoicesTotal={data.overdueInvoicesTotal}
        overdueInvoicesCurrency={data.overdueInvoices[0]?.currency}
        onPressActivities={goToActivities}
        onPressInvoices={goToInvoices}
      />

      {/* 2. KPI cards — pipeline readout (deltas pending backend period data) */}
      <View>
        <SectionHeader>Pipeline</SectionHeader>
        <View className="mt-2 flex-row gap-3">
          <View className="flex-1">
            <KpiCard
              label="Open deals"
              value={`${data.openDealsCount}`}
              testID="kpi-open-deals"
            />
          </View>
          <View className="flex-1">
            <KpiCard
              label="Revenue MTD"
              value={formatCurrencyCompact(data.revenueMTD)}
              testID="kpi-revenue-mtd"
            />
          </View>
        </View>
      </View>

      {/* 3. Recent / upcoming activities */}
      <View>
        <SectionHeader
          action={
            data.recentActivities.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all activities"
                onPress={goToActivities}
                hitSlop={8}
              >
                <Text variant="caption" className="text-primary">
                  See all
                </Text>
              </Pressable>
            ) : null
          }
        >
          Upcoming & recent
        </SectionHeader>

        {data.recentActivities.length === 0 ? (
          <Card className="mt-2 items-center gap-3 py-6">
            <Ionicons name="checkmark-done-outline" size={24} color={colors.mutedForeground} />
            <Text variant="body" className="font-medium">
              You’re all caught up
            </Text>
            <Text variant="muted" className="text-center">
              No upcoming activities scheduled.
            </Text>
            <Button variant="outline" size="sm" onPress={goToActivities}>
              Log activity
            </Button>
          </Card>
        ) : (
          <Card className="mt-2 gap-1 p-0">
            {data.recentActivities.map((activity, index) => (
              <View
                key={activity.id}
                className={index > 0 ? 'border-t border-border px-5' : 'px-5'}
              >
                <ActivityRow
                  title={activity.title}
                  type={activity.type}
                  dueAt={activity.dueAt}
                  onPress={goToActivities}
                />
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function SectionHeader({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body-sm" className="font-semibold uppercase tracking-wide">
        {children}
      </Text>
      {action}
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={{ gap: 20 }}>
      {/* Attention skeleton */}
      <Card className="gap-3 p-0">
        <View className="px-5 pb-2 pt-4">
          <Skeleton className="h-3 w-28" />
        </View>
        <SkeletonRow divider />
        <SkeletonRow divider={false} />
      </Card>

      {/* KPI skeleton */}
      <View style={{ gap: 8 }}>
        <Skeleton className="h-3 w-20" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton className="h-24 flex-1 rounded-xl" />
          <Skeleton className="h-24 flex-1 rounded-xl" />
        </View>
      </View>

      {/* Activities skeleton */}
      <View style={{ gap: 8 }}>
        <Skeleton className="h-3 w-36" />
        <Card className="gap-2 p-0">
          <SkeletonRow divider />
          <SkeletonRow divider />
          <SkeletonRow divider />
          <SkeletonRow divider={false} />
        </Card>
      </View>
    </View>
  );
}

function SkeletonRow({ divider }: { divider: boolean }) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
        divider ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined,
      ]}
    >
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-3 w-12" />
    </View>
  );
}
