// Run via: npx convex run migrations/activateAllPlugins:fixExistingProducts '{}'
import { mutation } from '../_generated/server';

export const fixExistingProducts = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const products = await ctx.db.query('products').collect();
    let fixed = 0;

    for (const p of products) {
      if (p.visibleInShop !== true) {
        await ctx.db.patch(p._id, { visibleInShop: true });
        fixed++;
      }
    }

    return { total: products.length, fixed };
  },
});
