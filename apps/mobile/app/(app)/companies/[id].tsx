/**
 * Company detail screen (P2.1, Task E).
 *
 * Read-only view of a single company: header (business icon avatar, name,
 * industry, status badge), website action (scheme-safe sanitized), meta
 * (industry/size/address/country/pricelist/added), counts, notes, and a
 * paginated list of contacts at this company (rendered with the shared
 * `<ContactRow>` so contact→company→contact cross-link works both ways).
 *
 * `api.companies.getById` returns `null` when not found (NOT throw) — handled
 * with a centered empty state, NOT a thrown ErrorBoundary. Not financial PII →
 * no `usePreventScreenCapture`.
 */
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { ErrorBoundary } from '@/components/error-boundary';
import { ContactRow, type ContactRowItem } from '@/components/contact-row';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { usePaginatedQuery, useQuery } from '@/hooks/use-convex';
import { api, type Id } from '@/lib/api';
import { format } from '@/lib/format-date';
import { colors } from '@/styles/theme';

/** Company status → badge variant. Mirrors the company-row map (copied inline
 *  rather than exported — small, stable, no reuse elsewhere). */
const statusBadgeVariant: Record<string, BadgeProps['variant']> = {
  active: 'success',
  customer: 'success',
  prospect: 'warning',
  lead: 'warning',
  churned: 'destructive',
  inactive: 'destructive',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  customer: 'Customer',
  prospect: 'Prospect',
  lead: 'Lead',
  churned: 'Churned',
  inactive: 'Inactive',
};

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text variant="muted">Company not found.</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary
      title="Couldn't load company"
      message="This company may have been moved or deleted."
    >
      <CompanyDetail id={id as Id<'companies'>} />
    </ErrorBoundary>
  );
}

function CompanyDetail({ id }: { id: Id<'companies'> }) {
  const company = useQuery(api.companies.getById, { id });

  if (company === undefined) return <DetailSkeleton />;

  if (company === null) {
    return (
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text variant="h2">Company not found</Text>
        <Text variant="muted" className="text-center">
          This company may have been moved or deleted.
        </Text>
      </View>
    );
  }

  const variant = company.status ? statusBadgeVariant[company.status] : undefined;
  const label = company.status ? statusLabel[company.status] ?? company.status : undefined;
  const websiteUrl = sanitizeWebsite(company.website);

  return (
    <ScrollView
      contentContainerClassName="gap-4 px-4 pb-12 pt-4"
      keyboardShouldPersistTaps="handled"
    >
      {/* Header card */}
      <Card className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.muted }}
        >
          <Ionicons
            name="business-outline"
            size={24}
            color={colors.mutedForeground}
          />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="h1" numberOfLines={2}>
            {company.name}
          </Text>
          {company.industry ? (
            <Text variant="caption" numberOfLines={1}>
              {company.industry}
            </Text>
          ) : null}
          {variant && label ? (
            <Badge variant={variant} className="mt-1">
              {label}
            </Badge>
          ) : null}
        </View>
      </Card>

      {/* Website action (scheme-safe, sanitized) */}
      {websiteUrl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open website ${websiteUrl}`}
          onPress={() => openSafe(websiteUrl)}
          style={({ pressed }) =>
            ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
          }
          className="min-h-11 flex-row items-center justify-center gap-2 rounded-md border border-border bg-card py-3"
        >
          <Ionicons name="globe-outline" size={18} color={colors.foreground} />
          <Text variant="body-sm" className="font-medium">
            Website
          </Text>
        </Pressable>
      ) : null}

      {/* Meta — present data only */}
      <Card className="gap-3">
        {company.industry ? (
          <>
            <DetailRow label="Industry" value={company.industry} />
            <Divider />
          </>
        ) : null}
        {company.size ? (
          <>
            <DetailRow label="Size" value={company.size} />
            <Divider />
          </>
        ) : null}
        {company.address ? (
          <>
            <DetailRow label="Address" value={company.address} />
            <Divider />
          </>
        ) : null}
        {company.country ? (
          <>
            <DetailRow label="Country" value={company.country} />
            <Divider />
          </>
        ) : null}
        {company.pricelistName ? (
          <>
            <DetailRow label="Pricelist" value={company.pricelistName} />
            <Divider />
          </>
        ) : null}
        <DetailRow
          label="Contacts"
          value={`${company.contactsCount} contact${company.contactsCount === 1 ? '' : 's'}`}
        />
        <Divider />
        <DetailRow
          label="Deals"
          value={`${company.dealsCount} deal${company.dealsCount === 1 ? '' : 's'}`}
        />
        <Divider />
        <DetailRow label="Added" value={format(company.createdAt, 'MMM d, yyyy')} />
      </Card>

      {/* Notes */}
      <Card className="gap-2">
        <Text variant="caption">Notes</Text>
        {company.notes ? (
          <Text variant="body-sm">{company.notes}</Text>
        ) : (
          <Text variant="muted">No notes</Text>
        )}
      </Card>

      {/* Contacts at this company */}
      <ContactsAtCompany companyId={id} />
    </ScrollView>
  );
}

/** Build a safe https:// URL from a free-form `website` field. Returns null
 *  if the input is empty, uses a non-http(s) scheme, or contains control chars. */
function sanitizeWebsite(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;

  // ponytail: accept whatever scheme is given if it's already http(s); else
  // assume https. Reject everything else to avoid javascript:/data:/file: etc.
  if (/^https?:\/\//i.test(trimmed)) {
    return /^javascript:/i.test(trimmed) ? null : trimmed;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    // Some other scheme (mailto:, ftp:, etc.) — not a website.
    return null;
  }
  return `https://${trimmed}`;
}

/** Sanitize + open a URL. Rejects javascript:, control chars, empty. */
function openSafe(raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (/javascript:/i.test(trimmed)) return;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return;
  try {
    void Linking.openURL(trimmed);
  } catch {
    /* no-op: openURL can reject; never crash the row tap */
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="muted">{label}</Text>
      <Text variant="body" className="text-right" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-border" />;
}

function DetailSkeleton() {
  return (
    <ScrollView
      contentContainerClassName="gap-4 px-4 pb-12 pt-4"
      keyboardShouldPersistTaps="handled"
    >
      <Card className="flex-row items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <View className="flex-1 gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </View>
      </Card>
      <Skeleton className="min-h-11" />
      <Card className="gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
      <Card className="gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
      </Card>
    </ScrollView>
  );
}

function ContactsAtCompany({ companyId }: { companyId: Id<'companies'> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.contacts.list,
    { companyId },
    { initialNumItems: 25 },
  );

  const items = useMemo(() => results as ContactRowItem[], [results]);
  const canLoadMore = status === 'CanLoadMore';

  return (
    <View className="gap-2">
      <Text variant="caption" className="px-1">
        Contacts
      </Text>
      <Card className="gap-0 overflow-hidden p-0">
        {items.length === 0 ? (
          <View className="px-4 py-6">
            <Text variant="muted" className="text-center">
              No contacts at this company
            </Text>
          </View>
        ) : (
          <View>
            {items.map((item) => (
              <ContactRow key={item.id} {...item} />
            ))}
          </View>
        )}
        {canLoadMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load more contacts"
            onPress={() => loadMore(25)}
            style={({ pressed }) =>
              ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
            }
            className="min-h-11 flex-row items-center justify-center gap-2 border-t border-border py-3"
          >
            <ActivityIndicator color={colors.mutedForeground} />
            <Text variant="body-sm" className="font-medium">
              Load more
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </View>
  );
}
