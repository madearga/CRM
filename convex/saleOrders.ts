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
import type { AuthMutationCtx } from './functions';
import type { EntWriter } from './shared/types';

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
  discount: z.number().min(0).optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  taxAmount: z.number().min(0).optional(),
  subtotal: z.number(),
  productId: zid('products').optional(),
  productVariantId: zid('productVariants').optional(),
  deliveredQty: z.number().optional(),
  invoicedQty: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
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

const VALID_TRANSITIONS: Record<z.infer<typeof stateEnum>, string[]> = {
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

async function recalculateTotals(ctx: AuthMutationCtx, so: EntWriter<'saleOrders'>) {
  // NOTE: This follows a read-modify-write pattern.
  // Convex ensures single-writer per document, so this is safe from concurrent writes
  // within the same transaction, but callers must ensure they don't call this
  // concurrently across different transactions for the same SO if atomicity is critical.
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

    // Resolve names
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
    const number = await nextSequence(ctx, ctx.orgId, 'saleOrder', args.orderDate);

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

    const soId = await ctx.table('saleOrders').insert({
      number,
      state: 'draft',
      orderDate: args.orderDate,
      validUntil: args.validUntil,
      subtotal,
      discountAmount: args.discountAmount,
      discountType: args.discountType,
      taxAmount,
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

    for (const line of lineSubtotals) {
      await ctx.table('saleOrderLines').insert({
        ...line,
        saleOrderId: soId,
        organizationId: ctx.orgId,
      });
    }

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

    if (!['draft', 'sent'].includes(so.state)) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot edit sale order in '${so.state}' state`,
      });
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Recalculate total if discount changed
    if (cleanUpdates.discountAmount !== undefined || cleanUpdates.discountType !== undefined) {
      const newDiscountAmount: number = (cleanUpdates.discountAmount as number) ?? so.discountAmount ?? 0;
      const newDiscountType: string = (cleanUpdates.discountType as string) ?? so.discountType ?? 'fixed';
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
    const patchData: any = { state: args.targetState };

    if (args.targetState === 'invoiced') patchData.invoiceStatus = 'invoiced';
    if (args.targetState === 'delivered') patchData.deliveryStatus = 'delivered';

    await so.patch(patchData);

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

    const merged = { ...line, ...cleanUpdates };
    (cleanUpdates as any).subtotal = calculateLineSubtotal(merged as any);

    await line.patch(cleanUpdates);
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
