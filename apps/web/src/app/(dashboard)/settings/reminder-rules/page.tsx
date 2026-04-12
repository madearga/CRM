'use client';

import { useState, useEffect } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Bell, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface RuleForm {
  name: string;
  daysOverdue: number;
  subject: string;
  body: string;
  includeInvoicePdf: boolean;
  isActive: boolean;
}

const DEFAULT_RULES: Omit<RuleForm, 'isActive'>[] = [
  {
    name: 'First Reminder',
    daysOverdue: 7,
    subject: 'Reminder: Invoice {invoice_number} is overdue',
    body: 'Dear {customer_name},\n\nThis is a friendly reminder that invoice {invoice_number} for {amount} was due on {due_date}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.',
    includeInvoicePdf: true,
  },
  {
    name: 'Second Notice',
    daysOverdue: 30,
    subject: 'Second Notice: Invoice {invoice_number} is {days_overdue} days overdue',
    body: 'Dear {customer_name},\n\nWe have not yet received payment for invoice {invoice_number} ({amount}), which was due on {due_date} and is now {days_overdue} days overdue.\n\nPlease process payment immediately or contact us to discuss.\n\nRegards.',
    includeInvoicePdf: true,
  },
  {
    name: 'Final Notice',
    daysOverdue: 60,
    subject: 'FINAL NOTICE: Invoice {invoice_number} — Immediate payment required',
    body: 'Dear {customer_name},\n\nThis is our final notice regarding invoice {invoice_number} for {amount}, due on {due_date}.\n\nThis invoice is now {days_overdue} days overdue. If payment is not received within 7 days, we may proceed with further collection actions.\n\nPlease contact us immediately.',
    includeInvoicePdf: true,
  },
];

const emptyForm: RuleForm = {
  name: '',
  daysOverdue: 7,
  subject: '',
  body: '',
  includeInvoicePdf: true,
  isActive: true,
};

export default function ReminderRulesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);

  const { data: rules, isLoading } = useAuthQuery(api.invoiceReminders.listReminderRules, {});
  const createRule = useAuthMutation(api.invoiceReminders.createReminderRule);
  const updateRule = useAuthMutation(api.invoiceReminders.updateReminderRule);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditingId(rule._id);
    setForm({
      name: rule.name,
      daysOverdue: rule.daysOverdue,
      subject: rule.subject,
      body: rule.body,
      includeInvoicePdf: rule.includeInvoicePdf ?? true,
      isActive: rule.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.subject || !form.body) {
      toast.error('Name, subject, and body are required');
      return;
    }

    try {
      if (editingId) {
        await updateRule.mutateAsync({
          id: editingId as any,
          name: form.name,
          daysOverdue: form.daysOverdue,
          subject: form.subject,
          body: form.body,
          includeInvoicePdf: form.includeInvoicePdf,
          isActive: form.isActive,
        });
        toast.success('Rule updated');
      } else {
        await createRule.mutateAsync({
          name: form.name,
          daysOverdue: form.daysOverdue,
          subject: form.subject,
          body: form.body,
          includeInvoicePdf: form.includeInvoicePdf,
          isActive: form.isActive,
        });
        toast.success('Rule created');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed');
    }
  };

  const seedDefaults = async () => {
    try {
      for (const rule of DEFAULT_RULES) {
        await createRule.mutateAsync({
          ...rule,
          isActive: true,
        } as any);
      }
      toast.success('Default rules created');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="size-5" />
            Reminder Rules
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automated reminders for overdue invoices.
          </p>
        </div>
        <div className="flex gap-2">
          {!rules?.length && (
            <Button variant="outline" size="sm" onClick={seedDefaults} disabled={createRule.isPending}>
              Load Defaults
            </Button>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !rules?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No reminder rules configured. Add rules or load defaults.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <Card key={rule._id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">{rule.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {rule.daysOverdue}d overdue
                    </Badge>
                    {rule.isActive === false && (
                      <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Subject:</p>
                  <p className="text-sm">{rule.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Body:</p>
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground mt-1 max-h-32 overflow-auto">
                    {rule.body}
                  </pre>
                </div>
                {rule.includeInvoicePdf && (
                  <Badge variant="secondary" className="text-[10px]">Includes Invoice PDF</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Rule' : 'New Reminder Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name *</Label>
              <Input
                placeholder="e.g. First Reminder"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Days Overdue *</Label>
              <Input
                type="number"
                min={0}
                value={form.daysOverdue}
                onChange={(e) => setForm({ ...form, daysOverdue: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Subject Template *</Label>
              <Input
                placeholder="e.g. Reminder: Invoice {invoice_number}"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div>
              <Label>Body Template * <span className="font-normal text-muted-foreground">(Markdown)</span></Label>
              <Textarea
                placeholder="Dear {customer_name}, ..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={6}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Variables: {'{customer_name}'}, {'{invoice_number}'}, {'{amount}'}, {'{due_date}'}, {'{days_overdue}'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.includeInvoicePdf}
                  onCheckedChange={(v) => setForm({ ...form, includeInvoicePdf: v })}
                  id="include-pdf"
                />
                <Label htmlFor="include-pdf" className="text-sm">Attach PDF</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  id="is-active"
                />
                <Label htmlFor="is-active" className="text-sm">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createRule.isPending || updateRule.isPending}>
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
