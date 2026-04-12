# Invoicing & Billing Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Invoicing & Billing module — create invoices (manual or from Sale Order), register payments, track overdue, manage taxes & payment terms. Enables the full Sales → Invoice → Payment → Reconciled workflow.

**Architecture:** Follow existing patterns from `saleOrders.ts` and `products.ts` — use `createOrgMutation`, `createOrgQuery`, `createOrgPaginatedQuery` from `convex/functions.ts`. Schema uses `convex-ents` with `defineEnt`. Frontend reuses same pattern as Sales: data-table with memoized cells, form components, nuqs for URL state. Sequence generator already supports `invoice` prefix (`INV-2026-0001`).

**Tech Stack:** Convex (convex-ents, convex-helpers/zod), Next.js App Router, TanStack Table, shadcn/ui, nuqs, sonner for toasts, lucide icons.

---

## Task 1: Schema — Add invoices, invoiceLines, payments, taxes, paymentTerms tables

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add 5 new tables to schema**

Add after `saleOrderLines` definition in `convex/schema.ts`:

```ts
    // --------------------
    // Invoicing & Billing (Module 3)
    // --------------------

    invoices: defineEnt({
      number: v.string(),                          // "INV-2026-0001"
      type: v.union(
        v.literal('customer_invoice'),              // Tagih customer
        v.literal('vendor_bill'),                   // Tagihan dari supplier
        v.literal('credit_note'),                   // Refund
      ),
      state: v.union(
        v.literal('draft'),
        v.literal('posted'),                        // Sudah diposting
        v.literal('paid'),                          // Sudah dibayar full
        v.literal('cancel'),
      ),
      invoiceDate: v.number(),
      dueDate: v.number(),
      // Amounts
      subtotal: v.number(),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      totalAmount: v.number(),
      amountDue: v.number(),                        // Sisa yang belum dibayar
      currency: v.optional(v.string()),
      // Payment
      paymentStatus: v.optional(v.union(
        v.literal('unpaid'),
        v.literal('partially_paid'),
        v.literal('paid'),
      )),
      paymentTermId: v.optional(v.id('paymentTerms')),
      // Reference
      source: v.optional(v.union(
        v.literal('sale_order'),
        v.literal('manual'),
      )),
      saleOrderId: v.optional(v.id('saleOrders')),
      // Notes
      notes: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .field('contactId', v.optional(v.id('contacts')))
      .field('ownerId', v.id('user'))
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('contact', { to: 'contacts', field: 'contactId', optional: true })
      .edge('saleOrder', { to: 'saleOrders', field: 'saleOrderId', optional: true })
      .edges('lines', { to: 'invoiceLines', ref: 'invoiceId' })
      .edges('payments', { to: 'payments', ref: 'invoiceId' })
      .index('organizationId_state', ['organizationId', 'state'])
      .index('organizationId_type', ['organizationId', 'type'])
      .index('organizationId_companyId', ['organizationId', 'companyId'])
      .index('organizationId_invoiceDate', ['organizationId', 'invoiceDate'])
      .index('organizationId_dueDate', ['organizationId', 'dueDate'])
      .searchIndex('search_invoices', {
        searchField: 'number',
        filterFields: ['organizationId', 'state', 'type'],
      }),

    invoiceLines: defineEnt({
      productName: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      subtotal: v.number(),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('invoiceId', v.id('invoices'))
      .field('productId', v.optional(v.id('products')))
      .field('taxId', v.optional(v.id('taxes')))
      .edge('invoice', { to: 'invoices', field: 'invoiceId' })
      .index('organizationId_invoiceId', ['organizationId', 'invoiceId']),

    payments: defineEnt({
      amount: v.number(),
      paymentDate: v.number(),
      method: v.union(
        v.literal('bank_transfer'),
        v.literal('cash'),
        v.literal('credit_card'),
        v.literal('debit_card'),
        v.literal('e_wallet'),
        v.literal('cheque'),
        v.literal('other'),
      ),
      reference: v.optional(v.string()),
      memo: v.optional(v.string()),
      state: v.union(
        v.literal('draft'),
        v.literal('confirmed'),
        v.literal('cancelled'),
      ),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('invoiceId', v.optional(v.id('invoices')))
      .field('companyId', v.optional(v.id('companies')))
      .field('ownerId', v.id('user'))
      .edge('invoice', { to: 'invoices', field: 'invoiceId', optional: true })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .index('organizationId_paymentDate', ['organizationId', 'paymentDate'])
      .index('organizationId_invoiceId', ['organizationId', 'invoiceId']),

    taxes: defineEnt({
      name: v.string(),                             // "PPN 11%"
      rate: v.number(),                             // 0.11
      type: v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      ),
      scope: v.union(
        v.literal('sales'),
        v.literal('purchase'),
        v.literal('both'),
      ),
      active: v.optional(v.boolean()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_scope', ['organizationId', 'scope']),

    paymentTerms: defineEnt({
      name: v.string(),                             // "Net 30"
      description: v.optional(v.string()),
      dueDays: v.number(),                          // Days from invoice date
      discountDays: v.optional(v.number()),         // Early payment discount period
      discountPercent: v.optional(v.number()),       // Early payment discount %
    })
      .field('organizationId', v.id('organization'), { index: true }),
```

