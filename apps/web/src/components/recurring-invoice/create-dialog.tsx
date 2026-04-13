'use client';

import { useState, useMemo } from 'react';
import { useAuthMutation, useAuthPaginatedQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface LineItem {
  productName: string;
  quantity: string;
  unitPrice: string;
  description: string;
}

interface CreateRecurringInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyLine = (): LineItem => ({
  productName: '',
  quantity: '1',
  unitPrice: '0',
  description: '',
});

export function CreateRecurringInvoiceDialog({
  open,
  onOpenChange,
}: CreateRecurringInvoiceDialogProps) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('IDR');

  const { data: companies } = useAuthPaginatedQuery(
    api.companies.list,
    {},
    { initialNumItems: 100 },
  );
  const { data: contacts } = useAuthPaginatedQuery(
    api.contacts.list,
    {},
    { initialNumItems: 100 },
  );

  const createMutation = useAuthMutation(api.recurringInvoices.create, {
    onSuccess: () => {
      toast.success('Recurring invoice created');
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.data?.message ?? 'Failed to create recurring invoice');
    },
  });

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [lines]);

  const resetForm = () => {
    setName('');
    setFrequency('monthly');
    setStartDate('');
    setEndDate('');
    setMaxOccurrences('');
    setCompanyId('');
    setContactId('');
    setLines([emptyLine()]);
    setNotes('');
    setCurrency('IDR');
  };

  const updateLine = (index: number, field: keyof LineItem, value: string) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      toast.error('Start date is required');
      return;
    }

    const parsedLines = lines
      .filter((l) => l.productName.trim())
      .map((l) => ({
        productName: l.productName.trim(),
        quantity: parseFloat(l.quantity) || 0,
        unitPrice: parseFloat(l.unitPrice) || 0,
        ...(l.description.trim() ? { description: l.description.trim() } : {}),
      }));

    if (parsedLines.length === 0) {
      toast.error('At least one line item with a product name is required');
      return;
    }

    const startTimestamp = new Date(startDate).getTime();

    createMutation.mutate({
      ...(name.trim() ? { name: name.trim() } : {}),
      frequency: frequency as any,
      startDate: startTimestamp,
      nextInvoiceDate: startTimestamp,
      ...(endDate ? { endDate: new Date(endDate).getTime() } : {}),
      ...(maxOccurrences ? { maxOccurrences: parseInt(maxOccurrences, 10) } : {}),
      ...(companyId ? { companyId: companyId as any } : {}),
      ...(contactId ? { contactId: contactId as any } : {}),
      currency,
      lines: parsedLines,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Recurring Invoice</DialogTitle>
          <DialogDescription>
            Set up a recurring invoice to be generated automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="ri-name">Name</Label>
            <Input
              id="ri-name"
              placeholder="e.g. Monthly retainer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Frequency & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ri-frequency">Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="ri-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ri-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="ri-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ri-start">Start Date *</Label>
              <Input
                id="ri-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ri-end">End Date</Label>
              <Input
                id="ri-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ri-max-occ">Max Occurrences</Label>
              <Input
                id="ri-max-occ"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
              />
            </div>
          </div>

          {/* Company & Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ri-company">Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger id="ri-company">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {(companies as any[])?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ri-contact">Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger id="ri-contact">
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {(contacts as any[])?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName ?? c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            </div>

            {lines.map((line, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-end"
              >
                <div>
                  {idx === 0 && (
                    <span className="text-xs text-muted-foreground">Product</span>
                  )}
                  <Input
                    placeholder="Product name"
                    value={line.productName}
                    onChange={(e) =>
                      updateLine(idx, 'productName', e.target.value)
                    }
                  />
                </div>
                <div>
                  {idx === 0 && (
                    <span className="text-xs text-muted-foreground">Qty</span>
                  )}
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(idx, 'quantity', e.target.value)
                    }
                  />
                </div>
                <div>
                  {idx === 0 && (
                    <span className="text-xs text-muted-foreground">Unit Price</span>
                  )}
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(idx, 'unitPrice', e.target.value)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  disabled={lines.length <= 1}
                  onClick={() => removeLine(idx)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}

            <div className="text-right text-sm font-medium">
              Subtotal: {subtotal.toLocaleString()} {currency}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="ri-notes">Notes</Label>
            <textarea
              id="ri-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
