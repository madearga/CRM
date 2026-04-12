'use client';

import { formatMoney } from '@/lib/format-money';

interface AmountSummaryProps {
  subtotal: number;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed';
  taxAmount?: number;
  totalAmount: number;
}

export function AmountSummary({ subtotal, discountAmount, discountType, taxAmount, totalAmount }: AmountSummaryProps) {
  const discountValue = discountAmount
    ? discountType === 'percentage'
      ? subtotal * discountAmount / 100
      : discountAmount
    : 0;

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatMoney(subtotal)}</span>
      </div>
      {discountAmount != null && discountAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Discount {discountType === 'percentage' ? `(${discountAmount}%)` : ''}
          </span>
          <span className="text-red-600">-{formatMoney(discountValue)}</span>
        </div>
      )}
      {taxAmount != null && taxAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span>{formatMoney(taxAmount)}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-2 text-sm font-semibold">
        <span>Total</span>
        <span>{formatMoney(totalAmount)}</span>
      </div>
    </div>
  );
}
