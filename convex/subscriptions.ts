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
// Enums & Types
// ---------------------------------------------------------------------------

const intervalEnum = z.enum(['weekly', 'monthly', 'quarterly', 'yearly']);
const stateEnum = z.enum(['active', 'paused', 'expired', 'cancelled']);

const lineSchema = z.object({
  id: zid('subscriptionLines'),
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

function calculateInvoiceTotals(
  lineSubtotals: { subtotal: number; taxAmount?: number }[],
  discountAmount?: number,
  discountType?: 'percentage' | 'fixed',
) {
  const subtotal = lineSubtotals.reduce((sum, l) => sum + l.subtotal, 0);
  const taxAmount = lineSubtotals.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);

  let discountTotal = 0;
  if (discountAmount) {
    if (discountType === 'percentage') {
      discountTotal = subtotal * (discountAmount / 100);
    } else {
      discountTotal = discountAmount;
    }
  }

  const totalAmount = Math.round((subtotal - discountTotal) * 100) / 100;
  return { subtotal, taxAmount, discountTotal, totalAmount };
}

function getNextBillingDate(
  current: number,
  interval: string,
  intervalCount: number,
  billingDay: number,
): number {
  const count = intervalCount || 1;
  const d = new Date(current);

  switch (interval) {
    case 'weekly': {
      d.setDate(d.getDate() + 7 * count);
      return d.getTime();
    }
    case 'monthly': {
      d.setMonth(d.getMonth() + count);
      // Clamp to last day of month if billingDay exceeds days in month
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(billingDay, maxDay));
      return d.getTime();
    }
    case 'quarterly': {
      d.setMonth(d.getMonth() + 3 * count);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(billingDay, maxDay));
      return d.getTime();
    }
    case 'yearly': {
      d.setFullYear(d.getFullYear() + count);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(billingDay, maxDay));
      return d.getTime();
    }
    default:
      return d.getTime();
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = createOrgPaginatedQuery()({
  args: {
    search: z.string().optional(),
    state: stateEnum.optional(),
    companyId: zid('companies').optional(),
    includeArchived: z.boolean().optional(),
  },
  returns: z.object({
    page: z.array(z.object({
      id: zid('subscriptionTemplates'),
      name: z.string(),
      description: z.string().optional(),
      interval: intervalEnum,
      intervalCount: z.number().optional(),
      billingDay: z.number(),
      startDate: z.number(),
      endDate: z.number().optional(),
      autoGenerateInvoice: z.boolean().optional(),
      autoPostInvoice: z.boolean().optional(),
      numberOfInvoices: z.number().optional(),
      generatedCount: z.number().optional(),
      nextBillingDate: z.number().optional(),
      currency: z.string().optional(),
      notes: z.string().optional(),
      discountAmount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      paymentTermId: zid('paymentTerms').optional(),
      state: stateEnum.optional(),
      archivedAt: z.number().optional(),
      companyId: zid('companies').optional(),
      contactId: zid('contacts').optional(),
      organizationId: zid('organization'),
      ownerId: zid('user'),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      lineCount: z.number(),
    })),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    let result;
    if (args.search) {
      result = await ctx
        .table('subscriptionTemplates')
        .search('search_subscriptions', (q: any) =>
          q.search('name', args.search!).eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    } else if (args.companyId) {
      // Filter by company via index, then paginate
      result = await ctx
        .table('subscriptionTemplates', 'organizationId_state', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    } else if (args.state) {
      result = await ctx
        .table('subscriptionTemplates', 'organizationId_state', (q: any) =>
          q.eq('organizationId', orgId).eq('state', args.state)
        )
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('subscriptionTemplates', 'organizationId_state', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .order('desc')
        .paginate(args.paginationOpts);
    }

    let page = result.page as any[];

    if (!args.includeArchived) {
      page = page.filter((t: any) => !t.archivedAt);
    }

    if (args.companyId) {
      page = page.filter((t: any) => t.companyId === args.companyId);
    }

    // Resolve names + line counts
    const companyIds = [...new Set(page.map((t: any) => t.companyId).filter(Boolean))];
    const contactIds = [...new Set(page.map((t: any) => t.contactId).filter(Boolean))];
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

    const pagesWithCounts = await Promise.all(
      page.map(async (t: any) => {
        const lines = await t.edge('lines');
        return {
          id: t._id,
          name: t.name,
          description: t.description,
          interval: t.interval,
          intervalCount: t.intervalCount,
          billingDay: t.billingDay,
          startDate: t.startDate,
          endDate: t.endDate,
          autoGenerateInvoice: t.autoGenerateInvoice,
          autoPostInvoice: t.autoPostInvoice,
          numberOfInvoices: t.numberOfInvoices,
          generatedCount: t.generatedCount,
          nextBillingDate: t.nextBillingDate,
          currency: t.currency,
          notes: t.notes,
          discountAmount: t.discountAmount,
          discountType: t.discountType,
          paymentTermId: t.paymentTermId,
          state: t.state,
          archivedAt: t.archivedAt,
          companyId: t.companyId,
          contactId: t.contactId,
          organizationId: t.organizationId,
          ownerId: t.ownerId,
          companyName: t.companyId ? companyMap.get(t.companyId) : undefined,
          contactName: t.contactId ? contactMap.get(t.contactId) : undefined,
          lineCount: lines.length,
        };
      })
    );

    return {
      page: pagesWithCounts,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getById = createOrgQuery()({
  args: { id: zid('subscriptionTemplates') },
  returns: z.object({
    id: zid('subscriptionTemplates'),
    name: z.string(),
    description: z.string().optional(),
    interval: intervalEnum,
    intervalCount: z.number().optional(),
    billingDay: z.number(),
    startDate: z.number(),
    endDate: z.number().optional(),
    autoGenerateInvoice: z.boolean().optional(),
    autoPostInvoice: z.boolean().optional(),
    numberOfInvoices: z.number().optional(),
    generatedCount: z.number().optional(),
    nextBillingDate: z.number().optional(),
    currency: z.string().optional(),
    notes: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    paymentTermId: zid('paymentTerms').optional(),
    state: stateEnum.optional(),
    archivedAt: z.number().optional(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    organizationId: zid('organization'),
    ownerId: zid('user'),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    lines: z.array(lineSchema),
    generatedInvoices: z.array(z.object({
      id: zid('invoices'),
      number: z.string(),
      state: z.enum(['draft', 'posted', 'paid', 'cancel']),
      invoiceDate: z.number(),
      totalAmount: z.number(),
      currency: z.string().optional(),
    })),
  }),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').get(args.id);
    if (!sub || sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }

    const lines = await sub.edge('lines');
    const generatedInvoices = await sub.edge('generatedInvoices');

    let companyName: string | undefined;
    if (sub.companyId) {
      const c = await ctx.table('companies').get(sub.companyId);
      companyName = c?.name;
    }

    let contactName: string | undefined;
    if (sub.contactId) {
      const c = await ctx.table('contacts').get(sub.contactId);
      contactName = c?.fullName;
    }

    return {
      id: sub._id,
      name: sub.name,
      description: sub.description,
      interval: sub.interval,
      intervalCount: sub.intervalCount,
      billingDay: sub.billingDay,
      startDate: sub.startDate,
      endDate: sub.endDate,
      autoGenerateInvoice: sub.autoGenerateInvoice,
      autoPostInvoice: sub.autoPostInvoice,
      numberOfInvoices: sub.numberOfInvoices,
      generatedCount: sub.generatedCount,
      nextBillingDate: sub.nextBillingDate,
      currency: sub.currency,
      notes: sub.notes,
      discountAmount: sub.discountAmount,
      discountType: sub.discountType,
      paymentTermId: sub.paymentTermId,
      state: sub.state,
      archivedAt: sub.archivedAt,
      companyId: sub.companyId,
      contactId: sub.contactId,
      organizationId: sub.organizationId,
      ownerId: sub.ownerId,
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
      generatedInvoices: generatedInvoices.map((inv: any) => ({
        id: inv._id,
        number: inv.number,
        state: inv.state,
        invoiceDate: inv.invoiceDate,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = createOrgMutation()({
  args: {
    name: z.string().min(1),
    description: z.string().optional(),
    interval: intervalEnum,
    intervalCount: z.number().min(1).optional(),
    billingDay: z.number().min(1).max(28),
    startDate: z.number(),
    endDate: z.number().optional(),
    autoGenerateInvoice: z.boolean().optional(),
    autoPostInvoice: z.boolean().optional(),
    numberOfInvoices: z.number().min(1).optional(),
    currency: z.string().optional(),
    notes: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    paymentTermId: zid('paymentTerms').optional(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
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
  returns: zid('subscriptionTemplates'),
  handler: async (ctx, args) => {
    const lineSubtotals = args.lines.map((line) => ({
      ...line,
      subtotal: calculateLineSubtotal(line),
    }));

    // Calculate first nextBillingDate
    const start = new Date(args.startDate);
    const firstBilling = new Date(start.getFullYear(), start.getMonth(), args.billingDay);
    const nextBillingDate = firstBilling.getTime() >= args.startDate
      ? firstBilling.getTime()
      : getNextBillingDate(firstBilling.getTime(), args.interval, args.intervalCount || 1, args.billingDay);

    const subId = await ctx.table('subscriptionTemplates').insert({
      name: args.name,
      description: args.description,
      interval: args.interval,
      intervalCount: args.intervalCount,
      billingDay: args.billingDay,
      startDate: args.startDate,
      endDate: args.endDate,
      autoGenerateInvoice: args.autoGenerateInvoice,
      autoPostInvoice: args.autoPostInvoice,
      numberOfInvoices: args.numberOfInvoices,
      generatedCount: 0,
      nextBillingDate,
      currency: args.currency,
      notes: args.notes,
      discountAmount: args.discountAmount,
      discountType: args.discountType,
      paymentTermId: args.paymentTermId,
      state: 'active',
      companyId: args.companyId,
      contactId: args.contactId,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of lineSubtotals) {
      await ctx.table('subscriptionLines').insert({
        ...line,
        subscriptionTemplateId: subId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: subId as unknown as string,
      action: 'subscription.create',
      after: { name: args.name, interval: args.interval, lineCount: args.lines.length },
    });

    return subId;
  },
});

export const update = createOrgMutation()({
  args: {
    id: zid('subscriptionTemplates'),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    interval: intervalEnum.optional(),
    intervalCount: z.number().min(1).optional(),
    billingDay: z.number().min(1).max(28).optional(),
    startDate: z.number().optional(),
    endDate: z.number().optional(),
    autoGenerateInvoice: z.boolean().optional(),
    autoPostInvoice: z.boolean().optional(),
    numberOfInvoices: z.number().min(1).optional(),
    currency: z.string().optional(),
    notes: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    paymentTermId: zid('paymentTerms').optional(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    lines: z.optional(z.array(z.object({
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      productId: zid('products').optional(),
      taxId: zid('taxes').optional(),
    })).min(1)),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, lines: newLines, ...updates } = args;
    const sub = await ctx.table('subscriptionTemplates').getX(id);
    if (sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }

    if (sub.state === 'cancelled') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Cannot update a cancelled subscription',
      });
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Replace lines if provided
    if (newLines) {
      const existingLines = await sub.edge('lines');
      for (const line of existingLines) {
        await (line as any).delete();
      }
      const lineSubtotals = newLines.map((line) => ({
        ...line,
        subtotal: calculateLineSubtotal(line),
      }));
      for (const line of lineSubtotals) {
        await ctx.table('subscriptionLines').insert({
          ...line,
          subscriptionTemplateId: id,
          organizationId: ctx.orgId,
        });
      }
    }

    await sub.patch(cleanUpdates);

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: id as unknown as string,
      action: 'subscription.update',
      after: cleanUpdates,
    });

    return null;
  },
});

export const pause = createOrgMutation()({
  args: { id: zid('subscriptionTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').getX(args.id);
    if (sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }
    if (sub.state !== 'active') {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Can only pause active subscriptions' });
    }

    await sub.patch({ state: 'paused' });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'subscription.pause',
      before: { state: 'active' },
      after: { state: 'paused' },
    });

    return null;
  },
});

export const resume = createOrgMutation()({
  args: { id: zid('subscriptionTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').getX(args.id);
    if (sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }
    if (sub.state !== 'paused') {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Can only resume paused subscriptions' });
    }

    await sub.patch({ state: 'active' });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'subscription.resume',
      before: { state: 'paused' },
      after: { state: 'active' },
    });

    return null;
  },
});

export const cancel = createOrgMutation()({
  args: { id: zid('subscriptionTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').getX(args.id);
    if (sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }
    if (sub.state === 'cancelled') {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Already cancelled' });
    }

    await sub.patch({ state: 'cancelled', nextBillingDate: undefined });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'subscription.cancel',
      before: { state: sub.state },
      after: { state: 'cancelled' },
    });

    return null;
  },
});

export const archive = createOrgMutation()({
  args: { id: zid('subscriptionTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').getX(args.id);
    if (sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }
    await sub.patch({ archivedAt: Date.now() });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'subscription.archive',
    });

    return null;
  },
});

export const unarchive = createOrgMutation()({
  args: { id: zid('subscriptionTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').getX(args.id);
    if (sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }
    await sub.patch({ archivedAt: undefined });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: args.id as unknown as string,
      action: 'subscription.unarchive',
    });

    return null;
  },
});

export const generateInvoice = createOrgMutation()({
  args: { id: zid('subscriptionTemplates') },
  returns: zid('invoices'),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').getX(args.id);
    if (sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }
    if (sub.state !== 'active') {
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Can only generate invoices for active subscriptions' });
    }

    // Check invoice limit
    const generatedCount = (sub.generatedCount ?? 0) + 1;
    if (sub.numberOfInvoices && generatedCount > sub.numberOfInvoices) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Invoice limit reached for this subscription',
      });
    }

    // Check end date
    if (sub.endDate && Date.now() > sub.endDate) {
      await sub.patch({ state: 'expired' });
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Subscription has expired' });
    }

    const now = Date.now();
    const invoiceDate = sub.nextBillingDate ?? now;
    const number = await nextSequence(ctx, ctx.orgId, 'invoice', invoiceDate);

    // Copy lines from template
    const templateLines = await sub.edge('lines');
    const lineSubtotals = templateLines.map((l: any) => ({
      productName: l.productName,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      discountType: l.discountType,
      taxAmount: l.taxAmount,
      subtotal: calculateLineSubtotal({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        taxAmount: l.taxAmount,
      }),
      productId: l.productId,
      taxId: l.taxId,
    }));

    const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals(
      lineSubtotals, sub.discountAmount, sub.discountType
    );

    // Calculate due date
    let dueDate = invoiceDate + 30 * 24 * 60 * 60 * 1000; // Default 30 days
    if (sub.paymentTermId) {
      const term = await ctx.table('paymentTerms').get(sub.paymentTermId);
      if (term) {
        dueDate = invoiceDate + term.dueDays * 24 * 60 * 60 * 1000;
      }
    }

    const shouldPost = sub.autoPostInvoice ?? false;

    const invId = await ctx.table('invoices').insert({
      number,
      type: 'customer_invoice',
      state: shouldPost ? 'posted' : 'draft',
      invoiceDate,
      dueDate,
      subtotal,
      discountAmount: sub.discountAmount,
      discountType: sub.discountType,
      taxAmount,
      totalAmount,
      amountDue: totalAmount,
      currency: sub.currency,
      paymentStatus: 'unpaid',
      paymentTermId: sub.paymentTermId,
      source: 'manual',
      notes: sub.notes,
      companyId: sub.companyId,
      contactId: sub.contactId,
      subscriptionTemplateId: sub._id,
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

    // Calculate next billing date
    const nextBillingDate = getNextBillingDate(
      invoiceDate,
      sub.interval,
      sub.intervalCount ?? 1,
      sub.billingDay,
    );

    // Check if subscription should expire
    const isExpired = sub.numberOfInvoices && generatedCount >= sub.numberOfInvoices;
    const isDateExpired = sub.endDate && nextBillingDate > sub.endDate;

    await sub.patch({
      generatedCount,
      nextBillingDate: (isExpired || isDateExpired) ? undefined : nextBillingDate,
      state: (isExpired || isDateExpired) ? 'expired' : sub.state,
    });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'invoice',
      entityId: invId as unknown as string,
      action: 'subscription.generate_invoice',
      metadata: {
        subscriptionId: args.id as unknown as string,
        invoiceNumber: number,
        totalAmount,
        autoPosted: shouldPost,
      },
    });

    return invId;
  },
});

export const previewNext = createOrgQuery()({
  args: { id: zid('subscriptionTemplates') },
  returns: z.object({
    nextBillingDate: z.number().optional(),
    interval: intervalEnum,
    intervalCount: z.number().optional(),
    billingDay: z.number(),
    generatedCount: z.number().optional(),
    numberOfInvoices: z.number().optional(),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    lines: z.array(z.object({
      productName: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      subtotal: z.number(),
    })),
    subtotal: z.number(),
    taxAmount: z.number(),
    totalAmount: z.number(),
    currency: z.string().optional(),
    upcomingDates: z.array(z.number()),
  }),
  handler: async (ctx, args) => {
    const sub = await ctx.table('subscriptionTemplates').get(args.id);
    if (!sub || sub.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Subscription not found' });
    }

    const lines = await sub.edge('lines');

    let companyName: string | undefined;
    if (sub.companyId) {
      const c = await ctx.table('companies').get(sub.companyId);
      companyName = c?.name;
    }

    let contactName: string | undefined;
    if (sub.contactId) {
      const c = await ctx.table('contacts').get(sub.contactId);
      contactName = c?.fullName;
    }

    const lineSubtotals = lines.map((l: any) => ({
      productName: l.productName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      discountType: l.discountType,
      taxAmount: l.taxAmount,
      subtotal: calculateLineSubtotal({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        taxAmount: l.taxAmount,
      }),
    }));

    const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals(
      lineSubtotals, sub.discountAmount, sub.discountType
    );

    // Calculate next 3 billing dates
    const upcomingDates: number[] = [];
    let current = sub.nextBillingDate ?? sub.startDate;
    for (let i = 0; i < 3; i++) {
      current = getNextBillingDate(current, sub.interval, sub.intervalCount ?? 1, sub.billingDay);
      upcomingDates.push(current);
    }

    return {
      nextBillingDate: sub.nextBillingDate,
      interval: sub.interval,
      intervalCount: sub.intervalCount,
      billingDay: sub.billingDay,
      generatedCount: sub.generatedCount,
      numberOfInvoices: sub.numberOfInvoices,
      companyName,
      contactName,
      lines: lineSubtotals,
      subtotal,
      taxAmount,
      totalAmount,
      currency: sub.currency,
      upcomingDates,
    };
  },
});

export const checkDueSubscriptions = createOrgQuery()({
  args: {},
  returns: z.array(z.object({
    id: zid('subscriptionTemplates'),
    name: z.string(),
    interval: intervalEnum,
    nextBillingDate: z.number().optional(),
    generatedCount: z.number().optional(),
    numberOfInvoices: z.number().optional(),
  })),
  handler: async (ctx) => {
    const now = Date.now();

    const due = await ctx
      .table('subscriptionTemplates', 'organizationId_nextBillingDate', (q: any) =>
        q.eq('organizationId', ctx.orgId).lte('nextBillingDate', now)
      )
      .filter((q: any) => q.eq(q.field('state'), 'active'))
      .take(50);

    return due.map((sub: any) => ({
      id: sub._id,
      name: sub.name,
      interval: sub.interval,
      nextBillingDate: sub.nextBillingDate,
      generatedCount: sub.generatedCount,
      numberOfInvoices: sub.numberOfInvoices,
    }));
  },
});
