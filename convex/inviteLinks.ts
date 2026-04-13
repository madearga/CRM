import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import {
  createOrgQuery,
  createOrgMutation,
  createPublicQuery,
  createAuthMutation,
} from './functions';

import type { Id } from './_generated/dataModel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Org-scoped queries & mutations (require team:invite)
// ---------------------------------------------------------------------------

export const list = createOrgQuery({
  permission: { feature: 'team', action: 'invite' },
})({
  args: {},
  returns: z.array(
    z.object({
      _id: zid('inviteLinks'),
      _creationTime: z.number(),
      token: z.string(),
      expiresAt: z.number(),
      maxUses: z.number().nullable().optional(),
      usedCount: z.number(),
      status: z.string(),
      roleTemplateId: zid('permissionTemplates'),
      creatorId: zid('user'),
    }),
  ),
  handler: async (ctx) => {
    const links = await ctx
      .table('inviteLinks', 'organizationId_status', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('status', 'active'),
      )
      .take(100);

    return links.map((link: any) => ({
      _id: link._id as Id<'inviteLinks'>,
      _creationTime: link._creationTime,
      token: link.token,
      expiresAt: link.expiresAt,
      maxUses: link.maxUses ?? null,
      usedCount: link.usedCount,
      status: link.status,
      roleTemplateId: link.roleTemplateId as Id<'permissionTemplates'>,
      creatorId: link.creatorId as Id<'user'>,
    }));
  },
});

export const create = createOrgMutation({
  permission: { feature: 'team', action: 'invite' },
})({
  args: {
    roleTemplateId: zid('permissionTemplates'),
    expiresInMs: z.number().optional(), // defaults to 7 days
    maxUses: z.number().optional(),
  },
  returns: z.object({
    _id: zid('inviteLinks'),
    token: z.string(),
  }),
  handler: async (ctx, args) => {
    // Verify the template belongs to this org
    const template = await ctx
      .table('permissionTemplates')
      .get(args.roleTemplateId);
    if (!template || template.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Role template not found',
      });
    }

    const token = generateToken();
    const expiresAt = Date.now() + (args.expiresInMs ?? DEFAULT_EXPIRY_MS);

    const linkId = await ctx.table('inviteLinks').insert({
      token,
      expiresAt,
      maxUses: args.maxUses,
      usedCount: 0,
      roleTemplateId: args.roleTemplateId,
      status: 'active',
      organizationId: ctx.orgId,
      creatorId: ctx.user._id,
    });

    return {
      _id: linkId as Id<'inviteLinks'>,
      token,
    };
  },
});

export const revoke = createOrgMutation({
  permission: { feature: 'team', action: 'invite' },
})({
  args: { linkId: zid('inviteLinks') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const link = await ctx.table('inviteLinks').get(args.linkId);
    if (!link || link.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invite link not found' });
    }

    await ctx.table('inviteLinks').getX(args.linkId).patch({
      status: 'revoked',
    });

    return null;
  },
});

// ---------------------------------------------------------------------------
// Public query — no auth required
// ---------------------------------------------------------------------------

export const getByToken = createPublicQuery()({
  args: { token: z.string() },
  returns: z
    .object({
      organizationName: z.string(),
      organizationLogo: z.string().nullable().optional(),
      roleName: z.string(),
      expiresAt: z.number(),
      isExpired: z.boolean(),
      isValid: z.boolean(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    const links = await ctx
      .table('inviteLinks', 'token', (q: any) => q.eq('token', args.token))
      .take(1);

    const link = links[0];
    if (!link) return null;

    const org = await ctx.table('organization').getX(link.organizationId);
    const template = await ctx
      .table('permissionTemplates')
      .getX(link.roleTemplateId);

    const isExpired = link.expiresAt < Date.now();
    const isValid = link.status === 'active' && !isExpired;

    return {
      organizationName: org.name,
      organizationLogo: org.logo ?? null,
      roleName: template.name,
      expiresAt: link.expiresAt,
      isExpired,
      isValid,
    };
  },
});

// ---------------------------------------------------------------------------
// Authenticated join — requires logged-in user (not org-scoped)
// ---------------------------------------------------------------------------

export const joinViaLink = createAuthMutation({})({
  args: { token: z.string() },
  returns: z.object({
    organizationId: zid('organization'),
    organizationName: z.string(),
  }),
  handler: async (ctx, args) => {
    // Look up the invite link
    const links = await ctx
      .table('inviteLinks', 'token', (q: any) => q.eq('token', args.token))
      .take(1);

    const link = links[0];
    if (!link) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invite link not found' });
    }

    // Validate link
    if (link.status !== 'active') {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Invite link has been revoked' });
    }
    if (link.expiresAt < Date.now()) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Invite link has expired' });
    }
    if (link.maxUses !== undefined && link.usedCount >= link.maxUses) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Invite link has reached max uses' });
    }

    // TOCTOU note: Convex OCC provides document-level serialization. The usedCount
    // patch below will fail if a concurrent mutation modifies the same link doc.
    // The small race window for member insert across different docs is accepted.
    const existing = await ctx
      .table('member', 'organizationId_userId', (q: any) =>
        q
          .eq('organizationId', link.organizationId)
          .eq('userId', ctx.user._id),
      )
      .take(1);

    if (existing.length > 0) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'You are already a member of this organization',
      });
    }

    // Create member record
    await ctx.table('member').insert({
      role: 'member',
      createdAt: Date.now(),
      permissionTemplateId: link.roleTemplateId as Id<'permissionTemplates'>,
      organizationId: link.organizationId as Id<'organization'>,
      userId: ctx.user._id,
    });

    // Increment usedCount
    await ctx
      .table('inviteLinks')
      .getX(link._id)
      .patch({
        usedCount: link.usedCount + 1,
      });

    // Return org info
    const org = await ctx.table('organization').getX(link.organizationId);

    return {
      organizationId: org._id as Id<'organization'>,
      organizationName: org.name,
    };
  },
});