**Step 2: Verify Convex picks up schema**

Run: `npx convex dev --typecheck=disable` (or wait for running dev server to detect changes)

Expected: Schema deployed successfully, no errors in Convex dashboard.

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(invoicing): add invoices, invoiceLines, payments, taxes, paymentTerms schema"
```

---

## Task 2: Backend — Taxes & Payment Terms CRUD

**Files:**
- Create: `convex/taxes.ts`
- Create: `convex/paymentTerms.ts`

**Step 1: Create `convex/taxes.ts`**

```ts
import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
  createOrgQuery,
} from './functions';

const taxSchema = z.object({
  name: z.string().min(1),
  rate: z.number().min(0),
  type: z.enum(['percentage', 'fixed']),
  scope: z.enum(['sales', 'purchase', 'both']),
  active: z.boolean().optional().default(true),
});

export const list = createOrgPaginatedQuery()({
  args: {
    scope: z.enum(['sales', 'purchase', 'both']).optional(),
    search: z.string().optional(),
  },
  returns: z.object({
    page: z.array(z.object({
      id: zid('taxes'),
      name: z.string(),
      rate: z.number(),
      type: z.enum(['percentage', 'fixed']),
      scope: z.enum(['sales', 'purchase', 'both']),
      active: z.boolean().optional(),
    })),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    let q = ctx.table('taxes', 'organizationId_scope', (q) =>
      q.eq('organizationId', ctx.orgId)
    );

    const all = await q;
    let results = all.filter((t: any) => {
      if (args.scope && t.scope !== args.scope && t.scope !== 'both') return false;
      if (args.search && !t.name.toLowerCase().includes(args.search.toLowerCase())) return false;
      return true;
    });

    return {
      page: results.map((t: any) => ({
        id: t._id,
        name: t.name,
        rate: t.rate,
        type: t.type,
        scope: t.scope,
        active: t.active,
      })),
      continueCursor: '',
      isDone: true,
    };
  },
});

export const create = createOrgMutation()({
  args: taxSchema,
  returns: zid('taxes'),
  handler: async (ctx, args) => {
    return ctx.table('taxes').insert({
      ...args,
      organizationId: ctx.orgId,
    });
  },
});

export const update = createOrgMutation()({
  args: {
    id: zid('taxes'),
    ...taxSchema.partial(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.table('taxes').getX(id).patch(updates);
    return null;
  },
});

export const remove = createOrgMutation()({
  args: { id: zid('taxes') },
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.table('taxes').getX(args.id).delete();
    return null;
  },
});
```

**Step 2: Create `convex/paymentTerms.ts`**

```ts
import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
} from './functions';

const paymentTermSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  dueDays: z.number().int().min(0),
  discountDays: z.number().int().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});

