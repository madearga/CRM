import { z } from 'zod';
import { ConvexError } from 'convex/values';
import {
  createOrgQuery,
  createOrgMutation,
  createPublicQuery,
} from './functions';

// Reserved slugs that conflict with dashboard/api routes
const RESERVED_SLUGS = [
  'dashboard', 'settings', 'products', 'companies', 'contacts', 'deals',
  'invoices', 'payments', 'sales', 'sales-orders', 'subscriptions',
  'templates', 'activities', 'analytics', 'api', 'invite', 'login',
  'org', 'shop', 'admin', 'onboarding', 'auth', 'callback',
  '_next', 'static', 'favicon', 'robots', 'sitemap', 'manifest',
];

function validateSlugNotReserved(slug: string) {
  if (RESERVED_SLUGS.includes(slug)) {
    throw new ConvexError({
      code: 'BAD_REQUEST',
      message: `Slug "${slug}" tidak tersedia (reserved)`,
    });
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all plugin instances for current org. */
export const list = createOrgQuery()({
  args: {},
  returns: z.array(
    z.object({
      id: z.string(),
      pluginId: z.string(),
      isActive: z.boolean(),
      publicSlug: z.string().optional(),
      settings: z.any().optional(),
    })
  ),
  handler: async (ctx, _args) => {
    const instances = await ctx
      .table('pluginInstances', 'organizationId', (q) =>
        q.eq('organizationId', ctx.orgId)
      );
    return instances.map((p) => ({
      id: p._id,
      pluginId: p.pluginId,
      isActive: p.isActive,
      publicSlug: p.publicSlug ?? undefined,
      settings: p.settings ?? undefined,
    }));
  },
});

/** Get active plugin IDs for current org. */
export const getActive = createOrgQuery()({
  args: {},
  returns: z.array(z.string()),
  handler: async (ctx, _args) => {
    const instances = await ctx
      .table('pluginInstances', 'organizationId', (q) =>
        q.eq('organizationId', ctx.orgId)
      );
    return instances
      .filter((p) => p.isActive)
      .map((p) => p.pluginId);
  },
});

/** Resolve plugin instance by public slug (public — no auth required). */
export const getBySlug = createPublicQuery()({
  args: { publicSlug: z.string() },
  returns: z
    .object({
      pluginId: z.string(),
      isActive: z.boolean(),
      publicSlug: z.string().optional(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    const instance = await ctx
      .table('pluginInstances', 'publicSlug', (q) =>
        q.eq('publicSlug', args.publicSlug)
      )
      .first();
    if (!instance) return null;
    return {
      pluginId: instance.pluginId,
      isActive: instance.isActive,
      publicSlug: instance.publicSlug ?? undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** Create or update a plugin instance for current org. */
export const upsert = createOrgMutation()({
  args: {
    pluginId: z.string(),
    isActive: z.boolean().optional(),
    publicSlug: z.string().optional(),
    settings: z.any().optional(),
  },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    // Server-side slug format + reserved validation
    if (args.publicSlug !== undefined && args.publicSlug !== '') {
      if (!SLUG_REGEX.test(args.publicSlug)) {
        throw new ConvexError({
          code: 'BAD_REQUEST',
          message: 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (min 2 karakter)',
        });
      }
      validateSlugNotReserved(args.publicSlug);
    }

    const existing = await ctx
      .table('pluginInstances', 'organizationId_pluginId', (q) =>
        q.eq('organizationId', ctx.orgId).eq('pluginId', args.pluginId)
      )
      .first();

    if (existing) {
      // Validate slug uniqueness if changing
      if (args.publicSlug !== undefined && args.publicSlug !== existing.publicSlug) {
        const slugTaken = await ctx
          .table('pluginInstances', 'publicSlug', (q) =>
            q.eq('publicSlug', args.publicSlug!)
          )
          .first();
        if (slugTaken && slugTaken._id !== existing._id) {
          throw new ConvexError({
            code: 'CONFLICT',
            message: `Slug "${args.publicSlug}" sudah digunakan toko lain`,
          });
        }
      }
      await existing.patch({
        ...(args.isActive !== undefined && { isActive: args.isActive }),
        ...(args.publicSlug !== undefined && { publicSlug: args.publicSlug }),
        ...(args.settings !== undefined && { settings: args.settings }),
      });
    } else {
      // Validate slug uniqueness
      if (args.publicSlug) {
        const slugTaken = await ctx
          .table('pluginInstances', 'publicSlug', (q) =>
            q.eq('publicSlug', args.publicSlug!)
          )
          .first();
        if (slugTaken) {
          throw new ConvexError({
            code: 'CONFLICT',
            message: `Slug "${args.publicSlug}" sudah digunakan toko lain`,
          });
        }
      }
      const insertedId = await ctx.table('pluginInstances').insert({
        organizationId: ctx.orgId,
        pluginId: args.pluginId,
        isActive: args.isActive ?? true,
        publicSlug: args.publicSlug,
        settings: args.settings,
      } satisfies Record<string, unknown>);

      // Post-insert verification — close TOCTOU race
      if (args.publicSlug) {
        const slugInstances = await ctx
          .table('pluginInstances', 'publicSlug', (q) =>
            q.eq('publicSlug', args.publicSlug!)
          );
        if (slugInstances.length > 1) {
          // Another request inserted same slug — rollback ours
          const doc = await ctx.table('pluginInstances').get(insertedId);
          if (doc) await doc.delete();
          throw new ConvexError({
            code: 'CONFLICT',
            message: `Slug "${args.publicSlug}" sudah digunakan toko lain`,
          });
        }
      }
    }
    return { success: true };
  },
});

/** Remove a plugin instance from current org. */
export const remove = createOrgMutation()({
  args: { pluginId: z.string() },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx
      .table('pluginInstances', 'organizationId_pluginId', (q) =>
        q.eq('organizationId', ctx.orgId).eq('pluginId', args.pluginId)
      )
      .first();
    if (!existing) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Plugin tidak ditemukan',
      });
    }
    await existing.delete();
    return { success: true };
  },
});
