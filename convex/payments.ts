import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import { ConvexError } from 'convex/values';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
} from './functions';

const paymentMethodEnum = z.enum([
  'bank_transfer',
  'cash',
  'credit_card',
  'debit_card',
  'e_wallet',
  'cheque',
  'other',
]);

export const list = createOrgPaginatedQuery()({
  args: {
    companyId: zid('companies').optional(),
    method: paymentMethodEnum.optional(),
    search: z.string().optional(),
  },
  returns: z.object({
    page: z.array(z.object({
      id: zid('payments'),
      amount: z.number(),
      paymentDate: z.number(),
      method: paymentMethodEnum,
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
    const { orgId } = ctx;

    // Use organizationId_paymentDate index if available, or just filter
    // Schema shows organizationId_paymentDate index exists
    const all = await ctx.table('payments', 'organizationId_paymentDate', (q) =>
      q.eq('organizationId', orgId)
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

    // Sort by paymentDate desc (index should have it sorted asc by default, so we reverse or sort)
    enriched.sort((a, b) => b.paymentDate - a.paymentDate);

    return {
      page: enriched,
      continueCursor: '',
      isDone: true,
    };
  },
});

export const create = createOrgMutation()({
  args: z.object({
    amount: z.number().min(0.01),
    paymentDate: z.number(),
    method: paymentMethodEnum,
    reference: z.string().optional(),
    memo: z.string().optional(),
    invoiceId: zid('invoices').optional(),
    companyId: zid('companies').optional(),
  }),
  returns: zid('payments'),
  handler: async (ctx, args) => {
    const paymentId = await ctx.table('payments').insert({
      ...args,
      state: 'confirmed',
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    if (args.invoiceId) {
      const invoice = await ctx.table('invoices').getX(args.invoiceId);
      if (invoice.organizationId !== ctx.orgId) {
        throw new ConvexError('Unauthorized');
      }

      const newAmountDue = Math.max(0, invoice.amountDue - args.amount);
      const isFullyPaid = newAmountDue <= 0;

      const updates: any = {
        amountDue: newAmountDue,
        paymentStatus: isFullyPaid ? 'paid' : 'partially_paid',
      };

      if (isFullyPaid) {
        updates.state = 'paid';
      } else if (invoice.state === 'draft') {
        updates.state = 'posted';
      }

      await invoice.patch(updates);
    }

    return paymentId;
  },
});

export const cancel = createOrgMutation()({
  args: { id: zid('payments') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.table('payments').getX(args.id);
    if (payment.organizationId !== ctx.orgId) {
      throw new ConvexError('Unauthorized');
    }

    if (payment.state === 'cancelled') {
      return null;
    }

    await payment.patch({ state: 'cancelled' });

    if (payment.invoiceId) {
      const invoice = await ctx.table('invoices').getX(payment.invoiceId);
      if (invoice.organizationId === ctx.orgId) {
        const newAmountDue = invoice.amountDue + payment.amount;
        const paymentStatus =
          newAmountDue >= invoice.totalAmount ? 'unpaid' : 'partially_paid';

        const updates: any = {
          amountDue: newAmountDue,
          paymentStatus,
        };

        if (invoice.state === 'paid') {
          updates.state = 'posted';
        }

        await invoice.patch(updates);
      }
    }

    return null;
  },
});
