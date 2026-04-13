import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import {
  createInternalMutation,
  createOrgMutation,
  createOrgQuery,
} from './functions';
import { createAuditLog } from './auditLogs';
import { SEQUENCE_PREFIXES, nextSequence } from './shared/sequenceGenerator';

// ---------------------------------------------------------------------------
// Enums & Types
// ---------------------------------------------------------------------------

const statusEnum = z.enum(['active', 'paused', 'expired']);
const frequencyEnum = z.enum(['weekly', 'monthly', 'quarterly', 'yearly']);

const lineSchema = z.object({
  productName: z.string(),
  description: z.string().optional(),
  quantity: z.number().min(0.01),
  unitPrice: z.number(),
  discount: z.number().min(0).optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  productId: zid('products').optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateNextDate(current: number, frequency: string): number {
  const d = new Date(current);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.getTime();
}

// Add sequence prefix for recurring invoices
const EXTENDED_PREFIXES = {
  ...SEQUENCE_PREFIXES,
  recurringInvoice: 'RI',
} as const;

async function nextRecurringInvoiceNumber(
  ctx: { table: any },
  organizationId: string,
  date: number = Date.now(),
): Promise<string> {
  const prefix = 'RI';
  const year = new Date(date).getFullYear();

  const existing = await ctx
    .table('sequences', 'organizationId_prefix_year', (q: any) =>
      q.eq('organizationId', organizationId).eq('prefix', prefix).eq('year', year),
    )
    .first();

  if (existing) {
    const newCounter = existing.counter + 1;
    await existing.patch({ counter: newCounter });
    return `${prefix}-${year}-${String(newCounter).padStart(4, '0')}`;
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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = createOrgQuery()({
  args: {
    status: statusEnum.optional(),
    search: z.string().optional(),
  },
  returns: z.array(
    z.object({
      id: zid('recurringInvoices'),
      number: z.string(),
      name: z.string().optional(),
      status: statusEnum,
      frequency: frequencyEnum,
      nextInvoiceDate: z.number(),
      startDate: z.number(),
      endDate: z.number().optional(),
      maxOccurrences: z.number().optional(),
      occurredCount: z.number(),
      totalAmount: z.number(),
      currency: z.string().optional(),
      companyId: zid('companies').optional(),
      contactId: zid('contacts').optional(),
      organizationId: zid('organization'),
      ownerId: zid('user'),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
    }),
  ),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    let recurringInvoices: any[];

    if (args.status) {
      recurringInvoices = await ctx
        .table('recurringInvoices', 'organizationId_status', (q: any) =>
          q.eq('organizationId', orgId).eq('status', args.status!),
        )
        .order('desc');
    } else {
      recurringInvoices = await ctx
        .table('recurringInvoices', 'organizationId_nextInvoiceDate', (q: any) =>
          q.eq('organizationId', orgId),
        )
        .order('desc');
    }

    // Resolve names
    const companyIds = [...new Set(recurringInvoices.map((ri: any) => ri.companyId).filter(Boolean))];
    const contactIds = [...new Set(recurringInvoices.map((ri: any) => ri.contactId).filter(Boolean))];
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

    return recurringInvoices.map((ri: any) => ({
      id: ri._id,
      number: ri.number,
      name: ri.name,
      status: ri.status,
      frequency: ri.frequency,
      nextInvoiceDate: ri.nextInvoiceDate,
      startDate: ri.startDate,
      endDate: ri.endDate,
      maxOccurrences: ri.maxOccurrences,
      occurredCount: ri.occurredCount,
      totalAmount: ri.totalAmount,
      currency: ri.currency,
      companyId: ri.companyId,
      contactId: ri.contactId,
      organizationId: ri.organizationId,
      ownerId: ri.ownerId,
      companyName: ri.companyId ? companyMap.get(ri.companyId) : undefined,
      contactName: ri.contactId ? contactMap.get(ri.contactId) : undefined,
    }));
  },
});

export const getById = createOrgQuery()({
  args: { id: zid('recurringInvoices') },
  returns: z.object({
    id: zid('recurringInvoices'),
    number: z.string(),
    name: z.string().optional(),
    status: statusEnum,
    frequency: frequencyEnum,
    nextInvoiceDate: z.number(),
    startDate: z.number(),
    endDate: z.number().optional(),
    maxOccurrences: z.number().optional(),
    occurredCount: z.number(),
    type: z.literal('customer_invoice'),
    subtotal: z.number(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    taxAmount: z.number().optional(),
    totalAmount: z.number(),
    currency: z.string().optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    paymentTermId: zid('paymentTerms').optional(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    organizationId: zid('organization'),
    ownerId: zid('user'),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    lines: z.array(
      z.object({
        id: zid('recurringInvoiceLines'),
        productName: z.string(),
        description: z.string().optional(),
        quantity: z.number(),
        unitPrice: z.number(),
        discount: z.number().optional(),
        discountType: z.enum(['percentage', 'fixed']).optional(),
        productId: zid('products').optional(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const ri = await ctx.table('recurringInvoices').get(args.id);
    if (!ri || ri.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Recurring invoice not found' });
    }

    const lines = await ri.edge('lines');

    let companyName: string | undefined;
    if (ri.companyId) {
      const c = await ctx.table('companies').get(ri.companyId);
      companyName = c?.name;
    }

    let contactName: string | undefined;
    if (ri.contactId) {
      const c = await ctx.table('contacts').get(ri.contactId);
      contactName = c?.fullName;
    }

    return {
      id: ri._id,
      number: ri.number,
      name: ri.name,
      status: ri.status,
      frequency: ri.frequency,
      nextInvoiceDate: ri.nextInvoiceDate,
      startDate: ri.startDate,
      endDate: ri.endDate,
      maxOccurrences: ri.maxOccurrences,
      occurredCount: ri.occurredCount,
      type: ri.type,
      subtotal: ri.subtotal,
      discountAmount: ri.discountAmount,
      discountType: ri.discountType,
      taxAmount: ri.taxAmount,
      totalAmount: ri.totalAmount,
      currency: ri.currency,
      notes: ri.notes,
      internalNotes: ri.internalNotes,
      paymentTermId: ri.paymentTermId,
      companyId: ri.companyId,
      contactId: ri.contactId,
      organizationId: ri.organizationId,
      ownerId: ri.ownerId,
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
        productId: l.productId,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = createOrgMutation()({
  args: {
    name: z.string().optional(),
    frequency: frequencyEnum,
    startDate: z.number(),
    endDate: z.number().optional(),
    maxOccurrences: z.number().optional(),
    nextInvoiceDate: z.number(),
    companyId: zid('companies').optional(),
    contactId: zid('contacts').optional(),
    currency: z.string().optional(),
    paymentTermId: zid('paymentTerms').optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    lines: z.array(lineSchema).min(1),
  },
  returns: zid('recurringInvoices'),
  handler: async (ctx, args) => {
    const number = await nextRecurringInvoiceNumber(ctx, ctx.orgId, args.startDate);

    // Calculate subtotal & totals
    let subtotal = 0;
    for (const line of args.lines) {
      let lineTotal = line.quantity * line.unitPrice;
      if (line.discount) {
        if (line.discountType === 'percentage') {
          lineTotal -= lineTotal * (line.discount / 100);
        } else {
          lineTotal -= line.discount;
        }
      }
      subtotal += lineTotal;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    let discountTotal = 0;
    if (args.discountAmount) {
      if (args.discountType === 'percentage') {
        discountTotal = subtotal * (args.discountAmount / 100);
      } else {
        discountTotal = args.discountAmount;
      }
    }
    const totalAmount = Math.round((subtotal - discountTotal) * 100) / 100;

    const riId = await ctx.table('recurringInvoices').insert({
      number,
      name: args.name,
      status: 'active',
      frequency: args.frequency,
      nextInvoiceDate: args.nextInvoiceDate,
      startDate: args.startDate,
      endDate: args.endDate,
      maxOccurrences: args.maxOccurrences,
      occurredCount: 0,
      type: 'customer_invoice',
      subtotal,
      discountAmount: args.discountAmount,
      discountType: args.discountType,
      totalAmount,
      currency: args.currency,
      notes: args.notes,
      internalNotes: args.internalNotes,
      paymentTermId: args.paymentTermId,
      companyId: args.companyId,
      contactId: args.contactId,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of args.lines) {
      await ctx.table('recurringInvoiceLines').insert({
        productName: line.productName,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        discountType: line.discountType,
        productId: line.productId,
        recurringInvoiceId: riId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'recurringInvoice',
      entityId: riId as unknown as string,
      action: 'create',
      after: { number, totalAmount, frequency: args.frequency, lineCount: args.lines.length },
    });

    return riId;
  },
});

export const pause = createOrgMutation()({
  args: { id: zid('recurringInvoices') },
  returns: zid('recurringInvoices'),
  handler: async (ctx, args) => {
    const ri = await ctx.table('recurringInvoices').getX(args.id);
    if (ri.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Recurring invoice not found' });
    }
    if (ri.status !== 'active') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Can only pause active recurring invoices',
      });
    }
    await ri.patch({ status: 'paused' });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'recurringInvoice',
      entityId: args.id as unknown as string,
      action: 'update',
      after: { number: ri.number, status: 'paused' },
    });

    return args.id;
  },
});

export const resume = createOrgMutation()({
  args: { id: zid('recurringInvoices') },
  returns: zid('recurringInvoices'),
  handler: async (ctx, args) => {
    const ri = await ctx.table('recurringInvoices').getX(args.id);
    if (ri.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Recurring invoice not found' });
    }
    if (ri.status !== 'paused') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Can only resume paused recurring invoices',
      });
    }
    await ri.patch({ status: 'active' });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'recurringInvoice',
      entityId: args.id as unknown as string,
      action: 'update',
      after: { number: ri.number, status: 'active' },
    });

    return args.id;
  },
});

export const cancel = createOrgMutation()({
  args: { id: zid('recurringInvoices') },
  returns: zid('recurringInvoices'),
  handler: async (ctx, args) => {
    const ri = await ctx.table('recurringInvoices').getX(args.id);
    if (ri.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Recurring invoice not found' });
    }
    if (ri.status === 'expired') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Recurring invoice is already expired',
      });
    }
    await ri.patch({ status: 'expired' });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'recurringInvoice',
      entityId: args.id as unknown as string,
      action: 'update',
      after: { number: ri.number, status: 'expired' },
    });

    return args.id;
  },
});

// ---------------------------------------------------------------------------
// Cron: Process due recurring invoices
// ---------------------------------------------------------------------------

export const processDueRecurringInvoices = createInternalMutation()({
  args: {},
  returns: z.number(),
  handler: async (ctx) => {
    const now = Date.now();

    // Find all recurring invoices where nextInvoiceDate <= now
    const dueRecurring = await ctx
      .table('recurringInvoices', 'nextInvoiceDate', (q: any) =>
        q.lte('nextInvoiceDate', now),
      );

    // Filter to active ones
    const activeRecurring = dueRecurring.filter((ri: any) => ri.status === 'active');

    let processedCount = 0;

    for (const ri of activeRecurring) {
      // Check maxOccurrences
      if (ri.maxOccurrences && ri.occurredCount >= ri.maxOccurrences) {
        await ri.patch({ status: 'expired' });
        continue;
      }

      // Check endDate
      if (ri.endDate && ri.nextInvoiceDate > ri.endDate) {
        await ri.patch({ status: 'expired' });
        continue;
      }

      // Get lines from recurring invoice
      const lines = await ri.edge('lines');

      // Generate invoice number
      const invNumber = await nextSequence(ctx, ri.organizationId, 'invoice', ri.nextInvoiceDate);

      // Calculate due date: 30 days from now (default)
      const dueDate = Date.now() + 30 * 24 * 60 * 60 * 1000;

      // Calculate line subtotals
      let subtotal = 0;
      const lineData: any[] = [];

      for (const line of lines) {
        let lineTotal = line.quantity * line.unitPrice;
        if (line.discount) {
          if (line.discountType === 'percentage') {
            lineTotal -= lineTotal * (line.discount / 100);
          } else {
            lineTotal -= line.discount;
          }
        }
        lineTotal = Math.round(lineTotal * 100) / 100;
        subtotal += lineTotal;

        lineData.push({
          ...line,
          subtotal: lineTotal,
        });
      }

      subtotal = Math.round(subtotal * 100) / 100;

      let discountTotal = 0;
      if (ri.discountAmount) {
        if (ri.discountType === 'percentage') {
          discountTotal = subtotal * (ri.discountAmount / 100);
        } else {
          discountTotal = ri.discountAmount;
        }
      }
      const totalAmount = Math.round((subtotal - discountTotal) * 100) / 100;

      // Create draft invoice
      const invId = await ctx.table('invoices').insert({
        number: invNumber,
        type: 'customer_invoice',
        state: 'draft',
        invoiceDate: ri.nextInvoiceDate,
        dueDate,
        subtotal,
        discountAmount: ri.discountAmount,
        discountType: ri.discountType,
        totalAmount,
        amountDue: totalAmount,
        currency: ri.currency,
        paymentStatus: 'unpaid',
        source: 'manual',
        notes: ri.notes,
        internalNotes: ri.internalNotes,
        paymentTermId: ri.paymentTermId,
        recurringInvoiceId: ri._id,
        companyId: ri.companyId,
        contactId: ri.contactId,
        organizationId: ri.organizationId,
        ownerId: ri.ownerId,
      });

      // Create invoice lines
      for (const ld of lineData) {
        await ctx.table('invoiceLines').insert({
          productName: ld.productName,
          description: ld.description,
          quantity: ld.quantity,
          unitPrice: ld.unitPrice,
          discount: ld.discount,
          discountType: ld.discountType,
          subtotal: ld.subtotal,
          productId: ld.productId,
          invoiceId: invId,
          organizationId: ri.organizationId,
        });
      }

      // Calculate next invoice date
      const nextDate = calculateNextDate(ri.nextInvoiceDate, ri.frequency);
      const newOccurredCount = ri.occurredCount + 1;

      // Check if this was the last occurrence
      const isExpired =
        (ri.maxOccurrences && newOccurredCount >= ri.maxOccurrences) ||
        (ri.endDate && nextDate > ri.endDate);

      await ri.patch({
        occurredCount: newOccurredCount,
        nextInvoiceDate: nextDate,
        ...(isExpired ? { status: 'expired' as const } : {}),
      });

      processedCount++;
    }

    return processedCount;
  },
});