export const list = createOrgPaginatedQuery()({
  args: { search: z.string().optional() },
  returns: z.object({
    page: z.array(z.object({
      id: zid('paymentTerms'),
      name: z.string(),
      description: z.string().optional(),
      dueDays: z.number(),
      discountDays: z.number().optional(),
      discountPercent: z.number().optional(),
    })),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const all = await ctx.table('paymentTerms').take(100);
    let results = all.filter((pt: any) => {
      if (args.search && !pt.name.toLowerCase().includes(args.search.toLowerCase())) return false;
      return true;
    });

    return {
      page: results.map((pt: any) => ({
        id: pt._id,
        name: pt.name,
        description: pt.description,
        dueDays: pt.dueDays,
        discountDays: pt.discountDays,
        discountPercent: pt.discountPercent,
      })),
      continueCursor: '',
      isDone: true,
    };
  },
});

export const create = createOrgMutation()({
  args: paymentTermSchema,
  returns: zid('paymentTerms'),
  handler: async (ctx, args) => {
    return ctx.table('paymentTerms').insert({
      ...args,
      organizationId: ctx.orgId,
    });
  },
});

export const update = createOrgMutation()({
  args: {
    id: zid('paymentTerms'),
    ...paymentTermSchema.partial(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.table('paymentTerms').getX(id).patch(updates);
    return null;
  },
});

export const remove = createOrgMutation()({
  args: { id: zid('paymentTerms') },
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.table('paymentTerms').getX(args.id).delete();
    return null;
  },
});
```

**Step 3: Commit**

```bash
git add convex/taxes.ts convex/paymentTerms.ts
git commit -m "feat(invoicing): add taxes and payment terms CRUD"
```

---

## Task 3: Backend — Invoice CRUD & Workflow

**Files:**
- Create: `convex/invoices.ts`

**Step 1: Create `convex/invoices.ts`**

Follow exact same pattern as `convex/saleOrders.ts`. Key functions:

```ts
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
  createOrgQuery,
} from './functions';
import { createAuditLog } from './auditLogs';
import { nextSequence } from './shared/sequenceGenerator';

// Enums
const typeEnum = z.enum(['customer_invoice', 'vendor_bill', 'credit_note']);
const stateEnum = z.enum(['draft', 'posted', 'paid', 'cancel']);
const paymentStatusEnum = z.enum(['unpaid', 'partially_paid', 'paid']);

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['posted', 'cancel'],
  posted: ['paid', 'cancel'],
  paid: [],
  cancel: [],
};

// Helper: calculate line subtotal
function calculateLineSubtotal(line: {
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  taxAmount?: number;
}): number {
  let subtotal = line.quantity * line.unitPrice;
  if (line.discount) {
    if (line.discountType === 'percentage') subtotal -= subtotal * (line.discount / 100);
    else subtotal -= line.discount;
  }
  if (line.taxAmount) subtotal += line.taxAmount;
  return Math.round(subtotal * 100) / 100;
}

// Line schema for args
const lineArgsSchema = z.object({
  productName: z.string(),
  description: z.string().optional(),
  quantity: z.number().min(0.01),
  unitPrice: z.number(),
  discount: z.number().min(0).optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  taxAmount: z.number().min(0).optional(),
  productId: zid('products').optional(),
  taxId: zid('taxes').optional(),
});

