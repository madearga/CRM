/**
 * Invoice detail screen (read-only, U7).
 *
 * Shows customer, dates, line items, totals, status, and notes for a single
 * invoice. No mutations — "Send reminder" and payments are intentionally
 * deferred to Phase 2. Errors (incl. NOT_FOUND) are caught by the boundary.
 */
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ErrorBoundary } from '@/components/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useQuery } from '@/hooks/use-convex';
import { api, type Id } from '@/lib/api';
import { format } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';
import { colors } from '@/styles/theme';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text variant="muted">Invoice not found.</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary title="Couldn't load invoice" message="This invoice may have been moved or deleted.">
      <InvoiceDetail id={id as Id<'invoices'>} />
    </ErrorBoundary>
  );
}

function InvoiceDetail({ id }: { id: Id<'invoices'> }) {
  // ponytail: screenshot-protect (expo-screen-capture) deferred — Metro could
  // not resolve the pnpm-symlinked package, blocking invoice detail. Re-add
  // once the install/Metro resolution is fixed or in the EAS build phase
  // (where screenshot-protect matters most, not Expo Go dev).
  const inv = useQuery(api.invoices.getById, { id });

  if (!inv) return <DetailSkeleton />;

  const now = Date.now();
  const overdue =
    inv.state === 'posted' &&
    inv.amountDue > 0 &&
    typeof inv.dueDate === 'number' &&
    inv.dueDate < now;
  const customer = inv.companyName ?? inv.contactName ?? 'No customer';
  const currency = inv.currency;

  const hasDiscount =
    typeof inv.discountAmount === 'number' && inv.discountAmount > 0;
  const hasTax = typeof inv.taxAmount === 'number' && inv.taxAmount > 0;

  return (
    <ScrollView
      contentContainerClassName="gap-4 px-4 pb-12 pt-4"
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="h1" className="flex-1">
            {inv.number}
          </Text>
          <StateBadge state={inv.state} overdue={overdue} />
        </View>
        {inv.paymentStatus ? (
          <Text variant="caption">
            Payment: {labelizePaymentStatus(inv.paymentStatus)}
          </Text>
        ) : null}
      </View>

      {/* Customer + dates */}
      <Card className="gap-3">
        <DetailRow label="Customer" value={customer} />
        <Divider />
        <DetailRow
          label="Invoice date"
          value={inv.invoiceDate ? format(inv.invoiceDate, 'MMM d, yyyy') : '—'}
        />
        <Divider />
        <DetailRow
          label="Due date"
          value={inv.dueDate ? format(inv.dueDate, 'MMM d, yyyy') : '—'}
          valueColor={overdue ? colors.destructive : undefined}
        />
        {overdue ? (
          <Text variant="caption" style={{ color: colors.destructive }}>
            Overdue
          </Text>
        ) : null}
      </Card>

      {/* Line items */}
      <Card className="gap-1 p-0">
        <View className="px-5 pb-2 pt-4">
          <Text variant="caption">Line items</Text>
        </View>
        <CardContent className="gap-0 px-0">
          {inv.lines.length === 0 ? (
            <Text variant="muted" className="px-5 py-4">
              No line items.
            </Text>
          ) : (
            inv.lines.map((line, index) => (
              <View key={line.id}>
                <View className="gap-1 px-5 py-3">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text variant="body" className="flex-1 font-medium" numberOfLines={2}>
                      {line.productName}
                    </Text>
                    <Text variant="body-sm" className="font-semibold">
                      {formatMoney(line.subtotal, currency)}
                    </Text>
                  </View>
                  <Text variant="caption" numberOfLines={2}>
                    {line.quantity} × {formatMoney(line.unitPrice, currency)}
                  </Text>
                </View>
                {index < inv.lines.length - 1 ? <Divider /> : null}
              </View>
            ))
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="gap-2">
        <TotalsRow label="Subtotal" value={formatMoney(inv.subtotal, currency)} />
        {hasDiscount ? (
          <TotalsRow
            label={`Discount${inv.discountType === 'percentage' ? ` (${inv.discountAmount}%)` : ''}`}
            value={`- ${formatMoney(inv.discountAmount, currency)}`}
          />
        ) : null}
        {hasTax ? (
          <TotalsRow label="Tax" value={formatMoney(inv.taxAmount, currency)} />
        ) : null}
        <Divider />
        <TotalsRow
          label="Total"
          value={formatMoney(inv.totalAmount, currency)}
          bold
        />
        <TotalsRow
          label="Amount due"
          value={formatMoney(inv.amountDue, currency)}
          bold
          valueColor={inv.amountDue > 0 ? (overdue ? colors.destructive : colors.foreground) : colors.mutedForeground}
        />
      </Card>

      {(inv.notes || inv.internalNotes) && (
        <Card className="gap-2">
          {inv.notes ? (
            <View className="gap-1">
              <Text variant="caption">Notes</Text>
              <Text variant="body-sm">{inv.notes}</Text>
            </View>
          ) : null}
          {inv.internalNotes ? (
            <View className="gap-1">
              <Text variant="caption">Internal notes</Text>
              <Text variant="body-sm">{inv.internalNotes}</Text>
            </View>
          ) : null}
        </Card>
      )}
    </ScrollView>
  );
}

function StateBadge({ state, overdue }: { state: string; overdue: boolean }) {
  if (overdue) return <Badge variant="destructive">Overdue</Badge>;
  switch (state) {
    case 'paid':
      return <Badge variant="success">Paid</Badge>;
    case 'draft':
      return <Badge variant="outline">Draft</Badge>;
    case 'cancel':
      return <Badge variant="destructive">Cancelled</Badge>;
    case 'posted':
    default:
      return <Badge variant="secondary">Posted</Badge>;
  }
}

function labelizePaymentStatus(status: string): string {
  switch (status) {
    case 'partially_paid':
      return 'Partially paid';
    case 'paid':
      return 'Paid';
    case 'unpaid':
    default:
      return 'Unpaid';
  }
}

function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="muted">{label}</Text>
      <Text variant="body" className="text-right" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
    </View>
  );
}

function TotalsRow({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant={bold ? 'body' : 'muted'} className={bold ? 'font-semibold' : undefined}>
        {label}
      </Text>
      <Text
        variant={bold ? 'body' : 'body'}
        className={bold ? 'font-semibold' : undefined}
        style={valueColor ? { color: valueColor } : undefined}
      >
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
      <View className="gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-28" />
      </View>
      <Card className="gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
      <Card className="gap-2 py-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
      <Card className="gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </Card>
    </ScrollView>
  );
}
