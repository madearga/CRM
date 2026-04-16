import { z } from 'zod';
import { ConvexError } from 'convex/values';
import {
  createOrgQuery,
  createOrgMutation,
  createPublicQuery,
} from './functions';

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
      customDomain: z.string().optional(),
      settings: z.any().optional(),
    })
  ),
  handler: async (ctx, _args) => {
    const instances = await ctx
      .table('pluginInstances', 'organizationId', (q) =>
        q.eq('organizationId', ctx.orgId)
      );
    return instances.map((p: any) => ({
      id: p._id,
      pluginId: p.pluginId,
      isActive: p.isActive,
      publicSlug: p.publicSlug ?? undefined,
      customDomain: p.customDomain ?? undefined,
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
      .filter((p: any) => p.isActive)
      .map((p: any) => p.pluginId);
  },
});

/** Resolve plugin instance by public slug (public — no auth required). */
export const getBySlug = createPublicQuery()({
  args: { publicSlug: z.string() },
  returns: z
    .object({
      organizationId: z.string(),
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
      organizationId: instance.organizationId,
      pluginId: instance.pluginId,
      isActive: instance.isActive,
      publicSlug: instance.publicSlug ?? undefined,
    };
  },
});

/** Resolve plugin instance by custom domain (public — no auth required). */
export const getByDomain = createPublicQuery()({
  args: { domain: z.string() },
  returns: z
    .object({
      organizationId: z.string(),
      pluginId: z.string(),
      publicSlug: z.string().optional(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    const instance = await ctx
      .table('pluginInstances', 'customDomain', (q) =>
        q.eq('customDomain', args.domain)
      )
      .first();
    if (!instance) return null;
    return {
      organizationId: instance.organizationId,
      pluginId: instance.pluginId,
      publicSlug: instance.publicSlug ?? undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create or update a plugin instance for current org. */
export const upsert = createOrgMutation()({
  args: {
    pluginId: z.string(),
    isActive: z.boolean().optional(),
    publicSlug: z.string().optional(),
    customDomain: z.string().optional(),
    settings: z.any().optional(),
  },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx
      .table('pluginInstances', 'organizationId_pluginId', (q) =>
        q.eq('organizationId', ctx.orgId).eq('pluginId', args.pluginId)
      )
      .first();

    if (existing) {
      await existing.patch({
        ...(args.isActive !== undefined && { isActive: args.isActive }),
        ...(args.publicSlug !== undefined && { publicSlug: args.publicSlug }),
        ...(args.customDomain !== undefined && {
          customDomain: args.customDomain,
        }),
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
      await ctx.table('pluginInstances').insert({
        organizationId: ctx.orgId,
        pluginId: args.pluginId,
        isActive: args.isActive ?? true,
        publicSlug: args.publicSlug,
        customDomain: args.customDomain,
        settings: args.settings,
      } as any);
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