// CREATE
export const create = createOrgMutation()({
  args: {
    type: typeEnum,
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    invoiceDate: z.number(),
    dueDate: z.number(),
    currency: z.string().optional(),
    paymentTermId: zid('paymentTerms').optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    lines: z.array(lineArgsSchema).min(1),
  },
  returns: zid('invoices'),
  handler: async (ctx, args) => {
    const number = await nextSequence(ctx, ctx.orgId, 'invoice', args.invoiceDate);

    const lineSubtotals = args.lines.map((line) => ({
      ...line,
      subtotal: calculateLineSubtotal(line),
    }));

    const subtotal = lineSubtotals.reduce((sum, l) => sum + l.subtotal, 0);

    let discountTotal = 0;
    if (args.discountAmount) {
      if (args.discountType === 'percentage') {
        discountTotal = subtotal * (args.discountAmount / 100);
      } else {
        discountTotal = args.discountAmount;
      }
    }

    const taxAmount = lineSubtotals.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);
    const totalAmount = Math.round((subtotal - discountTotal + taxAmount) * 100) / 100;

    const invId = await ctx.table('invoices').insert({
      number,
      type: args.type,
      state: 'draft',
      invoiceDate: args.invoiceDate,
      dueDate: args.dueDate,
      subtotal,
      discountAmount: args.discountAmount,
      discountType: args.discountType,
      taxAmount,
      totalAmount,
      amountDue: totalAmount,
      currency: args.currency,
      paymentStatus: 'unpaid',
      paymentTermId: args.paymentTermId,
      source: 'manual',
      notes: args.notes,
      internalNotes: args.internalNotes,
      companyId: args.companyId,
      contactId: args.contactId,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of lineSubtotals) {
      await ctx.table('invoiceLines').insert({
        ...line,
        invoiceId: invId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      action: 'invoice.created',
      entityType: 'invoice',
      entityId: invId,
      metadata: { number, type: args.type, totalAmount },
    });

    return invId;
  },
});

// CREATE FROM SALE ORDER
export const createFromSaleOrder = createOrgMutation()({
  args: {
    saleOrderId: zid('saleOrders'),
  },
  returns: zid('invoices'),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').getX(args.saleOrderId);

    // Only allow from confirmed/invoiced/delivered SOs
    if (!['confirmed', 'invoiced', 'delivered', 'done'].includes(so.state)) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot invoice a sale order in '${so.state}' state`,
      });
    }

    // Get SO lines
    const soLines = await so.edges.lines;

    const number = await nextSequence(ctx, ctx.orgId, 'invoice', Date.now());

    // Calculate due date (default: 30 days from now)
    const dueDate = Date.now() + 30 * 24 * 60 * 60 * 1000;

    const lineSubtotals = soLines.map((l: any) => ({
      productName: l.productName,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      discountType: l.discountType,
      taxAmount: l.taxAmount,
      subtotal: l.subtotal,
      productId: l.productId,
    }));

    const subtotal = lineSubtotals.reduce((sum: number, l: any) => sum + l.subtotal, 0);
    const taxAmount = lineSubtotals.reduce((sum: number, l: any) => sum + (l.taxAmount ?? 0), 0);
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const invId = await ctx.table('invoices').insert({
      number,
      type: 'customer_invoice',
      state: 'draft',
      invoiceDate: Date.now(),
      dueDate,
      subtotal,
      taxAmount,
      totalAmount,
      amountDue: totalAmount,
      currency: so.currency,
      paymentStatus: 'unpaid',
      source: 'sale_order',
      saleOrderId: args.saleOrderId,
      companyId: so.companyId,
      contactId: so.contactId,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of lineSubtotals) {
      await ctx.table('invoiceLines').insert({
        ...line,
        invoiceId: invId,
        organizationId: ctx.orgId,
      });
    }

    // Update SO invoice status
    const currentStatus = so.invoiceStatus;
    await so.patch({
      invoiceStatus: currentStatus === 'to_invoice' ? 'partially' : 'partially',
    });

    await createAuditLog(ctx, {
      action: 'invoice.created_from_sale_order',
      entityType: 'invoice',
      entityId: invId,
      metadata: { number, saleOrderId: args.saleOrderId, totalAmount },
    });

    return invId;
  },
});

// LIST
export const list = createOrgPaginatedQuery()({
  args: {
    type: typeEnum.optional(),
    state: stateEnum.optional(),
    companyId: zid('companies').optional(),
    search: z.string().optional(),
    includeArchived: z.boolean().optional(),
  },
  returns: z.object({
    page: z.array(z.object({
      id: zid('invoices'),
      number: z.string(),
      type: typeEnum,
      state: stateEnum,
      invoiceDate: z.number(),
      dueDate: z.number(),
      totalAmount: z.number(),
      amountDue: z.number(),
      currency: z.string().optional(),
      paymentStatus: paymentStatusEnum.optional(),
      companyId: zid('companies').optional(),
      contactId: zid('contacts').optional(),
      saleOrderId: zid('saleOrders').optional(),
      organizationId: zid('organization'),
      ownerId: zid('user'),
      archivedAt: z.number().optional(),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
    })),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    let q = ctx.table('invoices', 'organizationId_state', (q) =>
      q.eq('organizationId', orgId)
    );

    const all = await q;
    let results = all.filter((inv: any) => {
      if (args.type && inv.type !== args.type) return false;
      if (args.state && inv.state !== args.state) return false;
      if (args.companyId && inv.companyId !== args.companyId) return false;
      if (!args.includeArchived && inv.archivedAt) return false;
      if (args.search && !inv.number.toLowerCase().includes(args.search.toLowerCase())) return false;
      return true;
    });

    // Resolve company/contact names (batch with Promise.all)
    const enriched = await Promise.all(
      results.map(async (inv: any) => {
        let companyName: string | undefined;
        let contactName: string | undefined;

        if (inv.companyId) {
          try {
            const company = await ctx.table('companies').get(inv.companyId);
            companyName = company?.name;
          } catch {}
        }

        if (inv.contactId) {
          try {
            const contact = await ctx.table('contacts').get(inv.contactId);
            contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') : undefined;
          } catch {}
        }

        return {
          id: inv._id,
          number: inv.number,
          type: inv.type,
          state: inv.state,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          totalAmount: inv.totalAmount,
          amountDue: inv.amountDue,
          currency: inv.currency,
          paymentStatus: inv.paymentStatus,
          companyId: inv.companyId,
          contactId: inv.contactId,
          saleOrderId: inv.saleOrderId,
          organizationId: inv.organizationId,
          ownerId: inv.ownerId,
          archivedAt: inv.archivedAt,
          companyName,
          contactName,
        };
      })
    );

    // Sort by invoiceDate desc
    enriched.sort((a, b) => b.invoiceDate - a.invoiceDate);

    return {
      page: enriched,
      continueCursor: '',
      isDone: true,
    };
  },
});

// GET BY ID
export const getById = createOrgQuery()({
  args: { id: zid('invoices') },
  returns: z.any(),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);

    const lines = await Promise.all(
      (await inv.edges.lines).map(async (l: any) => ({
        id: l._id,
        productName: l.productName,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        taxAmount: l.taxAmount,
        subtotal: l.subtotal,
        productId: l.productId,
        taxId: l.taxId,
      }))
    );

    const payments = await Promise.all(
      (await inv.edges.payments).map(async (p: any) => ({
        id: p._id,
        amount: p.amount,
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
        memo: p.memo,
        state: p.state,
      }))
    );

    let companyName: string | undefined;
    let contactName: string | undefined;

    if (inv.companyId) {
      try {
        const company = await ctx.table('companies').get(inv.companyId);
        companyName = company?.name;
      } catch {}
    }

    if (inv.contactId) {
      try {
        const contact = await ctx.table('contacts').get(inv.contactId);
        contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') : undefined;
      } catch {}
    }

    return {
      id: inv._id,
      number: inv.number,
      type: inv.type,
      state: inv.state,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      subtotal: inv.subtotal,
      discountAmount: inv.discountAmount,
      discountType: inv.discountType,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount,
      amountDue: inv.amountDue,
      currency: inv.currency,
      paymentStatus: inv.paymentStatus,
      paymentTermId: inv.paymentTermId,
      source: inv.source,
      saleOrderId: inv.saleOrderId,
      notes: inv.notes,
      internalNotes: inv.internalNotes,
      archivedAt: inv.archivedAt,
      companyId: inv.companyId,
      contactId: inv.contactId,
      companyName,
      contactName,
      lines,
      payments,
    };
  },
});

// POST (draft → posted)
export const post = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);
    if (!VALID_TRANSITIONS[inv.state]?.includes('posted')) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot post invoice in '${inv.state}' state`,
      });
    }

    await inv.patch({ state: 'posted' });

    await createAuditLog(ctx, {
      action: 'invoice.posted',
      entityType: 'invoice',
      entityId: args.id,
      metadata: { number: inv.number },
    });

    return null;
  },
});

