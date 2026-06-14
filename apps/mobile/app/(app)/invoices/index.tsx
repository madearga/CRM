/**
 * Invoices tab — list screen (read-only, U7).
 *
 * Attention-first view of outstanding / overdue invoices. Loads a page of
 * non-archived invoices and classifies them client-side into:
 *   - overdue:     posted + amountDue > 0 + dueDate < now
 *   - outstanding: posted + amountDue > 0 + dueDate >= now (owed, not yet late)
 *
 * Summary totals are derived from the same loaded page so the numbers always
 * match the rows the rep can see. The segmented control (Overdue /
 * Outstanding / All) filters the visible list. "Send reminder" is intentionally
 * deferred to Phase 2.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ErrorBoundary } from '@/components/error-boundary';
import { EmptyState } from '@/components/empty-state';
import { InvoiceRow, isInvoiceOverdue, type InvoiceRowItem } from '@/components/invoice-row';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useQuery } from '@/hooks/use-convex';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format-money';
import { colors } from '@/styles/theme';

type Segment = 'overdue' | 'outstanding' | 'all';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'all', label: 'All' },
];

const EMPTY_COPY: Record<Segment, { title: string; description: string }> = {
  overdue: {
    title: 'No overdue invoices',
    description: 'Everything owed has been paid on time. Nice work.',
  },
  outstanding: {
    title: 'Nothing outstanding',
    description: 'No unpaid invoices are coming due right now.',
  },
  all: {
    title: 'No invoices yet',
    description: 'Invoices created on the web will show up here.',
  },
};

export default function InvoicesListScreen() {
  // Query lives in a child so thrown errors are caught by the boundary.
  return (
    <ErrorBoundary
      title="Couldn't load invoices"
      message="We couldn't reach the server. Check your connection and retry."
    >
      <InvoicesListContent />
    </ErrorBoundary>
  );
}

function InvoicesListContent() {
  const [segment, setSegment] = useState<Segment>('overdue');
  const now = Date.now();

  const result = useQuery(api.invoices.list, {
    paginationOpts: { numItems: 100, cursor: null },
  });

  const { overdue, outstanding, all, overdueTotal, outstandingTotal } =
    useMemo(() => {
      const page: InvoiceRowItem[] = result?.page ?? [];
      const overdue = page
        .filter((inv) => isInvoiceOverdue(inv, now))
        .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
      const outstanding = page
        .filter(
          (inv) =>
            inv.state === 'posted' &&
            inv.amountDue > 0 &&
            typeof inv.dueDate === 'number' &&
            inv.dueDate >= now,
        )
        .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
      const overdueTotal = overdue.reduce((sum, inv) => sum + inv.amountDue, 0);
      const outstandingTotal = outstanding.reduce(
        (sum, inv) => sum + inv.amountDue,
        0,
      );
      return {
        overdue,
        outstanding,
        all: page,
        overdueTotal,
        outstandingTotal,
      };
    }, [result, now]);

  const visible =
    segment === 'overdue' ? overdue : segment === 'outstanding' ? outstanding : all;

  const isLoading = result === undefined;

  return (
    <ScrollView
      contentContainerClassName="px-4 pb-12 pt-4 gap-4"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <SummaryCards
        overdueTotal={overdueTotal}
        overdueCount={overdue.length}
        outstandingTotal={outstandingTotal}
        outstandingCount={outstanding.length}
      />

      <SegmentedControl value={segment} onChange={setSegment} />

      {isLoading ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="receipt-outline" size={26} color={colors.mutedForeground} />}
          title={EMPTY_COPY[segment].title}
          description={EMPTY_COPY[segment].description}
        />
      ) : (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {visible.map((inv, index) => (
            <View key={inv.id}>
              <InvoiceRow
                invoice={inv}
                now={now}
                onPress={(id) => router.push(`/invoices/${id}`)}
              />
              {index < visible.length - 1 ? (
                <View className="h-px bg-border" />
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SummaryCards({
  overdueTotal,
  overdueCount,
  outstandingTotal,
  outstandingCount,
}: {
  overdueTotal: number;
  overdueCount: number;
  outstandingTotal: number;
  outstandingCount: number;
}) {
  return (
    <View className="flex-row gap-3">
      <SummaryCard
        label="Total Overdue"
        amount={overdueTotal}
        count={overdueCount}
        tone="destructive"
      />
      <SummaryCard
        label="Outstanding"
        amount={outstandingTotal}
        count={outstandingCount}
        tone="warning"
      />
    </View>
  );
}

function SummaryCard({
  label,
  amount,
  count,
  tone,
}: {
  label: string;
  amount: number;
  count: number;
  tone: 'destructive' | 'warning';
}) {
  const valueColor = tone === 'destructive' ? colors.destructive : colors.warning;
  return (
    <Card className="flex-1 gap-1 p-4">
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
      <Text
        variant="h2"
        numberOfLines={1}
        style={{ color: valueColor }}
      >
        {formatMoney(amount)}
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {count} {count === 1 ? 'invoice' : 'invoices'}
      </Text>
    </Card>
  );
}

function SegmentedControl({
  value,
  onChange,
}: {
  value: Segment;
  onChange: (value: Segment) => void;
}) {
  return (
    <View className="flex-row rounded-lg border border-border bg-muted p-1">
      {SEGMENTS.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filter: ${seg.label}`}
            onPress={() => onChange(seg.key)}
            className="min-h-[44px] flex-1 items-center justify-center rounded-md"
            style={({ pressed }) =>
              ({
                backgroundColor: active
                  ? colors.primary
                  : pressed
                    ? colors.card
                    : 'transparent',
              }) as ViewStyle
            }
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? colors.primaryForeground : colors.mutedForeground,
                fontWeight: active ? '600' : '500',
              }}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ListSkeleton() {
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} className="gap-2 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </View>
          <Skeleton className="h-3 w-40" />
          <View className="flex-row items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </View>
          {i < 5 ? <View className="mt-2 h-px bg-border" /> : null}
        </View>
      ))}
    </View>
  );
}
