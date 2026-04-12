# Sales Order Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Sales Order module — quotations → confirmed orders → invoiced → done workflow, with line items linked to products, Deal → SO conversion, and full CRUD.

**Architecture:** Follow existing patterns from `products.ts`, `productCategories.ts` — use `createOrgMutation`, `createOrgQuery`, `createOrgPaginatedQuery` from `convex/functions.ts`. Schema uses `convex-ents` with `defineEnt`. Frontend uses same pattern as Products: data-table with memoized cells, form components, nuqs for URL state. Workflow state machine reuses `convex/shared/workflowEngine.ts`.

**Tech Stack:** Convex (convex-ents, convex-helpers/zod), Next.js App Router, TanStack Table, shadcn/ui, nuqs, sonner for toasts, lucide icons.

---

## Task 1: Schema — Add saleOrders and saleOrderLines tables

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add saleOrders and saleOrderLines tables to schema**

Add after the `productVariants` definition in `convex/schema.ts`:

```ts
    // --------------------
    // Sales Order (Module 2)
    // --------------------

    saleOrders: defineEnt({
      number: v.string(),                          // "SO-2024-0001" (auto-generated)
      state: v.union(
        v.literal('draft'),
        v.literal('sent'),
        v.literal('confirmed'),
        v.literal('invoiced'),
        v.literal('delivered'),
        v.literal('done'),
        v.literal('cancel'),
      ),
      orderDate: v.number(),
      validUntil: v.optional(v.number()),
      subtotal: v.number(),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      totalAmount: v.number(),
      currency: v.optional(v.string()),
      deliveryDate: v.optional(v.number()),
      deliveryAddress: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      customerNotes: v.optional(v.string()),
      terms: v.optional(v.string()),
      source: v.optional(v.string()),
      invoiceStatus: v.optional(v.union(
        v.literal('to_invoice'),
        v.literal('partially'),
        v.literal('invoiced'),
      )),
      deliveryStatus: v.optional(v.union(
        v.literal('to_deliver'),
        v.literal('partially'),
        v.literal('delivered'),
      )),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .field('contactId', v.optional(v.id('contacts')))
      .field('dealId', v.optional(v.id('deals')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('contact', { to: 'contacts', field: 'contactId', optional: true })
      .edge('deal', { to: 'deals', field: 'dealId', optional: true })
      .edges('lines', { to: 'saleOrderLines', ref: 'saleOrderId' })
      .index('organizationId_state', ['organizationId', 'state'])
      .index('organizationId_companyId', ['organizationId', 'companyId'])
      .index('organizationId_orderDate', ['organizationId', 'orderDate'])
      .index('organizationId_ownerId', ['organizationId', 'ownerId'])
      .searchIndex('search_sale_orders', {
        searchField: 'number',
        filterFields: ['organizationId', 'state'],
      }),

    saleOrderLines: defineEnt({
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
      deliveredQty: v.optional(v.number()),
      invoicedQty: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('saleOrderId', v.id('saleOrders'))
      .field('productId', v.optional(v.id('products')))
      .field('productVariantId', v.optional(v.id('productVariants')))
      .edge('saleOrder', { to: 'saleOrders', field: 'saleOrderId' })
      .edge('product', { to: 'products', field: 'productId', optional: true })
      .index('organizationId_saleOrderId', ['organizationId', 'saleOrderId']),
```

Also add `user` edges for saleOrders:

```ts
      .edges('saleOrders', { ref: 'ownerId' })
```

Add this to the `user` definition after `.edges('products', { ref: 'ownerId' })`.

**Step 2: Verify typecheck**

Run: `cd /Users/madearga/Desktop/crm && npx convex typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(sales): add saleOrders and saleOrderLines schema"
```

---

## Task 2: Backend — Sale Order CRUD queries

**Files:**
- Create: `convex/saleOrders.ts`

**Step 1: Write list and getById queries**

Create `convex/saleOrders.ts`:

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

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const stateEnum = z.enum([
  'draft', 'sent', 'confirmed', 'invoiced', 'delivered', 'done', 'cancel',
]);