// CANCEL
export const cancel = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);
    if (!VALID_TRANSITIONS[inv.state]?.includes('cancel')) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot cancel invoice in '${inv.state}' state`,
      });
    }

    await inv.patch({ state: 'cancel' });

    await createAuditLog(ctx, {
      action: 'invoice.cancelled',
      entityType: 'invoice',
      entityId: args.id,
      metadata: { number: inv.number },
    });

    return null;
  },
});

// ADD PAYMENT
export const addPayment = createOrgMutation()({
  args: {
    invoiceId: zid('invoices'),
    amount: z.number().min(0.01),
    paymentDate: z.number(),
    method: z.enum(['bank_transfer', 'cash', 'credit_card', 'debit_card', 'e_wallet', 'cheque', 'other']),
    reference: z.string().optional(),
    memo: z.string().optional(),
  },
  returns: zid('payments'),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.invoiceId);

    if (inv.state !== 'posted' && inv.state !== 'draft') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot add payment to invoice in '${inv.state}' state`,
      });
    }

    // Prevent over-payment
    if (args.amount > inv.amountDue) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Payment amount (${args.amount}) exceeds amount due (${inv.amountDue})`,
      });
    }

    // Create payment
    const paymentId = await ctx.table('payments').insert({
      amount: args.amount,
      paymentDate: args.paymentDate,
      method: args.method,
      reference: args.reference,
      memo: args.memo,
      state: 'confirmed',
      invoiceId: args.invoiceId,
      companyId: inv.companyId,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    // Update invoice
    const newAmountDue = Math.round((inv.amountDue - args.amount) * 100) / 100;
    const newPaymentStatus = newAmountDue <= 0 ? 'paid' : 'partially_paid';
    const newState = newAmountDue <= 0 ? 'paid' : inv.state === 'draft' ? 'posted' : inv.state;

    await inv.patch({
      amountDue: newAmountDue,
      paymentStatus: newPaymentStatus,
      state: newState,
    });

    await createAuditLog(ctx, {
      action: 'invoice.payment_added',
      entityType: 'invoice',
      entityId: args.invoiceId,
      metadata: { number: inv.number, amount: args.amount, method: args.method },
    });

    return paymentId;
  },
});

// ARCHIVE / UNARCHIVE
export const archive = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.table('invoices').getX(args.id).patch({ archivedAt: Date.now() });
    return null;
  },
});

export const unarchive = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.table('invoices').getX(args.id).patch({ archivedAt: undefined });
    return null;
  },
});
```

