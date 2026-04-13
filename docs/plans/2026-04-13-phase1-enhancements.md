# Phase 1 Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CSV/Excel export, recurring invoices, and enhanced dashboard analytics — inspired by Midday and Odoo features.

**Architecture:** All three features are additive — no existing code is modified except extending existing pages with new buttons/sections. Export uses client-side CSV generation (no backend needed). Recurring invoices extend the existing subscription system. Dashboard analytics adds new Convex query endpoints and frontend chart components.

**Tech Stack:** Convex (convex-ents v0.16.0), Next.js, TypeScript, Recharts (already installed), Zod

**IMPORTANT convex-ents quirk:** In `.field()` chaining, must use `v.optional(v.string())` NOT `v.string().optional()`.

---

## Current State

- ✅ Kanban board for Deals — already exists (`deals-board.tsx`)
- ✅ SaleOrder → Invoice schema — `saleOrders.edges('invoices')` already in schema
- ✅ Dashboard charts — recharts already used
- ✅ Subscription templates — already exist
- ❌ CSV/Excel export — not implemented
- ❌ Recurring invoices — not implemented
- ❌ Dashboard analytics — basic stats only

---

### Task 1: CSV Export Utility

**Files:**
- Create: `apps/web/src/lib/export-csv.ts`
- Create: `apps/web/src/components/data-table-export-button.tsx`

**Step 1: Create CSV export utility**

Create `apps/web/src/lib/export-csv.ts`:

```typescript
/**
 * Convert an array of objects to CSV string.
 * Handles nested objects by flattening with dot notation.
 * Escapes commas, quotes, and newlines in values.
 */
export function toCSV<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; label: string }[],
): string {
  const header = columns.map((c) => escapeCSV(c.label)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = getNestedValue(row, col.key);
        return escapeCSV(formatValue(value));
      })
      .join(','),
  );
  return [header, ...rows].join('\n');
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCSV(value: string): string {
  if (!value) return '""';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

**Step 2: Create export button component**

Create `apps/web/src/components/data-table-export-button.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toCSV, downloadCSV } from '@/lib/export-csv';
import { toast } from 'sonner';

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  columns: { key: string; label: string }[];
  filename: string;
  disabled?: boolean;
}

