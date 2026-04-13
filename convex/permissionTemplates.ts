import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { createOrgQuery, createOrgMutation } from './functions';
import { FEATURES, FEATURE_ACTIONS } from './permissionHelpers';

import type { Id } from './_generated/dataModel';

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

const entrySchema = z.object({
  feature: z.string(),
  action: z.string(),
  allowed: z.boolean(),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = createOrgQuery({
  permission: { feature: 'team', action: 'view' },
})({
  args: {},
  returns: z.array(
    z.object({
      _id: zid('permissionTemplates'),
      _creationTime: z.number(),
      name: z.string(),
      description: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      isDefault: z.boolean(),
      ownerId: zid('user'),
      entries: z.array(
        z.object({
          _id: zid('permissionEntries'),
          feature: z.string(),
          action: z.string(),
          allowed: z.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const templates = await ctx
      .table('permissionTemplates', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(100);

    return Promise.all(
      templates.map(async (tmpl: any) => {
        const entries = await ctx
          .table('permissionEntries', 'templateId_feature_action', (q: any) =>
            q.eq('templateId', tmpl._id),
          )
          .take(200);

        return {
          _id: tmpl._id as Id<'permissionTemplates'>,
          _creationTime: tmpl._creationTime,
          name: tmpl.name,
          description: tmpl.description ?? null,
          color: tmpl.color ?? null,
          isDefault: tmpl.isDefault,
          ownerId: tmpl.ownerId as Id<'user'>,
          entries: entries.map((e: any) => ({
            _id: e._id as Id<'permissionEntries'>,
            feature: e.feature,
            action: e.action,
            allowed: e.allowed,
          })),
        };
      }),
    );
  },
});

export const getById = createOrgQuery({
  permission: { feature: 'team', action: 'view' },
})({
  args: { templateId: zid('permissionTemplates') },
  returns: z
    .object({
      _id: zid('permissionTemplates'),
      _creationTime: z.number(),
      name: z.string(),
      description: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      isDefault: z.boolean(),
      ownerId: zid('user'),
      entries: z.array(
        z.object({
          _id: zid('permissionEntries'),
          feature: z.string(),
          action: z.string(),
          allowed: z.boolean(),
        }),
      ),
    })
    .nullable(),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('permissionTemplates').get(args.templateId);
    if (!tmpl || tmpl.organizationId !== ctx.orgId) {
      return null;
    }

    const entries = await ctx
      .table('permissionEntries', 'templateId_feature_action', (q: any) =>
        q.eq('templateId', tmpl._id),
      )
      .take(200);

    return {
      _id: tmpl._id as Id<'permissionTemplates'>,
      _creationTime: tmpl._creationTime,
      name: tmpl.name,
      description: tmpl.description ?? null,
      color: tmpl.color ?? null,
      isDefault: tmpl.isDefault,
      ownerId: tmpl.ownerId as Id<'user'>,
      entries: entries.map((e: any) => ({
        _id: e._id as Id<'permissionEntries'>,
        feature: e.feature,
        action: e.action,
        allowed: e.allowed,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = createOrgMutation({
  permission: { feature: 'team', action: 'manage_roles' },
})({
  args: {
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    color: z.string().optional(),
    entries: z.array(entrySchema),
  },
  returns: zid('permissionTemplates'),
  handler: async (ctx, args) => {
    const templateId = await ctx.table('permissionTemplates').insert({
      name: args.name,
      description: args.description,
      color: args.color,
      isDefault: false,
      organizationId: ctx.orgId,
      ownerId: ctx.user._id,
    });

    for (const entry of args.entries) {
      await ctx.table('permissionEntries').insert({
        feature: entry.feature,
        action: entry.action,
        allowed: entry.allowed,
        organizationId: ctx.orgId,
        templateId,
      });
    }

    return templateId;
  },
});

export const update = createOrgMutation({
  permission: { feature: 'team', action: 'manage_roles' },
})({
  args: {
    templateId: zid('permissionTemplates'),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    color: z.string().optional(),
    entries: z.array(entrySchema).optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('permissionTemplates').get(args.templateId);
    if (!tmpl || tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }
    if (tmpl.isDefault) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Cannot edit default templates',
      });
    }

    // Patch template metadata
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.color !== undefined) patch.color = args.color;

    if (Object.keys(patch).length > 0) {
      await ctx.table('permissionTemplates').getX(args.templateId).patch(patch);
    }

    // Replace entries if provided
    if (args.entries !== undefined) {
      // Delete existing entries
      const existing = await ctx
        .table('permissionEntries', 'templateId_feature_action', (q: any) =>
          q.eq('templateId', args.templateId),
        )
        .take(200);

      for (const entry of existing) {
        await ctx.table('permissionEntries').getX(entry._id).delete();
      }

      // Insert new entries
      for (const entry of args.entries) {
        await ctx.table('permissionEntries').insert({
          feature: entry.feature,
          action: entry.action,
          allowed: entry.allowed,
          organizationId: ctx.orgId,
          templateId: args.templateId as Id<'permissionTemplates'>,
        });
      }
    }

    return null;
  },
});

export const deleteTemplate = createOrgMutation({
  permission: { feature: 'team', action: 'manage_roles' },
})({
  args: {
    templateId: zid('permissionTemplates'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('permissionTemplates').get(args.templateId);
    if (!tmpl || tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }
    if (tmpl.isDefault) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Cannot delete default templates',
      });
    }

    // Find the default "Member" template to reassign members to
    const memberTemplates = await ctx
      .table('permissionTemplates', 'organizationId_name', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('name', 'Member'),
      )
      .take(1);
    const memberTemplate = memberTemplates[0];

    // Reassign members using this template to the default Member template
    const members = await ctx
      .table('member', 'organizationId_role', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(500);

    for (const member of members) {
      if (member.permissionTemplateId === args.templateId) {
        await ctx
          .table('member')
          .getX(member._id)
          .patch({
            permissionTemplateId: memberTemplate
              ? (memberTemplate._id as Id<'permissionTemplates'>)
              : undefined,
          });
      }
    }

    // Delete entries first
    const entries = await ctx
      .table('permissionEntries', 'templateId_feature_action', (q: any) =>
        q.eq('templateId', args.templateId),
      )
      .take(200);

    for (const entry of entries) {
      await ctx.table('permissionEntries').getX(entry._id).delete();
    }

    // Delete the template
    await ctx.table('permissionTemplates').getX(args.templateId).delete();

    return null;
  },
});
