/**
 * Activities list screen (U6).
 *
 * Segmented control toggles between:
 *   - Upcoming — `api.activities.upcoming` (planned, sorted by scheduledAt asc)
 *   - Recent   — `api.activities.listRecent` (org-wide, sorted by createdAt desc)
 *
 * A floating action button (FAB) opens the quick-create modal at
 * `activities/new`. Loading shows skeletons; failures show an inline retry;
 * empty results show a CTA that also opens the create modal.
 */
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ActivityRow } from '@/components/activity-row';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useQuery } from '@/hooks/use-convex';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { colors } from '@/styles/theme';

type Tab = 'upcoming' | 'recent';

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'recent', label: 'Recent' },
];

/** Shape of a Convex activities doc as consumed by the list. */
interface ActivityListItem {
  _id: string;
  title: string;
  type: string;
  status?: 'planned' | 'done' | 'cancelled';
  dueAt?: number;
  scheduledAt?: number;
  completedAt?: number;
}

export default function ActivitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('upcoming');

  // Both queries are authenticated, org-scoped wrappers (createOrgQuery).
  const upcoming = useQuery(api.activities.upcoming, {});
  const recent = useQuery(api.activities.listRecent, {});

  const data = tab === 'upcoming' ? upcoming : recent;
  const isLoading = data === undefined;
  const isError = data !== undefined && data === null;

  const goNew = () => router.push('/(app)/activities/new');

  return (
    <View className="flex-1 bg-background">
      {/* Segmented control */}
      <View className="flex-row gap-1 px-4 pt-3">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={cn(
                'min-h-[44px] flex-1 items-center justify-center rounded-md py-2.5',
                active ? 'bg-primary' : 'bg-card',
              )}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  active ? 'text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <View className="mt-3 flex-1">
        {isLoading ? (
          <ActivityListSkeleton />
        ) : isError ? (
          <EmptyState
            icon={<Ionicons name="cloud-offline-outline" size={24} color={colors.mutedForeground} />}
            title="Couldn’t load activities"
            description="Something went wrong fetching your activities. Pull to try again."
            action={
              <Button variant="outline" onPress={() => setTab(tab)}>
                Retry
              </Button>
            }
          />
        ) : data && data.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="calendar-outline" size={24} color={colors.mutedForeground} />}
            title={tab === 'upcoming' ? 'No upcoming activities' : 'No recent activities'}
            description={
              tab === 'upcoming'
                ? 'Schedule a follow-up so it shows up here when it’s due.'
                : 'Activities you log will appear here.'
            }
            action={<Button onPress={goNew}>New activity</Button>}
          />
        ) : (
          <FlatList<ActivityListItem>
            data={data as ActivityListItem[]}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <ActivityRow
                title={item.title}
                type={item.type}
                dueAt={item.scheduledAt ?? item.dueAt ?? Number.NaN}
              />
            )}
            ItemSeparatorComponent={() => (
              <View className="ml-[64px] h-px bg-border" />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          />
        )}
      </View>

      {/* FAB — New Activity */}
      <Pressable
        onPress={goNew}
        accessibilityRole="button"
        accessibilityLabel="New activity"
        style={{
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 20,
          height: 56,
          width: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
      >
        <Ionicons name="add" size={28} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

function ActivityListSkeleton() {
  return (
    <View className="px-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="flex-row items-center gap-3 py-3.5">
          <Skeleton circle className="h-10 w-10" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </View>
          <Skeleton className="h-5 w-14 rounded-md" />
        </View>
      ))}
    </View>
  );
}