const lineSchema = z.object({
  id: zid('saleOrderLines'),
  productName: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  discount: z.number().optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  taxAmount: z.number().optional(),
  subtotal: z.number(),
  productId: zid('products').optional(),
  productVariantId: zid('productVariants').optional(),
  deliveredQty: z.number().optional(),
  invoicedQty: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = createOrgPaginatedQuery()({
  args: {
    state: stateEnum.optional(),
    companyId: zid('companies').optional(),
    search: z.string().optional(),
    includeArchived: z.boolean().optional(),
  },
  returns: z.object({
    page: z.array(z.object({
      id: zid('saleOrders'),
      number: z.string(),
      state: stateEnum,
      orderDate: z.number(),
      totalAmount: z.number(),
      currency: z.string().optional(),
      invoiceStatus: z.enum(['to_invoice', 'partially', 'invoiced']).optional(),
      deliveryStatus: z.enum(['to_deliver', 'partially', 'delivered']).optional(),
      companyId: zid('companies').optional(),
      contactId: zid('contacts').optional(),
      ownerId: zid('user'),
      organizationId: zid('organization'),
      archivedAt: z.number().optional(),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
    })),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    let result;
    if (args.search) {
      result = await ctx
        .table('saleOrders')
        .search('search_sale_orders', (q: any) => {
          let builder = q.search('number', args.search!).eq('organizationId', orgId);
          if (args.state) builder = (builder as any).eq('state', args.state);
          return builder;
        })
        .paginate(args.paginationOpts);
    } else if (args.state) {
      result = await ctx
        .table('saleOrders', 'organizationId_state', (q: any) =>
          q.eq('organizationId', orgId).eq('state', args.state)
        )
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('saleOrders', 'organizationId_orderDate', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    }

    let page = result.page as any[];

    if (!args.includeArchived) {
      page = page.filter((so: any) => !so.archivedAt);
    }

    // Resolve company & contact names
    const companyIds = [...new Set(page.map((so: any) => so.companyId).filter(Boolean))];
    const contactIds = [...new Set(page.map((so: any) => so.contactId).filter(Boolean))];
    const companyMap = new Map<string, string>();
    const contactMap = new Map<string, string>();

    for (const id of companyIds) {
      const c = await ctx.table('companies').get(id);
      if (c) companyMap.set(id, c.name);
    }
    for (const id of contactIds) {
      const c = await ctx.table('contacts').get(id);
      if (c) contactMap.set(id, c.fullName);
    }

    return {
      page: page.map((so: any) => ({
        id: so._id,
        number: so.number,
        state: so.state,
        orderDate: so.orderDate,
        totalAmount: so.totalAmount,
        currency: so.currency,
        invoiceStatus: so.invoiceStatus,
        deliveryStatus: so.deliveryStatus,
        companyId: so.companyId,
        contactId: so.contactId,
        ownerId: so.ownerId,
        organizationId: so.organizationId,
        archivedAt: so.archivedAt,
        companyName: so.companyId ? companyMap.get(so.companyId) : undefined,
        contactName: so.contactId ? contactMap.get(so.contactId) : undefined,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getById = createOrgQuery()({
  args: { id: zid('saleOrders') },
  returns: z.object({
    id: zid('saleOrders'),
    number: z.string(),
    state: stateEnum,
    orderDate: z.number(),
    validUntil: z.number().optional(),
    subtotal: z.number(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    taxAmount: z.number().optional(),
    totalAmount: z.number(),
    currency: z.string().optional(),
    deliveryDate: z.number().optional(),
    deliveryAddress: z.string().optional(),
    internalNotes: z.string().optional(),
    customerNotes: z.string().optional(),
    terms: z.string().optional(),
    source: z.string().optional(),
    invoiceStatus: z.enum(['to_invoice', 'partially', 'invoiced']).optional(),
    deliveryStatus: z.enum(['to_deliver', 'partially', 'delivered']).optional(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    dealId: zid('deals').optional(),
    ownerId: zid('user'),
    organizationId: zid('organization'),
    archivedAt: z.number().optional(),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    lines: z.array(lineSchema),
  }),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').get(args.id);
    if (!so || so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }

    const lines = await so.edge('lines');

    let companyName: string | undefined;
    if (so.companyId) {
      const c = await ctx.table('companies').get(so.companyId);
      companyName = c?.name;
    }

    let contactName: string | undefined;
    if (so.contactId) {
      const c = await ctx.table('contacts').get(so.contactId);
      contactName = c?.fullName;
    }

    return {
      id: so._id,
      number: so.number,
      state: so.state,
      orderDate: so.orderDate,
      validUntil: so.validUntil,
      subtotal: so.subtotal,
      discountAmount: so.discountAmount,
      discountType: so.discountType,
      taxAmount: so.taxAmount,
      totalAmount: so.totalAmount,
      currency: so.currency,
      deliveryDate: so.deliveryDate,
      deliveryAddress: so.deliveryAddress,
      internalNotes: so.internalNotes,
      customerNotes: so.customerNotes,
      terms: so.terms,
      source: so.source,
      invoiceStatus: so.invoiceStatus,
      deliveryStatus: so.deliveryStatus,
      companyId: so.companyId,
      contactId: so.contactId,
      dealId: so.dealId,
      ownerId: so.ownerId,
      organizationId: so.organizationId,
      archivedAt: so.archivedAt,
      companyName,
      contactName,
      lines: lines.map((l: any) => ({
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
        productVariantId: l.productVariantId,
        deliveredQty: l.deliveredQty,
        invoicedQty: l.invoicedQty,
      })),
    };
  },
});
```

**Step 2: Verify typecheck**

Run: `npx convex typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/saleOrders.ts
git commit -m "feat(sales): add sale order list and getById queries"
```

---

## Task 3: Backend — Sale Order mutations + workflow

**Files:**
- Modify: `convex/saleOrders.ts` (append mutations)

**Step 1: Add create, update, workflow mutations**

Append to `convex/saleOrders.ts`:

```ts
// ---------------------------------------------------------------------------
// Helper: Calculate line subtotal
// ---------------------------------------------------------------------------

function calculateLineSubtotal(line: {
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  taxAmount?: number;
}): number {
  let subtotal = line.quantity * line.unitPrice;
  if (line.discount) {
    if (line.discountType === 'percentage') {
      subtotal -= subtotal * (line.discount / 100);
    } else {
      subtotal -= line.discount;
    }
  }
  if (line.taxAmount) subtotal += line.taxAmount;
  return Math.round(subtotal * 100) / 100;
}

// ---------------------------------------------------------------------------
// Helper: Validate state transition
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'cancel'],
  sent: ['confirmed', 'cancel'],
  confirmed: ['invoiced', 'delivered', 'cancel'],
  invoiced: ['done'],
  delivered: ['done'],
  done: [],
  cancel: [],
};

function validateTransition(current: string, target: string): void {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    throw new ConvexError({
      code: 'VALIDATION_ERROR',
      message: `Cannot transition from '${current}' to '${target}'`,
    });
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = createOrgMutation()({
  args: {
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    dealId: zid('deals').optional(),
    orderDate: z.number(),
    validUntil: z.number().optional(),
    deliveryDate: z.number().optional(),
    deliveryAddress: z.string().optional(),
    internalNotes: z.string().optional(),
    customerNotes: z.string().optional(),
    terms: z.string().optional(),
    currency: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    lines: z.array(z.object({
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      productId: zid('products').optional(),
      productVariantId: zid('productVariants').optional(),
    })).min(1),
  },
  returns: zid('saleOrders'),
  handler: async (ctx, args) => {
    // Generate SO number: SO-{YEAR}-{SEQ}
    const number = await nextSequence(ctx, ctx.orgId, 'saleOrder', args.orderDate);

    // Calculate lines
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

    const totalAmount = Math.round((subtotal - discountTotal) * 100) / 100;

    // Create sale order
    const soId = await ctx.table('saleOrders').insert({
      number,
      state: 'draft',
      orderDate: args.orderDate,
      validUntil: args.validUntil,
      subtotal,
      discountAmount: args.discountAmount,
      discountType: args.discountType,
      taxAmount: lineSubtotals.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0),
      totalAmount,
      currency: args.currency,
      deliveryDate: args.deliveryDate,
      deliveryAddress: args.deliveryAddress,
      internalNotes: args.internalNotes,
      customerNotes: args.customerNotes,
      terms: args.terms,
      source: args.dealId ? 'deal' : 'manual',
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
      invoiceStatus: 'to_invoice',
      deliveryStatus: 'to_deliver',
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    // Create lines
    for (const line of lineSubtotals) {
      await ctx.table('saleOrderLines').insert({
        ...line,
        saleOrderId: soId,
        organizationId: ctx.orgId,
      });
    }

    // Audit log
    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: soId as unknown as string,
      action: 'create',
      after: { number, totalAmount, lineCount: args.lines.length },
    });

    return soId;
  },
});

export const update = createOrgMutation()({
  args: {
    id: zid('saleOrders'),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    orderDate: z.number().optional(),
    validUntil: z.number().optional(),
    deliveryDate: z.number().optional(),
    deliveryAddress: z.string().optional(),
    internalNotes: z.string().optional(),
    customerNotes: z.string().optional(),
    terms: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const so = await ctx.table('saleOrders').getX(id);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }

    // Only draft and sent can be edited
    if (!['draft', 'sent'].includes(so.state)) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot edit sale order in '${so.state}' state`,
      });
    }

    const before = { subtotal: so.subtotal, totalAmount: so.totalAmount };

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Recalculate total if discount changed
    if (cleanUpdates.discountAmount !== undefined || cleanUpdates.discountType !== undefined) {
      const newDiscountAmount = cleanUpdates.discountAmount ?? so.discountAmount ?? 0;
      const newDiscountType = cleanUpdates.discountType ?? so.discountType ?? 'fixed';
      const subtotal = so.subtotal;

      let discountTotal = 0;
      if (newDiscountAmount) {
        if (newDiscountType === 'percentage') {
          discountTotal = subtotal * (newDiscountAmount / 100);
        } else {
          discountTotal = newDiscountAmount;
        }
      }

      const taxAmount = so.taxAmount ?? 0;
      (cleanUpdates as any).totalAmount = Math.round((subtotal - discountTotal + taxAmount) * 100) / 100;
    }

    await so.patch(cleanUpdates);

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: id as unknown as string,
      action: 'update',
      before,
      after: cleanUpdates,
    });

    return null;
  },
});

export const transitionState = createOrgMutation()({
  args: {
    id: zid('saleOrders'),
    targetState: stateEnum,
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').getX(args.id);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }

    validateTransition(so.state, args.targetState);

    const before = so.state;
    await so.patch({ state: args.targetState });

    // Update invoice/delivery status on transition
    if (args.targetState === 'invoiced') {
      await so.patch({ invoiceStatus: 'invoiced' });
    }
    if (args.targetState === 'delivered') {
      await so.patch({ deliveryStatus: 'delivered' });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: args.id as unknown as string,
      action: `state.${args.targetState}`,
      before: { state: before },
      after: { state: args.targetState },
    });

    return null;
  },
});

export const archive = createOrgMutation()({
  args: { id: zid('saleOrders') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').getX(args.id);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }
    await so.patch({ archivedAt: Date.now() });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: args.id as unknown as string,
      action: 'archive',
      before: { number: so.number },
    });

    return null;
  },
});

export const unarchive = createOrgMutation()({
  args: { id: zid('saleOrders') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').getX(args.id);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }
    await so.patch({ archivedAt: undefined });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: args.id as unknown as string,
      action: 'unarchive',
    });

    return null;
  },
});

export const duplicate = createOrgMutation()({
  args: { id: zid('saleOrders') },
  returns: zid('saleOrders'),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').getX(args.id);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }

    const newNumber = await nextSequence(ctx, ctx.orgId, 'saleOrder');

    const newSoId = await ctx.table('saleOrders').insert({
      number: newNumber,
      state: 'draft',
      orderDate: Date.now(),
      subtotal: so.subtotal,
      discountAmount: so.discountAmount,
      discountType: so.discountType,
      taxAmount: so.taxAmount,
      totalAmount: so.totalAmount,
      currency: so.currency,
      deliveryDate: so.deliveryDate,
      deliveryAddress: so.deliveryAddress,
      internalNotes: so.internalNotes,
      customerNotes: so.customerNotes,
      terms: so.terms,
      source: 'manual',
      companyId: so.companyId,
      contactId: so.contactId,
      invoiceStatus: 'to_invoice',
      deliveryStatus: 'to_deliver',
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    // Copy lines
    const lines = await so.edge('lines');
    for (const line of lines) {
      await ctx.table('saleOrderLines').insert({
        productName: line.productName,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        discountType: line.discountType,
        taxAmount: line.taxAmount,
        subtotal: line.subtotal,
        productId: line.productId,
        productVariantId: line.productVariantId,
        saleOrderId: newSoId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: newSoId as unknown as string,
      action: 'duplicate',
      metadata: { sourceSaleOrderId: args.id as unknown as string },
    });

    return newSoId;
  },
});

// ---------------------------------------------------------------------------
// Line Mutations
// ---------------------------------------------------------------------------

export const addLine = createOrgMutation()({
  args: {
    saleOrderId: zid('saleOrders'),
    productName: z.string(),
    description: z.string().optional(),
    quantity: z.number().min(0.01),
    unitPrice: z.number(),
    discount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    taxAmount: z.number().optional(),
    productId: zid('products').optional(),
    productVariantId: zid('productVariants').optional(),
  },
  returns: zid('saleOrderLines'),
  handler: async (ctx, args) => {
    const { saleOrderId, ...lineData } = args;
    const so = await ctx.table('saleOrders').getX(saleOrderId);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }
    if (!['draft', 'sent'].includes(so.state)) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Cannot add lines to confirmed order' });
    }

    const subtotal = calculateLineSubtotal(lineData);

    const lineId = await ctx.table('saleOrderLines').insert({
      ...lineData,
      subtotal,
      saleOrderId,
      organizationId: ctx.orgId,
    });

    // Recalculate SO totals
    await recalculateTotals(ctx, so);

    return lineId;
  },
});

export const updateLine = createOrgMutation()({
  args: {
    id: zid('saleOrderLines'),
    productName: z.string().optional(),
    description: z.string().optional(),
    quantity: z.number().min(0.01).optional(),
    unitPrice: z.number().optional(),
    discount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    taxAmount: z.number().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const line = await ctx.table('saleOrderLines').getX(id);
    if (line.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Line not found' });
    }

    const so = await ctx.table('saleOrders').getX(line.saleOrderId);
    if (!['draft', 'sent'].includes(so.state)) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Cannot edit lines on confirmed order' });
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Recalculate line subtotal
    const merged = { ...line, ...cleanUpdates };
    (cleanUpdates as any).subtotal = calculateLineSubtotal(merged as any);

    await line.patch(cleanUpdates);

    // Recalculate SO totals
    await recalculateTotals(ctx, so);

    return null;
  },
});

export const removeLine = createOrgMutation()({
  args: { id: zid('saleOrderLines') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const line = await ctx.table('saleOrderLines').getX(args.id);
    if (line.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Line not found' });
    }

    const so = await ctx.table('saleOrders').getX(line.saleOrderId);
    if (!['draft', 'sent'].includes(so.state)) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Cannot remove lines from confirmed order' });
    }

    await line.delete();
    await recalculateTotals(ctx, so);

    return null;
  },
});

// ---------------------------------------------------------------------------
// Helper: Recalculate SO totals from lines
// ---------------------------------------------------------------------------

async function recalculateTotals(ctx: any, so: any) {
  const lines = await so.edge('lines');
  const subtotal = lines.reduce((sum: number, l: any) => sum + l.subtotal, 0);

  let discountTotal = 0;
  if (so.discountAmount) {
    if (so.discountType === 'percentage') {
      discountTotal = subtotal * (so.discountAmount / 100);
    } else {
      discountTotal = so.discountAmount;
    }
  }

  const taxAmount = lines.reduce((sum: number, l: any) => sum + (l.taxAmount ?? 0), 0);
  const totalAmount = Math.round((subtotal - discountTotal + taxAmount) * 100) / 100;

  await so.patch({ subtotal, taxAmount, totalAmount });
}
```

**Step 2: Fix sequenceGenerator to use ent framework**

The existing `sequenceGenerator.ts` uses raw `ctx.db` — update to use `ctx.table()`:

Modify `convex/shared/sequenceGenerator.ts` — change `ctx.db.query` and `ctx.db.patch/insert` to use `ctx.table()`:

```ts
export async function nextSequence(
  ctx: { table: any },
  organizationId: string,
  type: SequenceType,
  date: number = Date.now()
): Promise<string> {
  const prefix = SEQUENCE_PREFIXES[type];
  const year = new Date(date).getFullYear();

  const existing = await ctx
    .table('sequences', 'organizationId_prefix_year', (q: any) =>
      q
        .eq('organizationId', organizationId)
        .eq('prefix', prefix)
        .eq('year', year)
    )
    .first();

  if (existing) {
    const newCounter = existing.counter + 1;
    await existing.patch({ counter: newCounter });
    return `${prefix}-${year}-${String(newCounter).padStart(4, "0")}`;
  } else {
    await ctx.table('sequences').insert({
      organizationId,
      prefix,
      year,
      counter: 1,
    });
    return `${prefix}-${year}-0001`;
  }
}
```

**Step 3: Verify typecheck**

Run: `npx convex typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/saleOrders.ts convex/shared/sequenceGenerator.ts
git commit -m "feat(sales): add sale order CRUD mutations, workflow, line management"
```

---

## Task 4: Backend — Deal → Sale Order conversion

**Files:**
- Modify: `convex/deals.ts` (add convertToSaleOrder mutation)

**Step 1: Add convertToSaleOrder mutation to deals.ts**

Add at the end of `convex/deals.ts`:

```ts
export const convertToSaleOrder = createOrgMutation()({
  args: {
    id: zid('deals'),
    lines: z.array(z.object({
      productName: z.string(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      productId: zid('products').optional(),
    })).min(1),
  },
  returns: zid('saleOrders'),
  handler: async (ctx, args) => {
    const deal = await ctx.table('deals').getX(args.id);
    if (deal.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Deal not found' });
    }

    if (deal.stage !== 'won') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Can only convert won deals to sale orders',
      });
    }

    // Import dynamically to avoid circular deps
    const { nextSequence } = await import('./shared/sequenceGenerator');
    const { createAuditLog } = await import('./auditLogs');

    const number = await nextSequence(ctx, ctx.orgId, 'saleOrder');
    const subtotal = args.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const totalAmount = Math.round(subtotal * 100) / 100;

    const soId = await ctx.table('saleOrders').insert({
      number,
      state: 'draft',
      orderDate: Date.now(),
      subtotal,
      totalAmount,
      source: 'deal',
      companyId: deal.companyId,
      contactId: deal.primaryContactId,
      dealId: args.id,
      invoiceStatus: 'to_invoice',
      deliveryStatus: 'to_deliver',
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of args.lines) {
      const lineSubtotal = line.quantity * line.unitPrice;
      await ctx.table('saleOrderLines').insert({
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: lineSubtotal,
        productId: line.productId,
        saleOrderId: soId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: soId as unknown as string,
      action: 'createFromDeal',
      metadata: { dealId: args.id as unknown as string },
    });

    return soId;
  },
});
```

**Step 2: Verify typecheck**

Run: `npx convex typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/deals.ts
git commit -m "feat(sales): add deal → sale order conversion"
```

---

## Task 5: Frontend — Sidebar navigation + route setup

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx` (add Sales nav item)
- Create: `apps/web/src/hooks/use-sales-params.ts`

**Step 1: Add Sales nav item**

In `apps/web/src/app/(dashboard)/layout.tsx`, add import and nav item:

```ts
import { ShoppingCart } from 'lucide-react';  // add to imports

// In navItems array, after Products:
{ title: 'Sales', href: '/sales', icon: ShoppingCart },
```

**Step 2: Create URL params hook**

Create `apps/web/src/hooks/use-sales-params.ts`:

```ts
"use client";

import { parseAsString, parseAsBoolean, useQueryStates } from "nuqs";

export function useSalesParams() {
  const [params, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
    archived: parseAsBoolean.withDefault(false),
  });

  return {
    ...params,
    setParams,
    setSearch: (q: string) => setParams({ q: q || null }),
    toggleArchived: () => setParams({ archived: !params.archived ? true : null }),
  };
}
```

**Step 3: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/layout.tsx apps/web/src/hooks/use-sales-params.ts
git commit -m "feat(sales): add sidebar navigation and URL params hook"
```

---

## Task 6: Frontend — Sale Order list page

**Files:**
- Create: `apps/web/src/app/(dashboard)/sales/columns.tsx`
- Create: `apps/web/src/app/(dashboard)/sales/page.tsx`

**Step 1: Create column definitions**

Create `apps/web/src/app/(dashboard)/sales/columns.tsx`:

```tsx
"use client";

import { memo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { DataTableColumnHeader } from "@/components/data-table";
import { formatMoney } from "@/lib/format-money";

export type SaleOrderRow = {
  id: string;
  number: string;
  state: string;
  orderDate: number;
  totalAmount: number;
  currency?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  invoiceStatus?: string | null;
  archivedAt?: number | null;
};

const STATE_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  invoiced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancel: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const NumberCell = memo(({ id, number }: { id: string; number: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
      <ShoppingCart className="size-4" />
    </div>
    <Link href={`/sales/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
      {number}
    </Link>
  </div>
));
NumberCell.displayName = "NumberCell";

const StateBadge = memo(({ state, archivedAt }: { state: string; archivedAt?: number | null }) => (
  <div>
    <Badge variant="secondary" className={STATE_COLORS[state] ?? ""}>
      {state}
    </Badge>
    {archivedAt && (
      <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
        archived
      </Badge>
    )}
  </div>
));
StateBadge.displayName = "StateBadge";

export function getColumns({
  selectedIds,
  toggleOne,
  allIds,
  toggleAll,
}: {
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
  allIds: string[];
  toggleAll: () => void;
}): ColumnDef<SaleOrderRow>[] {
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id));

  return [
    {
      id: "select",
      size: 40,
      header: () => (
        <Checkbox
          checked={allSelected || (someSelected && "indeterminate")}
          onCheckedChange={() => toggleAll()}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => toggleOne(row.original.id)}
          aria-label={`Select ${row.original.number}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "number",
      accessorKey: "number",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      size: 200,
      cell: ({ row }) => <NumberCell id={row.original.id} number={row.original.number} />,
    },
    {
      id: "state",
      accessorKey: "state",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      size: 120,
      cell: ({ row }) => <StateBadge state={row.original.state} archivedAt={row.original.archivedAt} />,
    },
    {
      id: "customer",
      accessorKey: "companyName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.companyName ?? row.original.contactName ?? "—"}
        </span>
      ),
    },
    {
      id: "total",
      accessorKey: "totalAmount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      size: 140,
      cell: ({ row }) => (
        <span className="font-medium">{formatMoney(row.original.totalAmount)}</span>
      ),
    },
    {
      id: "orderDate",
      accessorKey: "orderDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.orderDate).toLocaleDateString('id-ID')}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 80,
      enableSorting: false,
      cell: () => null,
    },
  ];
}
```

**Step 2: Create list page**

Create `apps/web/src/app/(dashboard)/sales/page.tsx`:

```tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ShoppingCart, Plus, Search, Download } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type SaleOrderRow } from './columns';
import { useSalesParams } from '@/hooks/use-sales-params';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';

export default function SalesPage() {
  const router = useRouter();
  const { q: search, archived: showArchived, setSearch, toggleArchived } = useSalesParams();
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
  const selectedIds = selections.sales ?? new Set();
  const [stateFilter, setStateFilter] = useState<string | undefined>(undefined);

  const { data: orders, isLoading } = useAuthPaginatedQuery(api.saleOrders.list, {
    search: search || undefined,
    includeArchived: showArchived,
    state: (stateFilter as any) || undefined,
  }, { initialNumItems: 50 });

  const archiveSO = useAuthMutation(api.saleOrders.archive);
  const unarchiveSO = useAuthMutation(api.saleOrders.unarchive);

  const rows: SaleOrderRow[] = useMemo(() =>
    (orders ?? []).map((so) => ({
      id: so.id,
      number: so.number,
      state: so.state,
      orderDate: so.orderDate,
      totalAmount: so.totalAmount,
      currency: so.currency,
      companyName: so.companyName,
      contactName: so.contactName,
      invoiceStatus: so.invoiceStatus,
      archivedAt: so.archivedAt,
    })),
    [orders],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const toggleOneSO = useCallback((id: string) => toggleOne("sales", id), [toggleOne]);
  const toggleAllSO = useCallback(() => toggleAll("sales", allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({ selectedIds, toggleOne: toggleOneSO, allIds, toggleAll: toggleAllSO }),
    [selectedIds, toggleOneSO, allIds, toggleAllSO],
  );

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveSO.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("sales");
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => unarchiveSO.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} restored`);
    else toast.error(`Restored ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("sales");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={() => router.push('/sales/new')}>
          <Plus className="mr-1 h-4 w-4" />New Quotation
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search orders..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stateFilter ?? "__all__"} onValueChange={(v) => setStateFilter(v === "__all__" ? undefined : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="cancel">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={toggleArchived}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: "checkbox" }, { type: "avatar-text", width: "w-32" },
          { type: "badge" }, { type: "text", width: "w-24" },
          { type: "text", width: "w-20" }, { type: "text", width: "w-20" },
          { type: "icon" },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<ShoppingCart className="size-7" />} title="No sale orders yet"
          description="Create your first quotation to start selling."
          action={<Button variant="outline" size="sm" onClick={() => router.push('/sales/new')}><Plus className="mr-1 h-4 w-4" />Create Quotation</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/sales/${row.id}`)}
          rowClassName={(row) => `${row.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(row.id) ? 'bg-muted/30' : ''}`}
        />
      )}

      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection("sales")}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        showRestore={showArchived}
        isArchiving={archiveSO.isPending}
      />
    </div>
  );
}
```

**Step 3: Create placeholder pages**

Create `apps/web/src/app/(dashboard)/sales/new/page.tsx`:

```tsx
export default function NewSaleOrderPage() {
  return <div>New Sale Order form — TODO</div>;
}
```

Create `apps/web/src/app/(dashboard)/sales/[id]/page.tsx`:

```tsx
export default function SaleOrderDetailPage() {
  return <div>Sale Order detail — TODO</div>;
}
```

**Step 4: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/sales/ apps/web/src/hooks/use-sales-params.ts
git commit -m "feat(sales): sale order list page with data table and filters"
```

---

## Task 7: Frontend — Sale Order create/edit form with line items

**Files:**
- Create: `apps/web/src/components/sales/sale-order-form.tsx`
- Create: `apps/web/src/components/sales/line-item-editor.tsx`
- Create: `apps/web/src/components/sales/amount-summary.tsx`
- Modify: `apps/web/src/app/(dashboard)/sales/new/page.tsx`

**Step 1: Create line item editor component**

Create `apps/web/src/components/sales/line-item-editor.tsx`:

This is an editable table where users add/remove product lines. Each line has: product selector, quantity, unit price, discount, subtotal. When a product is selected from search, it auto-fills productName and unitPrice.

Key features:
- Search products via `api.products.list`
- Add blank line / remove line
- Auto-calculate line subtotal on change
- Show running subtotal/tax/total at bottom

**Step 2: Create amount summary component**

Create `apps/web/src/components/sales/amount-summary.tsx`:

Shows: Subtotal, Discount (if any), Tax, Total. Uses `formatMoney()` from `@/lib/format-money`.

**Step 3: Create sale order form**

Create `apps/web/src/components/sales/sale-order-form.tsx`:

Main form with:
- Customer selector (search companies + contacts)
- Order date, valid until, delivery date
- Line items editor
- Global discount input
- Internal notes, customer notes, terms
- Submit creates SO via `api.saleOrders.create`

**Step 4: Wire up new page**

Update `apps/web/src/app/(dashboard)/sales/new/page.tsx` to render `<SaleOrderForm />`.

**Step 5: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/components/sales/ apps/web/src/app/\(dashboard\)/sales/new/
git commit -m "feat(sales): sale order form with line item editor"
```

---

## Task 8: Frontend — Sale Order detail page with workflow

**Files:**
- Create: `apps/web/src/components/sales/sale-order-status-badge.tsx`
- Modify: `apps/web/src/app/(dashboard)/sales/[id]/page.tsx`
- Create: `apps/web/src/app/(dashboard)/sales/[id]/edit/page.tsx`

**Step 1: Create status badge component**

Create `apps/web/src/components/sales/sale-order-status-badge.tsx` — reusable badge with state colors.

**Step 2: Create detail page**

Update `apps/web/src/app/(dashboard)/sales/[id]/page.tsx`:

Shows:
- Header: SO number, state badge, customer, action buttons (workflow transitions)
- Info section: dates, addresses, notes
- Lines table: product, qty, price, discount, subtotal
- Amount summary at bottom

Workflow buttons based on current state:
- draft → "Send" (→ sent)
- sent → "Confirm" (→ confirmed)
- confirmed → "Create Invoice" (→ invoiced), "Mark Delivered" (→ delivered)
- invoiced/delivered → "Mark Done" (→ done)
- Any (except done/cancel) → "Cancel"

**Step 3: Create edit page (for draft/sent only)**

Create `apps/web/src/app/(dashboard)/sales/[id]/edit/page.tsx`:

Loads SO data, renders `<SaleOrderForm />` in edit mode. Only accessible if state is draft/sent.

**Step 4: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/sales/sale-order-status-badge.tsx apps/web/src/app/\(dashboard\)/sales/
git commit -m "feat(sales): sale order detail page with workflow transitions"
```

---

## Task 9: Integration — Deal → Sale Order button on Deal detail

**Files:**
- Modify: `apps/web/src/app/(dashboard)/deals/[id]/page.tsx`

**Step 1: Add "Create Sale Order" button**

On the Deal detail page, when deal stage is "won", show a "Create Sale Order" button. Clicking opens a dialog that:
1. Pre-fills company and contact from the deal
2. Shows a mini line-item editor
3. Calls `api.deals.convertToSaleOrder`
4. Redirects to the new SO detail page on success

**Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/deals/
git commit -m "feat(sales): deal → sale order conversion button"
```

---

## Summary

| Task | Description | Effort |
|------|-------------|--------|
| 1 | Schema — saleOrders + saleOrderLines tables | 10 min |
| 2 | Backend — list + getById queries | 20 min |
| 3 | Backend — CRUD mutations + workflow + lines | 30 min |
| 4 | Backend — Deal → SO conversion | 15 min |
| 5 | Frontend — Sidebar nav + params hook | 10 min |
| 6 | Frontend — SO list page | 25 min |
| 7 | Frontend — SO form + line editor | 45 min |
| 8 | Frontend — SO detail + workflow UI | 35 min |
| 9 | Integration — Deal → SO button | 20 min |

**Total: ~3.5 hours**

**Order matters:** Tasks 1-4 (backend) must be done first. Tasks 5-9 (frontend) can be done after. Task 9 depends on Task 8.
