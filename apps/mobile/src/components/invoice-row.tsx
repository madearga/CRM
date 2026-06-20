/**
 * Compact invoice row for the mobile invoices list.
 *
 * Shows invoice number, customer, due date, and the amount due. The status
 * badge is derived from `state` PLUS an overdue signal (posted + unpaid + past
 * due) so reps can scan for what needs attention without reading every row.
 *
 * Touch target: the whole row is a `Pressable` with comfortable vertical
 * padding (comfortably ≥ 44 dp). Accepts an injected `now` so overdue
 * classification is deterministic and unit-testable.
 */
import { memo } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { format } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

export interface InvoiceRowItem {
  id: string;
  number: string;
  state: string;
  dueDate?: number;
  totalAmount: number;
  amountDue: number;
  currency?: string;
  companyName?: string;
  contactName?: string;
}

export interface InvoiceRowProps {
  invoice: InvoiceRowItem;
  /** Current epoch ms. Injected so overdue math is deterministic/testable. */
  now: number;
  onPress?: (id: string) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isInvoiceOverdue(inv: InvoiceRowItem, now: number): boolean {
  return (
    inv.state === 'posted' &&
    inv.amountDue > 0 &&
    typeof inv.dueDate === 'number' &&
    inv.dueDate < now
  );
}

function StatusBadge({ invoice, now }: { invoice: InvoiceRowItem; now: number }) {
  if (isInvoiceOverdue(invoice, now)) {
    const days = Math.floor((now - (invoice.dueDate as number)) / MS_PER_DAY);
    return <Badge variant="destructive">Overdue {days}d</Badge>;
  }
  switch (invoice.state) {
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

function InvoiceRowImpl({ invoice, now, onPress }: InvoiceRowProps) {
  const customer = invoice.companyName ?? invoice.contactName ?? 'No customer';
  const overdue = isInvoiceOverdue(invoice, now);

  const dueLabel =
    typeof invoice.dueDate === 'number'
      ? format(invoice.dueDate, 'MMM d, yyyy')
      : '—';

  const hasAmountDue = invoice.amountDue > 0;
  const primaryAmount = hasAmountDue ? invoice.amountDue : invoice.totalAmount;
  const amountLabel = formatMoney(primaryAmount, invoice.currency);

  const a11yLabel = [
    `Invoice ${invoice.number}`,
    customer,
    `due ${dueLabel}`,
    overdue ? 'overdue' : invoice.state,
    amountLabel,
  ].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress ? () => onPress(invoice.id) : undefined}
      className="min-h-[56px] flex-col gap-1 px-4 py-3"
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.7 : 1 }) as ViewStyle
      }
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="body"
          className="flex-1 font-semibold"
          numberOfLines={1}
        >
          {invoice.number}
        </Text>
        <StatusBadge invoice={invoice} now={now} />
      </View>

      <Text variant="caption" numberOfLines={1}>
        {customer}
      </Text>

      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="caption"
          className={overdue ? 'text-destructive' : undefined}
          numberOfLines={1}
        >
          {overdue ? `${dueLabel} · overdue` : dueLabel}
        </Text>
        <Text
          variant="body-sm"
          className={`font-semibold ${overdue ? 'text-destructive' : hasAmountDue ? 'text-foreground' : 'text-muted-foreground'}`}
          numberOfLines={1}
        >
          {amountLabel}
        </Text>
      </View>
    </Pressable>
  );
}

export const InvoiceRow = memo(InvoiceRowImpl);