**Step 2: Commit**

```bash
git add convex/invoices.ts
git commit -m "feat(invoicing): add invoice CRUD, workflow, payment registration"
```

---

## Task 4: Backend — Payments CRUD

**Files:**
- Create: `convex/payments.ts`

**Step 1: Create `convex/payments.ts`**

```ts
import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
} from './functions';

export const list = createOrgPaginatedQuery()({
  args: {
    companyId: zid('companies').optional(),
    method: z.enum(['bank_transfer', 'cash', 'credit_card', 'debit_card', 'e_wallet', 'cheque', 'other']).optional(),
    search: z.string().optional(),
  },
  returns: z.object({
    page: z.array(z.object({
      id: zid('payments'),
      amount: z.number(),
      paymentDate: z.number(),
      method: z.enum(['bank_transfer', 'cash', 'credit_card', 'debit_card', 'e_wallet', 'cheque', 'other']),
      reference: z.string().optional(),
      memo: z.string().optional(),
      state: z.enum(['draft', 'confirmed', 'cancelled']),
      invoiceId: zid('invoices').optional(),
      companyId: zid('companies').optional(),
      companyName: z.string().optional(),
    })),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const all = await ctx.table('payments', 'organizationId_paymentDate', (q) =>
      q.eq('organizationId', ctx.orgId)
    );

    let results = all.filter((p: any) => {
      if (args.companyId && p.companyId !== args.companyId) return false;
      if (args.method && p.method !== args.method) return false;
      if (args.search && !(p.reference?.toLowerCase().includes(args.search.toLowerCase()))) return false;
      return true;
    });

    const enriched = await Promise.all(
      results.map(async (p: any) => {
        let companyName: string | undefined;
        if (p.companyId) {
          try {
            const company = await ctx.table('companies').get(p.companyId);
            companyName = company?.name;
          } catch {}
        }
        return {
          id: p._id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          method: p.method,
          reference: p.reference,
          memo: p.memo,
          state: p.state,
          invoiceId: p.invoiceId,
          companyId: p.companyId,
          companyName,
        };
      })
    );

    enriched.sort((a, b) => b.paymentDate - a.paymentDate);

    return { page: enriched, continueCursor: '', isDone: true };
  },
});

export const create = createOrgMutation()({
  args: {
    amount: z.number().min(0.01),
    paymentDate: z.number(),
    method: z.enum(['bank_transfer', 'cash', 'credit_card', 'debit_card', 'e_wallet', 'cheque', 'other']),
    reference: z.string().optional(),
    memo: z.string().optional(),
    invoiceId: zid('invoices').optional(),
    companyId: zid('companies').optional(),
  },
  returns: zid('payments'),
  handler: async (ctx, args) => {
    return ctx.table('payments').insert({
      ...args,
      state: 'confirmed',
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });
  },
});

export const cancel = createOrgMutation()({
  args: { id: zid('payments') },
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.table('payments').getX(args.id).patch({ state: 'cancelled' });
    return null;
  },
});
```

**Step 2: Commit**

```bash
git add convex/payments.ts
git commit -m "feat(invoicing): add payments list and CRUD"
```

---

## Task 5: Backend — Update Sale Order integration (Create Invoice from SO)

**Files:**
- Modify: `convex/saleOrders.ts`

**Step 1: Add "Create Invoice" action to Sale Order detail**

Already handled by `invoices.createFromSaleOrder`. We need to ensure the SO detail page has the button (frontend Task 8).

