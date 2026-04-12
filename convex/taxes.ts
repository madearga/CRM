import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
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
    const all = await ctx.table('taxes').take(100);
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
    name: z.string().min(1).optional(),
    rate: z.number().min(0).optional(),
    type: z.enum(['percentage', 'fixed']).optional(),
    scope: z.enum(['sales', 'purchase', 'both']).optional(),
    active: z.boolean().optional(),
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
