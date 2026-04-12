import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import { ConvexError } from 'convex/values';
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
      if (pt.organizationId !== ctx.orgId) return false;
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
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    dueDays: z.number().int().min(0).optional(),
    discountDays: z.number().int().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const pt = await ctx.table('paymentTerms').getX(id);
    if (pt.organizationId !== ctx.orgId) {
      throw new ConvexError('Unauthorized');
    }
    await pt.patch(updates);
    return null;
  },
});

export const remove = createOrgMutation()({
  args: { id: zid('paymentTerms') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const pt = await ctx.table('paymentTerms').getX(args.id);
    if (pt.organizationId !== ctx.orgId) {
      throw new ConvexError('Unauthorized');
    }
    await pt.delete();
    return null;
  },
});