No backend changes needed here — `invoices.createFromSaleOrder` already updates `so.invoiceStatus`.

**Step 2: Commit (skip if no changes)**

---

## Task 6: Frontend — Invoice List Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/invoices/page.tsx`
- Create: `apps/web/src/app/(dashboard)/invoices/columns.tsx`
- Create: `apps/web/src/hooks/use-invoices-params.ts`

**Step 1: Create URL params hook**

Create `apps/web/src/hooks/use-invoices-params.ts` — follow exact pattern from `use-sales-params.ts`:

```ts
import { useQueryState } from 'nuqs';

export function useInvoicesParams() {
  const [q, setSearch] = useQueryState('q', { defaultValue: '' });
  const [archived, setArchived] = useQueryState('archived', {
    defaultValue: false,
    parse: (v) => v === 'true',
    serialize: (v) => String(v),
  });
  const toggleArchived = () => setArchived(!archived);
  return { q, archived, setSearch, toggleArchived };
}
```

**Step 2: Create columns**

Create `apps/web/src/app/(dashboard)/invoices/columns.tsx` — follow pattern from `sales/columns.tsx`. Include columns for: checkbox, number, type badge, company/contact, invoice date, due date (with overdue indicator), total amount, payment status badge, state badge, row actions (post, cancel, archive).

**Step 3: Create list page**

Create `apps/web/src/app/(dashboard)/invoices/page.tsx` — follow pattern from `sales/page.tsx`. Filters: search, type (customer_invoice/vendor_bill/credit_note), state (draft/posted/paid/cancel), archived toggle. Button: "New Invoice".

**Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat(invoicing): add invoice list page with filters and columns"
```

---

## Task 7: Frontend — Invoice Form (Create/Edit)

**Files:**
- Create: `apps/web/src/app/(dashboard)/invoices/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/invoices/[id]/edit/page.tsx`
- Create: `apps/web/src/components/invoices/invoice-form.tsx`
- Create: `apps/web/src/components/invoices/invoice-line-editor.tsx`
- Create: `apps/web/src/components/invoices/invoice-type-badge.tsx`
- Create: `apps/web/src/components/invoices/invoice-status-badge.tsx`
- Create: `apps/web/src/components/invoices/payment-dialog.tsx`
- Create: `apps/web/src/components/invoices/payment-method-badge.tsx`

**Step 1: Create badge components**

Follow pattern from existing status badges. `invoice-type-badge.tsx`: customer_invoice → blue, vendor_bill → orange, credit_note → red. `invoice-status-badge.tsx`: draft → gray, posted → blue, paid → green, cancel → red.

**Step 2: Create payment method badge**

`payment-method-badge.tsx`: maps each method to icon + label.

**Step 3: Create invoice line editor**

`invoice-line-editor.tsx` — follow pattern from `sales/line-item-editor.tsx`. Fields: productName, quantity, unitPrice, discount, discountType, taxAmount, subtotal (auto-calculated).

**Step 4: Create invoice form**

`invoice-form.tsx` — follow pattern from `sales/sale-order-form.tsx`. Fields:
- Type selector (customer_invoice / vendor_bill / credit_note)
- Company selector
- Contact selector
- Invoice date, due date
- Payment terms selector
- Currency
- Line items (using invoice-line-editor)
- Notes, internal notes
- Amount summary (subtotal, discount, tax, total)

**Step 5: Create new/edit pages**

`invoices/new/page.tsx` and `invoices/[id]/edit/page.tsx` — same pattern as sales.

**Step 6: Commit**

```bash
git add apps/web/src/
git commit -m "feat(invoicing): add invoice form, line editor, badges, payment dialog"
```

---

## Task 8: Frontend — Invoice Detail Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/invoices/[id]/page.tsx`

**Step 1: Create invoice detail page**

Show:
- Header: invoice number, type badge, state badge, action buttons (Post, Cancel, Create Payment)
- Info cards: company, contact, dates, payment terms, amounts
- Lines table
- Payments list
- Notes section

Action buttons:
- "Post" (draft → posted)
- "Register Payment" → opens payment dialog
- "Cancel" (draft/posted → cancel)
- "Archive" / "Unarchive"

**Step 2: Commit**

```bash
git add apps/web/src/
git commit -m "feat(invoicing): add invoice detail page with payment registration"
```

---

