/**
 * Searchable linked-entity picker (U6).
 *
 * Backed by `api.search.globalSearch` (one round trip → companies + contacts +
 * deals). The user types a query, picks one result, and the selected entity is
 * surfaced as `{ entityType, entityId, label }`.
 *
 * `entityType` is derived from the bucket the result came from, matching the
 * `ENTITY_TYPES` union in `@crm/domain` (`company | contact | deal`) that the
 * `activities.schedule` mutation requires.
 *
 * Debounce: 300 ms after the user stops typing before firing the query, so we
 * don't spam Convex on every keystroke.
 */
import { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { useQuery } from '@/hooks/use-convex';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { colors } from '@/styles/theme';
import type { EntityType } from '@crm/domain';

/** A single searchable result normalized to a common shape. */
export interface EntityOption {
  entityType: EntityType;
  entityId: string;
  label: string;
  sublabel?: string;
}

export interface EntityPickerProps {
  value: EntityOption | null;
  onChange: (entity: EntityOption | null) => void;
  /** Validation/error message rendered under the field. */
  error?: string;
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

function toOptions(
  data:
    | {
        companies: { id: string; name: string; industry?: string }[];
        contacts: { id: string; fullName: string; email: string }[];
        deals: { id: string; title: string; stage: string }[];
      }
    | undefined,
): EntityOption[] {
  if (!data) return [];
  const companies: EntityOption[] = data.companies.map((c) => ({
    entityType: 'company',
    entityId: c.id,
    label: c.name,
    sublabel: c.industry,
  }));
  const contacts: EntityOption[] = data.contacts.map((c) => ({
    entityType: 'contact',
    entityId: c.id,
    label: c.fullName,
    sublabel: c.email,
  }));
  const deals: EntityOption[] = data.deals.map((d) => ({
    entityType: 'deal',
    entityId: d.id,
    label: d.title,
    sublabel: d.stage,
  }));
  return [...companies, ...contacts, ...deals];
}

const TYPE_BADGE_VARIANT: Record<EntityType, 'default' | 'secondary' | 'success'> = {
  company: 'default',
  contact: 'secondary',
  deal: 'success',
};

export const EntityPicker = memo(function EntityPicker({
  value,
  onChange,
  error,
}: EntityPickerProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Debounce the query string.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const enabled = debounced.length >= MIN_QUERY;
  const result = useQuery(
    api.search.globalSearch,
    enabled ? { query: debounced } : 'skip',
  );
  const isLoading = enabled && result === undefined;
  const options = toOptions(result);

  // Selected state — show a chip with a clear button.
  if (value) {
    return (
      <View className="gap-2">
        <Pressable
          onPress={() => {
            onChange(null);
            setQuery('');
          }}
          accessibilityRole="button"
          accessibilityLabel={`Linked entity: ${value.label}. Tap to change.`}
          className="min-h-[44px] flex-row items-center justify-between gap-3 rounded-md border border-primary bg-card px-3.5 py-2.5"
        >
          <View className="flex-1 flex-row items-center gap-2.5">
            <Ionicons name="link-outline" size={16} color={colors.foreground} />
            <View className="flex-1 gap-0.5">
              <Text variant="body" numberOfLines={1}>
                {value.label}
              </Text>
              {value.sublabel ? (
                <Text variant="caption" numberOfLines={1}>
                  {value.sublabel}
                </Text>
              ) : null}
            </View>
          </View>
          <Badge variant={TYPE_BADGE_VARIANT[value.entityType]}>
            {value.entityType}
          </Badge>
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 rounded-md border border-border bg-card px-3 h-12">
        <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search deal, contact, or company"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search linked entity"
          className="flex-1 text-sm text-foreground"
        />
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : null}
      </View>

      {error ? (
        <Text className="text-sm text-destructive" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {/* Results */}
      {enabled && !isLoading && options.length === 0 ? (
        <Text variant="caption" className="px-1">
          No results for “{debounced}”.
        </Text>
      ) : null}

      {options.length > 0 ? (
        <View className="mt-1 overflow-hidden rounded-md border border-border">
          {options.map((opt, i) => (
            <Pressable
              key={`${opt.entityType}:${opt.entityId}`}
              onPress={() => onChange(opt)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${opt.entityType}: ${opt.label}`}
              className={cn(
                'min-h-[48px] flex-row items-center justify-between gap-3 px-3.5 py-2.5',
                i > 0 && 'border-t border-border',
              )}
            >
              <View className="flex-1 gap-0.5">
                <Text variant="body" numberOfLines={1}>
                  {opt.label}
                </Text>
                {opt.sublabel ? (
                  <Text variant="caption" numberOfLines={1}>
                    {opt.sublabel}
                  </Text>
                ) : null}
              </View>
              <Badge variant={TYPE_BADGE_VARIANT[opt.entityType]}>
                {opt.entityType}
              </Badge>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});
