// convex/migrations/seedPluginInstances.ts
// Run via Convex dashboard: Functions → migrations/seedPluginInstances:seedAll → Run
import { mutation } from '../_generated/server';
import { v } from 'convex/values';

export const seedAll = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const orgs = await ctx.db.query('organization').collect();
    let created = 0;

    for (const org of orgs) {
      const existing = await ctx.db
        .query('pluginInstances')
        .filter((q) => q.eq(q.field('organizationId'), org._id))
        .first();

      if (!existing && org.slug) {
        await ctx.db.insert('pluginInstances', {
          organizationId: org._id,
          pluginId: 'ecommerce',
          isActive: false,
          publicSlug: org.slug,
        });
        created++;
      }
    }

    return { total: orgs.length, created };
  },
});
