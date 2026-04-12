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

// ---------------------------------------------------------------------------
// Enums & Types
// ---------------------------------------------------------------------------

const typeEnum = z.enum(['customer_invoice', 'vendor_bill', 'credit_note']);
const stateEnum = z.enum(['draft', 'posted', 'paid', 'cancel']);
const paymentStatusEnum = z.enum(['unpaid', 'partially_paid', 'paid']);

const paymentMethodEnum = z.union([
  z.literal('bank_transfer'),
  z.literal('cash'),
  z.literal('credit_card'),
  z.literal('debit_card'),
  z.literal('e_wallet'),
  z.literal('cheque'),
  z.literal('other'),
]);

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['posted', 'cancel'],
  posted: ['paid', 'cancel'],
  paid: [],
  cancel: [],
};

const lineSchema = z.object({
  id: zid('invoiceLines'),
  productName: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  discount: z.number().min(0).optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  taxAmount: z.number().min(0).optional(),
  subtotal: z.number(),
  productId: zid('products').optional(),
  taxId: zid('taxes').optional(),
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
// Queries
// ---------------------------------------------------------------------------

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

    let result;
    if (args.search) {
      result = await ctx
        .table('invoices')
        .search('search_invoices', (q: any) => {
          let builder = q.search('number', args.search!).eq('organizationId', orgId);
          if (args.state) builder = (builder as any).eq('state', args.state);
          if (args.type) builder = (builder as any).eq('type', args.type);
          return builder;
        })
        .paginate(args.paginationOpts);
    } else if (args.companyId) {
      result = await ctx
        .table('invoices', 'organizationId_companyId', (q: any) =>
          q.eq('organizationId', orgId).eq('companyId', args.companyId)
        )
        .paginate(args.paginationOpts);
    } else if (args.state) {
      result = await ctx
        .table('invoices', 'organizationId_state', (q: any) =>
          q.eq('organizationId', orgId).eq('state', args.state)
        )
        .paginate(args.paginationOpts);
    } else if (args.type) {
      result = await ctx
        .table('invoices', 'organizationId_type', (q: any) =>
          q.eq('organizationId', orgId).eq('type', args.type)
        )
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('invoices', 'organizationId_invoiceDate', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .order('desc')
        .paginate(args.paginationOpts);
    }

    let page = result.page as any[];

    if (!args.includeArchived) {
      page = page.filter((inv: any) => !inv.archivedAt);
    }

    // Resolve names
    const companyIds = [...new Set(page.map((inv: any) => inv.companyId).filter(Boolean))];
    const contactIds = [...new Set(page.map((inv: any) => inv.contactId).filter(Boolean))];
    const companyMap = new Map<string, string>();
    const contactMap = new Map<string, string>();

    await Promise.all([
      ...companyIds.map(async (id) => {
        const c = await ctx.table('companies').get(id);
        if (c) companyMap.set(id, c.name);
      }),
      ...contactIds.map(async (id) => {
        const c = await ctx.table('contacts').get(id);
        if (c) contactMap.set(id, c.fullName);
      }),
    ]);

    return {
      page: page.map((inv: any) => ({
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
        organizationId: inv.organizationId,
        ownerId: inv.ownerId,
        archivedAt: inv.archivedAt,
        companyName: inv.companyId ? companyMap.get(inv.companyId) : undefined,
        contactName: inv.contactId ? contactMap.get(inv.contactId) : undefined,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getById = createOrgQuery()({
  args: { id: zid('invoices') },
  returns: z.object({
    id: zid('invoices'),
    number: z.string(),
    type: typeEnum,
    state: stateEnum,
    invoiceDate: z.number(),
    dueDate: z.number(),
    subtotal: z.number(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    taxAmount: z.number().optional(),
    totalAmount: z.number(),
    amountDue: z.number(),
    currency: z.string().optional(),
    paymentStatus: paymentStatusEnum.optional(),
    paymentTermId: zid('paymentTerms').optional(),
    source: z.enum(['sale_order', 'manual']).optional(),
    saleOrderId: zid('saleOrders').optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    organizationId: zid('organization'),
    ownerId: zid('user'),
    archivedAt: z.number().optional(),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    lines: z.array(lineSchema),
    payments: z.array(z.object({
      id: zid('payments'),
      amount: z.number(),
      paymentDate: z.number(),
      method: paymentMethodEnum,
      reference: z.string().optional(),
      memo: z.string().optional(),
      state: z.enum(['draft', 'confirmed', 'cancelled']),
    })),
  }),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').get(args.id);
    if (!inv || inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    const lines = await inv.edge('lines');
    const payments = await inv.edge('payments');

    let companyName: string | undefined;
    if (inv.companyId) {
      const c = await ctx.table('companies').get(inv.companyId);
      companyName = c?.name;
    }

    let contactName: string | undefined;
    if (inv.contactId) {
      const c = await ctx.table('contacts').get(inv.contactId);
      contactName = c?.fullName;
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
      companyId: inv.companyId,
      contactId: inv.contactId,
      organizationId: inv.organizationId,
      ownerId: inv.ownerId,
      archivedAt: inv.archivedAt,
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
        taxId: l.taxId,
      })),
      payments: payments.map((p: any) => ({
        id: p._id,
        amount: p.amount,
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
        memo: p.memo,
        state: p.state,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

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
    lines: z.array(z.object({
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      productId: zid('products').optional(),
      taxId: zid('taxes').optional(),
    })).min(1),
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

    // Note: taxAmount is already included in each line's subtotal via calculateLineSubtotal
    // so we do NOT add it again to totalAmount
    const taxAmount = lineSubtotals.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);
    const totalAmount = Math.round((subtotal - discountTotal) * 100) / 100;

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
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: invId as unknown as string,
      action: 'create',
      after: { number, totalAmount, lineCount: args.lines.length },
    });

    return invId;
  },
});

export const update = createOrgMutation()({
  args: {
    id: zid('invoices'),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    invoiceDate: z.number().optional(),
    dueDate: z.number().optional(),
    currency: z.string().optional(),
    paymentTermId: zid('paymentTerms').optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    lines: z.array(z.object({
      id: zid('invoiceLines').optional(),
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      productId: zid('products').optional(),
      taxId: zid('taxes').optional(),
    })).optional(),
  },
  returns: zid('invoices'),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);
    if (inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    if (inv.state !== 'draft') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Can only edit invoices in draft state',
      });
    }

    const patchData: any = {};
    if (args.companyId !== undefined) patchData.companyId = args.companyId;
    if (args.contactId !== undefined) patchData.contactId = args.contactId;
    if (args.invoiceDate !== undefined) patchData.invoiceDate = args.invoiceDate;
    if (args.dueDate !== undefined) patchData.dueDate = args.dueDate;
    if (args.currency !== undefined) patchData.currency = args.currency;
    if (args.paymentTermId !== undefined) patchData.paymentTermId = args.paymentTermId;
    if (args.notes !== undefined) patchData.notes = args.notes;
    if (args.internalNotes !== undefined) patchData.internalNotes = args.internalNotes;
    if (args.discountAmount !== undefined) patchData.discountAmount = args.discountAmount;
    if (args.discountType !== undefined) patchData.discountType = args.discountType;

    if (args.lines) {
      const lineSubtotals = args.lines.map((line) => ({
        ...line,
        subtotal: calculateLineSubtotal(line),
      }));

      const subtotal = lineSubtotals.reduce((sum, l) => sum + l.subtotal, 0);

      let discountTotal = 0;
      const discAmt = args.discountAmount ?? inv.discountAmount;
      const discType = args.discountType ?? inv.discountType;
      if (discAmt) {
        if (discType === 'percentage') {
          discountTotal = subtotal * (discAmt / 100);
        } else {
          discountTotal = discAmt;
        }
      }

      // Note: taxAmount already included in line subtotals via calculateLineSubtotal
      const taxAmount = lineSubtotals.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);
      const totalAmount = Math.round((subtotal - discountTotal) * 100) / 100;

      patchData.subtotal = subtotal;
      patchData.taxAmount = taxAmount;
      patchData.totalAmount = totalAmount;
      patchData.amountDue = totalAmount; // Reset amount due on edit

      // Update lines
      const existingLines = await inv.edge('lines');
      const existingIds = new Set(existingLines.map((l: any) => l._id));
      const keepIds = new Set(args.lines.map((l) => l.id).filter(Boolean));

      // Delete removed lines
      for (const line of existingLines) {
        if (!keepIds.has(line._id)) {
          await ctx.db.delete(line._id);
        }
      }

      // Upsert lines
      for (const line of lineSubtotals) {
        if (line.id && existingIds.has(line.id)) {
          const { id, ...lineData } = line;
          await ctx.table('invoiceLines').getX(id).patch(lineData);
        } else {
          const { id, ...lineData } = line;
          await ctx.table('invoiceLines').insert({
            ...lineData,
            invoiceId: inv._id,
            organizationId: ctx.orgId,
          });
        }
      }
    } else if (args.discountAmount !== undefined || args.discountType !== undefined) {
      // Re-calculate totals if only discount changed
      const discAmt = args.discountAmount ?? inv.discountAmount;
      const discType = args.discountType ?? inv.discountType;
      let discountTotal = 0;
      if (discAmt) {
        if (discType === 'percentage') {
          discountTotal = inv.subtotal * (discAmt / 100);
        } else {
          discountTotal = discAmt;
        }
      }
      // Note: taxAmount already included in inv.subtotal via calculateLineSubtotal
      const totalAmount = Math.round((inv.subtotal - discountTotal) * 100) / 100;
      patchData.totalAmount = totalAmount;
      patchData.amountDue = totalAmount;
    }

    await inv.patch(patchData);

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: inv._id as unknown as string,
      action: 'update',
      after: patchData,
    });

    return inv._id;
  },
});