export function DataTableExportButton<T extends Record<string, any>>({
  data,
  columns,
  filename,
  disabled,
}: ExportButtonProps<T>) {
  const handleExport = () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    try {
      const csv = toCSV(data, columns);
      downloadCSV(csv, filename);
      toast.success(`Exported ${data.length} rows`);
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={disabled || data.length === 0}>
      <Download className="mr-1 h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
```

**Step 3: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add apps/web/src/lib/export-csv.ts apps/web/src/components/data-table-export-button.tsx && git commit -m "feat(export): add CSV export utility and button component"
```

---

### Task 2: Add Export Buttons to List Pages

**Files:**
- Modify: `apps/web/src/app/(dashboard)/invoices/page.tsx` — add export button
- Modify: `apps/web/src/app/(dashboard)/subscriptions/page.tsx` — add export button
- Modify: `apps/web/src/app/(dashboard)/sales/page.tsx` — add export button (if exists)
- Modify: `apps/web/src/app/(dashboard)/contacts/page.tsx` — add export button (if exists)
- Modify: `apps/web/src/app/(dashboard)/companies/page.tsx` — add export button (if exists)

**Step 1: Add export to invoices page**

In `apps/web/src/app/(dashboard)/invoices/page.tsx`:

Add import:
```tsx
import { DataTableExportButton } from '@/components/data-table-export-button';
```

Add the export button next to existing action buttons (search, filter, etc.) in the page header:
```tsx
<DataTableExportButton
  data={invoices.map((inv: any) => ({
    number: inv.number,
    type: inv.type,
    state: inv.state,
    invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '',
    dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '',
    totalAmount: inv.totalAmount,
    amountDue: inv.amountDue,
    companyName: inv.company?.name ?? '',
    contactName: inv.contact?.name ?? '',
    paymentStatus: inv.paymentStatus ?? 'unpaid',
  }))}
  columns={[
    { key: 'number', label: 'Invoice No.' },
    { key: 'type', label: 'Type' },
    { key: 'state', label: 'Status' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'totalAmount', label: 'Total' },
    { key: 'amountDue', label: 'Amount Due' },
    { key: 'companyName', label: 'Company' },
    { key: 'contactName', label: 'Contact' },
    { key: 'paymentStatus', label: 'Payment' },
  ]}
  filename={`invoices-${new Date().toISOString().split('T')[0]}`}
/>
```

**Step 2: Add export to other list pages**

Follow the same pattern for subscriptions, contacts, companies, and sales pages. Adjust columns per entity.

For **subscriptions** page, columns: `customerName, templateName, status, amount, currency, nextBillingDate, createdAt`

For **contacts** page, columns: `name, email, phone, companyName, createdAt`

For **companies** page, columns: `name, email, phone, website, industry, createdAt`

**Step 3: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add apps/web/src/app/\(dashboard\)/ && git commit -m "feat(export): add CSV export buttons to list pages"
```

---

### Task 3: Recurring Invoice Schema & Backend

**Files:**
- Modify: `convex/schema.ts` — add `recurringInvoices` entity
- Create: `convex/recurringInvoices.ts` — CRUD + cron logic
- Modify: `convex/crons.ts` — add scheduled job (if crons file exists, otherwise create)

**Step 1: Add recurringInvoices entity to schema**

In `convex/schema.ts`, add after the `invoices` entity:

```typescript
    recurringInvoices: defineEnt({
      number: v.string(),
      name: v.optional(v.string()),
      status: v.union(
        v.literal('active'),
        v.literal('paused'),
        v.literal('expired'),
      ),
      frequency: v.union(
        v.literal('weekly'),
        v.literal('monthly'),
        v.literal('quarterly'),
        v.literal('yearly'),
      ),
      nextInvoiceDate: v.number(),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      maxOccurrences: v.optional(v.number()),
      occurredCount: v.number(),
      // Invoice template fields
      type: v.literal('customer_invoice'),
      subtotal: v.number(),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      totalAmount: v.number(),
      currency: v.optional(v.string()),
      notes: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      paymentTermId: v.optional(v.id('paymentTerms')),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .field('contactId', v.optional(v.id('contacts')))
      .field('ownerId', v.id('user'))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('contact', { to: 'contacts', field: 'contactId', optional: true })
      .edges('lines', { to: 'recurringInvoiceLines', ref: 'recurringInvoiceId' })
      .edges('generatedInvoices', { to: 'invoices', ref: 'recurringInvoiceId' })
      .index('organizationId_status', ['organizationId', 'status'])
      .index('organizationId_nextInvoiceDate', ['organizationId', 'nextInvoiceDate'])
      .index('nextInvoiceDate', ['nextInvoiceDate']),

    recurringInvoiceLines: defineEnt({
      productName: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('recurringInvoiceId', v.id('recurringInvoices'))
      .field('productId', v.optional(v.id('products')))
      .edge('recurringInvoice', { to: 'recurringInvoices', field: 'recurringInvoiceId' })
      .edge('product', { to: 'products', field: 'productId', optional: true }),
```

Also add to `invoices` entity — a back-reference field:
```typescript
// Add to invoices entity, after subscriptionTemplateId field:
recurringInvoiceId: v.optional(v.id('recurringInvoices')),
```

And add the edge:
```typescript
// Add to invoices entity edges:
.edge('recurringInvoice', { to: 'recurringInvoices', field: 'recurringInvoiceId', optional: true })
```

And add to user entity edges (add alongside existing edges):
```typescript
.edges('recurringInvoices', { ref: 'ownerId' })
```

**Step 2: Create recurringInvoices backend**

Create `convex/recurringInvoices.ts`:

```typescript
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgQuery, createOrgMutation, createInternalMutation } from './functions';
import type { Id } from './_generated/dataModel';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = createOrgQuery()({
  args: {},
  returns: z.array(z.object({
    _id: zid('recurringInvoices'),
    number: z.string(),
    name: z.string().nullable().optional(),
    status: z.string(),
    frequency: z.string(),
    nextInvoiceDate: z.number(),
    startDate: z.number(),
    endDate: z.number().nullable().optional(),
    occurredCount: z.number(),
    totalAmount: z.number(),
    currency: z.string().nullable().optional(),
    companyName: z.string().nullable(),
    contactName: z.string().nullable(),
  })),
  handler: async (ctx) => {
    const records = await ctx
      .table('recurringInvoices', 'organizationId_status', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(100);

    return Promise.all(
      records.map(async (r: any) => {
        const company = r.companyId ? await ctx.table('companies').get(r.companyId) : null;
        const contact = r.contactId ? await ctx.table('contacts').get(r.contactId) : null;
        return {
          _id: r._id as Id<'recurringInvoices'>,
          number: r.number,
          name: r.name ?? null,
          status: r.status,
          frequency: r.frequency,
          nextInvoiceDate: r.nextInvoiceDate,
          startDate: r.startDate,
          endDate: r.endDate ?? null,
          occurredCount: r.occurredCount,
          totalAmount: r.totalAmount,
          currency: r.currency ?? null,
          companyName: company?.name ?? null,
          contactName: contact?.name ?? null,
        };
      }),
    );
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = createOrgMutation()({
  args: {
    name: z.string().optional(),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    startDate: z.number(),
    endDate: z.number().optional(),
    maxOccurrences: z.number().optional(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    lines: z.array(z.object({
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number(),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      productId: zid('products').optional(),
    })),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    taxAmount: z.number().optional(),
    currency: z.string().optional(),
    paymentTermId: zid('paymentTerms').optional(),
  },
  returns: zid('recurringInvoices'),
  handler: async (ctx, args) => {
    const subtotal = args.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const totalAmount = subtotal - (args.discountAmount ?? 0) + (args.taxAmount ?? 0);

    // Calculate next invoice date (same as startDate initially)
    const nextInvoiceDate = args.startDate;

    // Generate a number
    const count = await ctx
      .table('recurringInvoices', 'organizationId_status', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(1000);
    const number = `RI-${String(count.length + 1).padStart(4, '0')}`;

    const id = await ctx.table('recurringInvoices').insert({
      number,
      name: args.name,
      status: 'active',
      frequency: args.frequency,
      nextInvoiceDate,
      startDate: args.startDate,
      endDate: args.endDate,
      maxOccurrences: args.maxOccurrences,
      occurredCount: 0,
      type: 'customer_invoice' as const,
      subtotal,
      discountAmount: args.discountAmount,
      discountType: args.discountType,
      taxAmount: args.taxAmount,
      totalAmount,
      currency: args.currency,
      notes: args.notes,
      internalNotes: args.internalNotes,
      paymentTermId: args.paymentTermId,
      organizationId: ctx.orgId,
      companyId: args.companyId,
      contactId: args.contactId,
      ownerId: ctx.user._id,
    });

    // Insert lines
    for (const line of args.lines) {
      await ctx.table('recurringInvoiceLines').insert({
        ...line,
        organizationId: ctx.orgId,
        recurringInvoiceId: id,
      });
    }

    return id;
  },
});

export const pause = createOrgMutation()({
  args: { id: zid('recurringInvoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const record = await ctx.table('recurringInvoices').get(args.id);
    if (!record || record.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Recurring invoice not found' });
    }
    await ctx.table('recurringInvoices').getX(args.id).patch({ status: 'paused' });
    return null;
  },
});

export const resume = createOrgMutation()({
  args: { id: zid('recurringInvoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const record = await ctx.table('recurringInvoices').get(args.id);
    if (!record || record.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Recurring invoice not found' });
    }
    await ctx.table('recurringInvoices').getX(args.id).patch({ status: 'active' });
    return null;
  },
});

export const cancel = createOrgMutation()({
  args: { id: zid('recurringInvoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const record = await ctx.table('recurringInvoices').get(args.id);
    if (!record || record.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Recurring invoice not found' });
    }
    await ctx.table('recurringInvoices').getX(args.id).patch({ status: 'expired' });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Cron: Generate invoices from recurring templates
// ---------------------------------------------------------------------------

export const processDueRecurringInvoices = createInternalMutation()({
  args: {},
  returns: z.object({ processed: z.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    // Find all active recurring invoices where nextInvoiceDate <= now
    const due = await ctx
      .table('recurringInvoices', 'nextInvoiceDate', (q: any) =>
        q.lte(now),
      )
      .take(100);

    let processed = 0;
    for (const ri of due) {
      if (ri.status !== 'active') continue;

      // Check max occurrences
      if (ri.maxOccurrences !== undefined && ri.occurredCount >= ri.maxOccurrences) {
        await ctx.table('recurringInvoices').getX(ri._id).patch({ status: 'expired' });
        continue;
      }

      // Check end date
      if (ri.endDate && ri.nextInvoiceDate > ri.endDate) {
        await ctx.table('recurringInvoices').getX(ri._id).patch({ status: 'expired' });
        continue;
      }

      // Copy lines
      const lines = await ctx
        .table('recurringInvoiceLines', 'recurringInvoiceId', (q: any) =>
          q.eq('recurringInvoiceId', ri._id),
        )
        .take(100);

      // Generate invoice number
      const existingInvoices = await ctx
        .table('invoices', 'organizationId_state', (q: any) =>
          q.eq('organizationId', ri.organizationId),
        )
        .take(1000);
      const invoiceNumber = `INV-${String(existingInvoices.length + 1).padStart(4, '0')}`;

      // Calculate due date (30 days from now)
      const dueDate = now + 30 * 24 * 60 * 60 * 1000;

      // Create invoice
      await ctx.table('invoices').insert({
        number: invoiceNumber,
        type: 'customer_invoice',
        state: 'draft',
        invoiceDate: now,
        dueDate,
        subtotal: ri.subtotal,
        discountAmount: ri.discountAmount,
        discountType: ri.discountType,
        taxAmount: ri.taxAmount,
        totalAmount: ri.totalAmount,
        amountDue: ri.totalAmount,
        currency: ri.currency,
        paymentTermId: ri.paymentTermId,
        source: 'manual' as const,
        notes: ri.notes,
        internalNotes: `Generated from recurring invoice ${ri.number}`,
        organizationId: ri.organizationId,
        companyId: ri.companyId,
        contactId: ri.contactId,
        ownerId: ri.ownerId,
        recurringInvoiceId: ri._id,
      });

      // Calculate next invoice date
      const nextDate = calculateNextDate(ri.nextInvoiceDate, ri.frequency);

      // Update recurring invoice
      await ctx.table('recurringInvoices').getX(ri._id).patch({
        nextInvoiceDate: nextDate,
        occurredCount: ri.occurredCount + 1,
      });

      processed++;
    }

    return { processed };
  },
});

function calculateNextDate(currentDate: number, frequency: string): number {
  const date = new Date(currentDate);
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date.getTime();
}
```

**Step 3: Create/update crons file**

Create `convex/crons.ts` (or update if exists):

```typescript
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Process recurring invoices daily at 2 AM UTC
crons.daily(
  'process-recurring-invoices',
  { hourUTC: 2, minuteUTC: 0 },
  internal.recurringInvoices.processDueRecurringInvoices,
  {},
);

export default crons;
```

Check if `convex/crons.ts` already exists — if it does, add the cron entry to the existing file instead.

**Step 4: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add convex/schema.ts convex/recurringInvoices.ts convex/crons.ts && git commit -m "feat(invoices): add recurring invoices with cron-based generation"
```

---

### Task 4: Recurring Invoices UI

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/recurring-invoices/page.tsx` — list page
- Create: `apps/web/src/components/recurring-invoice/create-dialog.tsx` — create form
- Modify: `apps/web/src/app/(dashboard)/settings/layout.tsx` — add tab

**Step 1: Add Recurring Invoices tab to settings**

In `apps/web/src/app/(dashboard)/settings/layout.tsx`, add to the `tabs` array:

```typescript
const tabs = [
  { title: 'General', href: '/settings/general', feature: 'settings' },
  { title: 'Team', href: '/settings/team', feature: 'team' },
  { title: 'Recurring Invoices', href: '/settings/recurring-invoices', feature: 'settings' },
  { title: 'Pricelists', href: '/settings/pricelists', feature: 'settings' },
  { title: 'Reminder Rules', href: '/settings/reminder-rules', feature: 'settings' },
];
```

**Step 2: Create recurring invoices list page**

Create `apps/web/src/app/(dashboard)/settings/recurring-invoices/page.tsx`:

```tsx
'use client';

import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pause, Play, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { CreateRecurringInvoiceDialog } from '@/components/recurring-invoice/create-dialog';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  expired: 'destructive',
};

export default function RecurringInvoicesPage() {
  const { data, isLoading } = useAuthQuery(api.recurringInvoices.list, {});
  const pauseMutation = useAuthMutation(api.recurringInvoices.pause);
  const resumeMutation = useAuthMutation(api.recurringInvoices.resume);
  const cancelMutation = useAuthMutation(api.recurringInvoices.cancel);
  const [showCreate, setShowCreate] = useState(false);

  const items = data ?? [];

  const handlePause = async (id: string) => {
    try {
      await pauseMutation.mutateAsync({ id: id as any });
      toast.success('Recurring invoice paused');
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Failed to pause');
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeMutation.mutateAsync({ id: id as any });
      toast.success('Recurring invoice resumed');
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Failed to resume');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this recurring invoice? No more invoices will be generated.')) return;
    try {
      await cancelMutation.mutateAsync({ id: id as any });
      toast.success('Recurring invoice cancelled');
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Failed to cancel');
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Recurring Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Automatically generate invoices on a schedule.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New Recurring Invoice
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No recurring invoices yet. Create one to automate billing.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item._id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.number}</span>
                    {item.name && <span className="text-muted-foreground">— {item.name}</span>}
                    <Badge variant={STATUS_VARIANTS[item.status] ?? 'outline'}>
                      {item.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                    </span>
                    <span>
                      Next: {new Date(item.nextInvoiceDate).toLocaleDateString()}
                    </span>
                    <span>
                      Generated: {item.occurredCount}
                      {item.endDate ? '' : ' (ongoing)'}
                    </span>
                    {(item.companyName || item.contactName) && (
                      <span>
                        → {item.companyName ?? item.contactName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold">
                    {item.currency?.toUpperCase() ?? ''} {item.totalAmount.toLocaleString()}
                  </span>
                  <div className="flex gap-1">
                    {item.status === 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => handlePause(item._id)}>
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {item.status === 'paused' && (
                      <Button variant="ghost" size="sm" onClick={() => handleResume(item._id)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {item.status !== 'expired' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleCancel(item._id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateRecurringInvoiceDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
```

**Step 3: Create the create dialog**

Create `apps/web/src/components/recurring-invoice/create-dialog.tsx` — a dialog with:
- Company/Contact select
- Frequency select (weekly/monthly/quarterly/yearly)
- Start date picker
- Optional end date / max occurrences
- Line items (product name, qty, unit price) — dynamic add/remove rows
- Notes

This is a longer component. Use existing patterns from `create-deal-dialog.tsx` or other create dialogs in the codebase. The key mutation call:

```tsx
const createRI = useAuthMutation(api.recurringInvoices.create);
await createRI.mutateAsync({
  name,
  frequency,
  startDate: startDate.getTime(),
  endDate: endDate?.getTime(),
  maxOccurrences,
  companyId,
  contactId,
  lines: lineItems.map(l => ({
    productName: l.productName,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
  })),
  notes,
  currency: user?.activeOrganization?.currency,
});
```

**Step 4: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add apps/web/src/ && git commit -m "feat(invoices): add recurring invoices management UI"
```

---

### Task 5: Dashboard Analytics Enhancement

**Files:**
- Create: `convex/analytics.ts` — analytics query endpoints
- Modify: `apps/web/src/app/(dashboard)/page.tsx` — add analytics cards + charts

**Step 1: Create analytics backend**

Create `convex/analytics.ts`:

```typescript
import { z } from 'zod';
import { createOrgQuery } from './functions';

export const getOverview = createOrgQuery()({
  args: {},
  returns: z.object({
    totalRevenue: z.number(),
    outstandingAmount: z.number(),
    overdueAmount: z.number(),
    activeDeals: z.number(),
    wonDeals: z.number(),
    totalContacts: z.number(),
    totalCompanies: z.number(),
    conversionRate: z.number(),
  }),
  handler: async (ctx) => {
    // Count deals
    const allDeals = await ctx
      .table('deals', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(1000);

    const activeDeals = allDeals.filter((d: any) =>
      ['new', 'prospect', 'proposal', 'negotiation'].includes(d.stage),
    ).length;
    const wonDeals = allDeals.filter((d: any) => d.stage === 'won').length;
    const totalDeals = allDeals.length;
    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

    // Revenue from paid invoices
    const paidInvoices = await ctx
      .table('invoices', 'organizationId_state', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('state', 'paid'),
      )
      .take(1000);
    const totalRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);

    // Outstanding (posted but unpaid)
    const postedInvoices = await ctx
      .table('invoices', 'organizationId_state', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('state', 'posted'),
      )
      .take(1000);
    const outstandingAmount = postedInvoices.reduce(
      (sum: number, inv: any) => sum + inv.amountDue,
      0,
    );

    // Overdue (posted, dueDate < now)
    const now = Date.now();
    const overdueAmount = postedInvoices
      .filter((inv: any) => inv.dueDate < now)
      .reduce((sum: number, inv: any) => sum + inv.amountDue, 0);

    // Contacts & companies count
    const contacts = await ctx
      .table('contacts', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(1000);
    const companies = await ctx
      .table('companies', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(1000);

    return {
      totalRevenue,
      outstandingAmount,
      overdueAmount,
      activeDeals,
      wonDeals,
      totalContacts: contacts.length,
      totalCompanies: companies.length,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  },
});

export const getRevenueByMonth = createOrgQuery()({
  args: {},
  returns: z.array(z.object({
    month: z.string(),
    revenue: z.number(),
    invoices: z.number(),
  })),
  handler: async (ctx) => {
    const invoices = await ctx
      .table('invoices', 'organizationId_state', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('state', 'paid'),
      )
      .take(1000);

    // Group by month
    const byMonth = new Map<string, { revenue: number; invoices: number }>();
    for (const inv of invoices) {
      const date = new Date((inv as any).invoiceDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = byMonth.get(key) ?? { revenue: 0, invoices: 0 };
      existing.revenue += (inv as any).totalAmount;
      existing.invoices += 1;
      byMonth.set(key, existing);
    }

    // Sort by month and return last 12
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({ month, ...data }));
  },
});

export const getDealPipeline = createOrgQuery()({
  args: {},
  returns: z.array(z.object({
    stage: z.string(),
    count: z.number(),
    value: z.number(),
  })),
  handler: async (ctx) => {
    const deals = await ctx
      .table('deals', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(1000);

    const byStage = new Map<string, { count: number; value: number }>();
    for (const deal of deals) {
      const stage = (deal as any).stage ?? 'unknown';
      const existing = byStage.get(stage) ?? { count: 0, value: 0 };
      existing.count += 1;
      existing.value += (deal as any).amount ?? 0;
      byStage.set(stage, existing);
    }

    return Array.from(byStage.entries()).map(([stage, data]) => ({
      stage,
      ...data,
    }));
  },
});
```

**Step 2: Enhance dashboard page**

In `apps/web/src/app/(dashboard)/page.tsx`, add the analytics cards at the top of the dashboard:

Import the new queries:
```tsx
import { api } from '@convex/_generated/api';
import { useAuthQuery } from '@/lib/convex/hooks';
```

Add analytics section with 4 KPI cards:
- **Total Revenue** — with trend indicator
- **Outstanding** — amount due from posted invoices
- **Overdue** — red highlight if > 0
- **Deal Conversion** — won / total percentage

Add revenue chart (monthly bar chart, last 12 months) using existing recharts setup.

Add deal pipeline summary (horizontal bar or funnel chart).

The dashboard already has 622 lines with charts — so the enhancement is about adding new data sources and cards, not rebuilding the entire page.

**Step 3: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add convex/analytics.ts apps/web/src/app/\(dashboard\)/page.tsx && git commit -m "feat(analytics): add dashboard analytics with revenue, pipeline, and KPI cards"
```

---

### Task 6: Verification Pass

**Step 1: Run full typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 2: Run lint**

Run: `cd /Users/madearga/Desktop/crm && pnpm lint`
Expected: PASS

**Step 3: Deploy and verify**

Run: `cd /Users/madearga/Desktop/crm && npx convex dev --once`
Expected: All functions registered

**Step 4: Push**

```bash
cd /Users/madearga/Desktop/crm && git push
```

---

## Summary

| Task | Feature | Files | Complexity |
|------|---------|-------|------------|
| 1 | CSV Export Utility | 2 new files | Low |
| 2 | Export Buttons on List Pages | 3-5 modified files | Low |
| 3 | Recurring Invoices Backend | 2-3 new/modified files | Medium |
| 4 | Recurring Invoices UI | 2-3 new files | Medium |
| 5 | Dashboard Analytics | 1 new + 1 modified file | Medium |
| 6 | Verification | — | Low |