## Task 9: Frontend — Update Sidebar Navigation

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

**Step 1: Add Invoices nav item**

Add "Invoices" link in sidebar after "Sales". Use `FileText` icon from lucide.

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/layout.tsx
git commit -m "feat(invoicing): add invoices to sidebar navigation"
```

---

## Task 10: Frontend — Update Sale Order Detail (Create Invoice button)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/sales/[id]/page.tsx`

**Step 1: Add "Create Invoice" button**

On SO detail page, if `so.state` is confirmed/invoiced/delivered/done and `so.invoiceStatus !== 'invoiced'`, show "Create Invoice" button. On click, call `invoices.createFromSaleOrder` and redirect to the new invoice.

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/sales/
git commit -m "feat(invoicing): add Create Invoice button on Sale Order detail"
```

---

## Task 11: Seed Data — Add sample invoices, payments, taxes

**Files:**
- Modify: `convex/seed.ts`

**Step 1: Add sample data constants**

Add after `SAMPLE_SALE_ORDERS`:

```ts
const SAMPLE_TAXES = [
  { name: 'PPN 11%', rate: 0.11, type: 'percentage' as const, scope: 'both' as const, active: true },
  { name: 'PPH 23 (2%)', rate: 0.02, type: 'percentage' as const, scope: 'purchase' as const, active: true },
  { name: 'PPN 0%', rate: 0, type: 'percentage' as const, scope: 'both' as const, active: true },
];

const SAMPLE_PAYMENT_TERMS = [
  { name: 'Immediate Payment', dueDays: 0, description: 'Payment due immediately' },
  { name: 'Net 15', dueDays: 15, description: 'Payment due within 15 days' },
  { name: 'Net 30', dueDays: 30, description: 'Payment due within 30 days' },
  { name: 'Net 60', dueDays: 60, description: 'Payment due within 60 days' },
  { name: '2/10 Net 30', dueDays: 30, discountDays: 10, discountPercent: 2, description: '2% discount if paid within 10 days, net 30' },
];
```

**Step 2: Add seed logic for taxes, payment terms, invoices, payments**

Follow same pattern as sale orders:
1. Create taxes (with orgId)
2. Create payment terms (with orgId)
3. Create invoices from sale orders (using `nextSequence` with prefix `INV`)
4. Create sample payments for some invoices

**Step 3: Update cleanup to delete new tables**

Add to `cleanupSeedData`:
```ts
const paymentRecords = await ctx.table('payments').take(1000);
for (const p of paymentRecords) await ctx.db.delete(p._id);

const invoiceLines = await ctx.table('invoiceLines').take(1000);
for (const l of invoiceLines) await ctx.db.delete(l._id);

const invoices = await ctx.table('invoices').take(1000);
for (const i of invoices) await ctx.db.delete(i._id);

const taxes = await ctx.table('taxes').take(1000);
for (const t of taxes) await ctx.db.delete(t._id);

const paymentTerms = await ctx.table('paymentTerms').take(1000);
for (const pt of paymentTerms) await ctx.db.delete(pt._id);
```

**Step 4: Commit**

```bash
git add convex/seed.ts
git commit -m "feat(invoicing): add sample invoices, payments, taxes to seed"
```

---

## Task 12: Polish & Verification

**Step 1: Run typecheck**

```bash
npx convex typecheck
```

**Step 2: Run lint**

```bash
cd apps/web && bun lint
```

**Step 3: Manual browser test**

- Navigate to `/invoices` — should show list
- Click "New Invoice" — form should load
- Create invoice with line items
- Post invoice (draft → posted)
- Register payment
- Verify payment status updates
- Check SO detail has "Create Invoice" button
- Verify sidebar shows Invoices link

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(invoicing): invoicing & billing module complete"
```

---

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Schema (5 tables) | 30min |
| 2 | Taxes & Payment Terms CRUD | 30min |
| 3 | Invoice CRUD & Workflow | 1.5h |
| 4 | Payments CRUD | 30min |
| 5 | SO integration (backend) | — (in Task 3) |
| 6 | Invoice List Page | 1h |
| 7 | Invoice Form & Components | 1.5h |
| 8 | Invoice Detail Page | 1h |
| 9 | Sidebar Navigation | 15min |
| 10 | SO Detail → Create Invoice | 30min |
| 11 | Seed Data | 30min |
| 12 | Polish & Verification | 30min |
| **Total** | | **~8h** |
