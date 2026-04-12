'use client';

import { useState } from 'react';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface PaymentDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  amountDue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'e_wallet', label: 'E-Wallet' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export function PaymentDialog({
  invoiceId, invoiceNumber, amountDue, open, onOpenChange, onSuccess,
}: PaymentDialogProps) {
  const [form, setForm] = useState({
    amount: amountDue,
    paymentDate: new Date().toISOString().split('T')[0],
    method: 'bank_transfer',
    reference: '',
    memo: '',
  });

  const registerPayment = useAuthMutation(api.invoices.addPayment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await registerPayment.mutateAsync({
        invoiceId: invoiceId as any,
        amount: form.amount,
        paymentDate: new Date(form.paymentDate).getTime(),
        method: form.method as any,
        reference: form.reference || undefined,
        memo: form.memo || undefined,
      });

      toast.success('Payment registered successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.data?.message || 'Failed to register payment');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice <strong>{invoiceNumber}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right text-sm">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={amountDue}
                className="col-span-3"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentDate" className="text-right text-sm">Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                className="col-span-3"
                value={form.paymentDate}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="method" className="text-right text-sm">Method *</Label>
              <Select value={form.method} onValueChange={(v) => setForm((prev) => ({ ...prev, method: v }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reference" className="text-right text-sm">Reference</Label>
              <Input
                id="reference"
                placeholder="Transaction ID, Cheque #, etc."
                className="col-span-3"
                value={form.reference}
                onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="memo" className="text-right text-sm">Memo</Label>
              <Textarea
                id="memo"
                placeholder="Internal notes about this payment..."
                className="col-span-3"
                value={form.memo}
                onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={registerPayment.isPending}>
              {registerPayment.isPending ? 'Processing...' : 'Register Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
