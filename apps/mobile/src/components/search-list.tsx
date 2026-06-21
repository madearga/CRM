/**
 * Presentational search + paginated list wrapper.
 *
 * Composes a search `TextInput` and a `FlatList`, with first-load skeletons and
 * an empty state. Reused by every Phase-2 list screen (contacts, companies, …)
 * so each only supplies `items`, `renderItem`, and search wiring.
 *
 * Styling rules (see docs/plans mobile-mvp-hardening): static classes only —
 * NO `animate-*`/`active:scale`/`hover:` (Reanimated `makeMutable` crashes
 * Expo Go). 44dp row touch targets are the row's responsibility, not ours.
 */
import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { colors } from '@/styles/theme';

export interface SearchListProps<T> {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (info: { item: T; index: number }) => ReactElement | null;
  onEndReached?: () => void;
  loadingMore?: boolean;
  isLoadingFirst?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyCtaLabel?: string;
  onEmptyCta?: () => void;
  /** Optional icon node for the empty state. */
  emptyIcon?: React.ReactNode;
}

export function SearchList<T>({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  items,
  keyExtractor,
  renderItem,
  onEndReached,
  loadingMore = false,
  isLoadingFirst = false,
  emptyTitle = 'No results',
  emptyMessage,
  emptyCtaLabel,
  onEmptyCta,
  emptyIcon,
}: SearchListProps<T>) {
  const renderFlatItem: ListRenderItem<T> = (info) =>
    renderItem({ item: info.item, index: info.index });

  return (
    <View className="flex-1">
      <View className="px-4 pb-2 pt-3">
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={searchPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          className={cn(
            'h-11 rounded-lg border bg-card px-3 text-sm text-foreground',
          )}
          style={{ color: colors.foreground }}
        />
      </View>

      {isLoadingFirst ? (
        <View className="px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              className="flex-row items-center gap-3 py-3"
              style={{ columnGap: 12 }}
            >
              <Skeleton circle className="h-10 w-10" />
              <View className="flex-1 gap-2" style={{ rowGap: 6 }}>
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon={
            emptyIcon ?? (
              <Text variant="caption" className="text-xs">
                ∅
              </Text>
            )
          }
          title={emptyTitle}
          description={emptyMessage}
          action={
            emptyCtaLabel && onEmptyCta ? (
              <Text
                onPress={onEmptyCta}
                role="button"
                className="text-sm font-semibold text-foreground underline"
              >
                {emptyCtaLabel}
              </Text>
            ) : undefined
          }
        />
      ) : (
        <FlatList<T>
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderFlatItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4">
                <ActivityIndicator color={colors.mutedForeground} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
