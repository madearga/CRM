/**
 * Contact detail screen (P2.1, Task C).
 *
 * Read-only view of a single contact: header (avatar initials, fullName,
 * jobTitle, lifecycle badge), tap-to-call / tap-to-email action row (present
 * data only, sanitized), company cross-link, and meta (last touch, deal
 * count, tags, notes). NOT_FOUND (thrown by `getById`) is caught by the
 * ErrorBoundary. Not financial PII → no `usePreventScreenCapture`.
 */
import { Linking, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorBoundary } from '@/components/error-boundary';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useQuery } from '@/hooks/use-convex';
import { api, type Id } from '@/lib/api';
import { format } from '@/lib/format-date';
import { colors } from '@/styles/theme';

/** Lifecycle stage → badge variant + label (mirrors contact-row). */
const lifecycleBadgeVariant: Record<string, BadgeProps['variant']> = {
  lead: 'outline',
  prospect: 'warning',
  customer: 'success',
  churned: 'destructive',
};
const lifecycleLabel: Record<string, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  customer: 'Customer',
  churned: 'Churned',
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text variant="muted">Contact not found.</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary
      title="Couldn't load contact"
      message="This contact may have been moved or deleted."
    >
      <ContactDetail id={id as Id<'contacts'>} />
    </ErrorBoundary>
  );
}

function ContactDetail({ id }: { id: Id<'contacts'> }) {
  const router = useRouter();
  const contact = useQuery(api.contacts.getById, { id });

  if (!contact) return <DetailSkeleton />;

  const initials = initialsFrom(contact.fullName);
  const stageVariant = contact.lifecycleStage
    ? lifecycleBadgeVariant[contact.lifecycleStage]
    : undefined;
  const stageLabel = contact.lifecycleStage
    ? lifecycleLabel[contact.lifecycleStage]
    : undefined;

  const lastTouch =
    contact.lastTouchedDays === null
      ? 'Never'
      : `${contact.lastTouchedDays} day${contact.lastTouchedDays === 1 ? '' : 's'} ago`;

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
          <Text variant="h3" className="font-semibold">
            {initials}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text variant="h1" numberOfLines={2}>
            {contact.fullName}
          </Text>
          {contact.jobTitle ? (
            <Text variant="caption" numberOfLines={1}>
              {contact.jobTitle}
            </Text>
          ) : null}
          {stageVariant && stageLabel ? (
            <Badge variant={stageVariant} className="mt-1">
              {stageLabel}
            </Badge>
          ) : null}
        </View>
      </Card>

      {/* Action row — only present data */}
      {(contact.phone || contact.email) && (
        <View className="flex-row gap-3">
          {contact.phone ? (
            <ActionButton
              icon="call-outline"
              label="Call"
              a11yLabel={`Call ${contact.fullName}`}
              onPress={() => openSafe('tel:' + contact.phone)}
            />
          ) : null}
          {contact.email ? (
            <ActionButton
              icon="mail-outline"
              label="Email"
              a11yLabel={`Email ${contact.fullName}`}
              onPress={() => openSafe('mailto:' + contact.email)}
            />
          ) : null}
        </View>
      )}

      {/* Company cross-link */}
      {contact.companyId && contact.companyName ? (
        <CompanyRow
          name={contact.companyName}
          onPress={() => router.push(`/companies/${contact.companyId}`)}
        />
      ) : null}

      {/* Meta */}
      <Card className="gap-3">
        <DetailRow label="Last touched" value={lastTouch} />
        <Divider />
        <DetailRow label="Deals" value={`${contact.dealCount} deal${contact.dealCount === 1 ? '' : 's'}`} />
        <Divider />
        <DetailRow label="Added" value={format(contact.createdAt, 'MMM d, yyyy')} />
      </Card>

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 ? (
        <Card className="gap-2">
          <Text variant="caption">Tags</Text>
          <View className="flex-row flex-wrap gap-2">
            {contact.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </View>
        </Card>
      ) : null}

      {/* Notes */}
      <Card className="gap-2">
        <Text variant="caption">Notes</Text>
        {contact.notes ? (
          <Text variant="body-sm">{contact.notes}</Text>
        ) : (
          <Text variant="muted">No notes</Text>
        )}
      </Card>
    </ScrollView>
  );
}

/** Sanitize + open a tel:/mailto: URL. Rejects javascript:, control chars, empty. */
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

function ActionButton({
  icon,
  label,
  a11yLabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  a11yLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
      className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border bg-card py-3"
    >
      <Ionicons name={icon} size={18} color={colors.foreground} />
      <Text variant="body-sm" className="font-medium">
        {label}
      </Text>
    </Pressable>
  );
}

function CompanyRow({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open company ${name}`}
      onPress={onPress}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      <Card className="flex-row items-center gap-3">
        <Ionicons name="business-outline" size={18} color={colors.foreground} />
        <View className="flex-1">
          <Text variant="caption">Company</Text>
          <Text variant="body" numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </Card>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="muted">{label}</Text>
      <Text variant="body" className="text-right">
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
      <View className="flex-row gap-3">
        <Skeleton className="min-h-11 flex-1" />
        <Skeleton className="min-h-11 flex-1" />
      </View>
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