export const createFromSaleOrder = createOrgMutation()({
  args: {
    saleOrderId: zid('saleOrders'),
  },
  returns: zid('invoices'),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').getX(args.saleOrderId);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }

    const allowedSOStates = ['confirmed', 'invoiced', 'delivered', 'done'];
    if (!allowedSOStates.includes(so.state)) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot invoice sale order in '${so.state}' state`,
      });
    }

    const number = await nextSequence(ctx, ctx.orgId, 'invoice');
    const now = Date.now();
    const dueDate = now + 30 * 24 * 60 * 60 * 1000; // Default 30 days

    const invId = await ctx.table('invoices').insert({
      number,
      type: 'customer_invoice',
      state: 'draft',
      invoiceDate: now,
      dueDate,
      subtotal: so.subtotal,
      discountAmount: so.discountAmount,
      discountType: so.discountType,
      taxAmount: so.taxAmount,
      totalAmount: so.totalAmount,
      amountDue: so.totalAmount,
      currency: so.currency,
      paymentStatus: 'unpaid',
      source: 'sale_order',
      saleOrderId: so._id,
      companyId: so.companyId,
      contactId: so.contactId,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    const lines = await so.edge('lines');
    for (const line of lines) {
      await ctx.table('invoiceLines').insert({
        productName: line.productName,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        discountType: line.discountType,
        taxAmount: line.taxAmount,
        subtotal: line.subtotal,
        invoiceId: invId,
        organizationId: ctx.orgId,
        productId: line.productId,
      });
    }

    const totalAmount = so.totalAmount;
    const newInvoiceStatus = totalAmount >= so.totalAmount ? 'invoiced' : 'partially';
    await so.patch({ invoiceStatus: newInvoiceStatus });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: invId as unknown as string,
      action: 'create_from_so',
      metadata: { saleOrderId: args.saleOrderId as unknown as string },
    });

    return invId;
  },
});

export const post = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);
    if (inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    validateTransition(inv.state, 'posted');

    await inv.patch({ state: 'posted' });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'post',
      before: { state: inv.state },
      after: { state: 'posted' },
    });

    return null;
  },
});

export const cancel = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);
    if (inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    validateTransition(inv.state, 'cancel');

    await inv.patch({ state: 'cancel' });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'cancel',
      before: { state: inv.state },
      after: { state: 'cancel' },
    });

    return null;
  },
});

export const addPayment = createOrgMutation()({
  args: {
    invoiceId: zid('invoices'),
    amount: z.number().positive(),
    paymentDate: z.number(),
    method: paymentMethodEnum,
    reference: z.string().optional(),
    memo: z.string().optional(),
  },
  returns: zid('payments'),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.invoiceId);
    if (inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    if (!['draft', 'posted'].includes(inv.state)) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Cannot add payment to invoice in '${inv.state}' state`,
      });
    }

    if (args.amount > inv.amountDue) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Payment amount exceeds amount due',
      });
    }

    const paymentId = await ctx.table('payments').insert({
      amount: args.amount,
      paymentDate: args.paymentDate,
      method: args.method,
      reference: args.reference,
      memo: args.memo,
      state: 'confirmed',
      invoiceId: inv._id,
      companyId: inv.companyId,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    const newAmountDue = Math.round((inv.amountDue - args.amount) * 100) / 100;
    const isPaid = newAmountDue <= 0;

    const patchData: any = {
      amountDue: newAmountDue,
      paymentStatus: isPaid ? 'paid' : 'partially_paid',
    };

    if (isPaid) {
      patchData.state = 'paid';
    } else if (inv.state === 'draft') {
      patchData.state = 'posted';
    }

    await inv.patch(patchData);

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: inv._id as unknown as string,
      action: 'add_payment',
      metadata: { paymentId: paymentId as unknown as string, amount: args.amount },
    });

    return paymentId;
  },
});

export const archive = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);
    if (inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }
    await inv.patch({ archivedAt: Date.now() });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'archive',
    });

    return null;
  },
});

export const unarchive = createOrgMutation()({
  args: { id: zid('invoices') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.id);
    if (inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }
    await inv.patch({ archivedAt: undefined });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'unarchive',
    });

    return null;
  },
});
