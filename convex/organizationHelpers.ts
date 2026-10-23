import { asyncMap } from 'convex-helpers';
import { entsTableFactory } from 'convex-ents';

import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import type { AuthCtx } from './functions';

import { entDefinitions } from './schema';
import { seedDefaultTemplates } from './permissionHelpers';

export const DEFAULT_ORG_CURRENCY = 'IDR' as const;

/**
 * Maximum number of organizations that one user may own. The personal
 * organization counts as one owned organization.
 */
export const ORGANIZATION_LIMIT = 3;

/**
 * The CRM tables own the business organization and the business member.
 * The tables of the auth component own the login data only. An identifier of
 * the auth component must never be used as a CRM foreign key.
 */
export const listUserOrganizations = async (
  ctx: AuthCtx,
  userId: Id<'user'>
) => {
  const memberships = await ctx
    .table('member')
    .filter((q) => q.eq(q.field('userId'), userId))
    .take(500);

  if (!memberships.length) {
    return [];
  }

  return (
    await asyncMap(memberships as any[], async (membership) => {
      const org = await ctx.table('organization').get(membership.organizationId);
      if (!org) {
        return null;
      }

      return {
        ...(typeof org.doc === 'function' ? org.doc() : org),
        _creationTime: org._creationTime,
        _id: org._id,
        role: membership.role || 'member',
      };
    })
  ).filter(Boolean);
};

/**
 * Find the CRM membership of a user in an organization.
 * The membership is the only proof that a user may act in an organization.
 */
export const findMembership = async (
  table: any,
  args: {
    organizationId: Id<'organization'>;
    userId: Id<'user'>;
  }
): Promise<any | null> => {
  const members = await table(
    'member',
    'organizationId_userId',
    (q: any) =>
      q.eq('organizationId', args.organizationId).eq('userId', args.userId)
  ).take(1);

  return members[0] ?? null;
};

/**
 * Resolve the active organization of a user.
 *
 * The candidates come from the CRM user row. A candidate is only used when a
 * real CRM membership exists. Without a membership the function returns null
 * and the caller must fail closed.
 */
export const resolveActiveOrganization = async (
  table: any,
  user: {
    _id: Id<'user'>;
    lastActiveOrganizationId?: Id<'organization'> | null;
    personalOrganizationId?: Id<'organization'> | null;
  }
): Promise<{ organization: any; membership: any } | null> => {
  const candidates = [
    user.lastActiveOrganizationId,
    user.personalOrganizationId,
  ].filter((value): value is Id<'organization'> => Boolean(value));

  for (const organizationId of candidates) {
    const membership = await findMembership(table, {
      organizationId,
      userId: user._id,
    });

    if (!membership) {
      continue;
    }

    const organization = await table('organization').get(organizationId);
    if (!organization) {
      continue;
    }

    return { organization, membership };
  }

  return null;
};

/**
 * Count the organizations that a user owns. The personal organization is
 * included because the user owns it.
 */export const countOwnedOrganizations = async (
  table: any,
  userId: Id<'user'>
): Promise<number> => {
  const memberships = await table('member')
    .filter((q: any) => q.eq(q.field('userId'), userId))
    .take(500);

  const owned = new Set<string>(
    memberships
      .filter((membership: any) => membership.role === 'owner')
      .map((membership: any) => membership.organizationId as string)
  );

  return owned.size;
};

export type InvitationDecision = {
  allowed: boolean;
  reason?: string;
};

export type InvitationRecord = {
  email: string;
  expiresAt: number;
  organizationId: Id<'organization'>;
  role?: string | null;
  roleTemplateId?: Id<'permissionTemplates'> | null;
  status: string;
};

/**
 * Check whether a user may accept an invitation.
 *
 * The rules fail closed. The function has no database access, so every rule
 * is testable on its own.
 */
export const evaluateInvitation = (args: {
  invitation: InvitationRecord | null | undefined;
  memberCount: number;
  memberLimit: number;
  now?: number;
  userEmail: string;
}): InvitationDecision => {
  const { invitation } = args;

  if (!invitation || invitation.email !== args.userEmail) {
    return {
      allowed: false,
      reason: 'This invitation is not found for your email address',
    };
  }

  if (invitation.status !== 'pending') {
    return {
      allowed: false,
      reason: 'This invitation has already been processed',
    };
  }

  if (invitation.expiresAt <= (args.now ?? Date.now())) {
    return { allowed: false, reason: 'This invitation has expired' };
  }

  if (args.memberCount >= args.memberLimit) {
    return {
      allowed: false,
      reason: `Organization member limit reached. Maximum ${args.memberLimit} members allowed.`,
    };
  }

  return { allowed: true };
};

/**
 * Create a CRM organization with its owner membership and the default
 * permission templates. The returned identifier is a CRM identifier.
 */
export const createCrmOrganization = async (
  table: any,
  args: {
    logo?: string | null;
    name: string;
    ownerUserId: Id<'user'>;
    slug: string;
  }
): Promise<{ id: Id<'organization'>; slug: string }> => {
  const organizationId = (await table('organization').insert({
    createdAt: Date.now(),
    logo: args.logo || undefined,
    monthlyCredits: 0,
    name: args.name,
    settings: { currency: DEFAULT_ORG_CURRENCY },
    slug: args.slug,
  })) as Id<'organization'>;

  await table('member').insert({
    createdAt: Date.now(),
    organizationId,
    role: 'owner',
    userId: args.ownerUserId,
  });

  await seedDefaultTemplates(
    { table } as any,
    organizationId,
    args.ownerUserId
  );

  return { id: organizationId, slug: args.slug };
};

/**
 * Create the personal organization of a user.
 *
 * This is the single place that creates a personal organization. The owner
 * membership and the default permission templates are always created with it.
 * The function is idempotent.
 */
export const createPersonalOrganization = async (
  ctx: MutationCtx,
  args: {
    email?: string;
    image: string | null;
    name: string;
    userId: Id<'user'>;
  }
) => {
  const table = entsTableFactory(ctx, entDefinitions);

  const user = await table('user').getX(args.userId);

  if (user.personalOrganizationId) {
    // The organization exists already. Repair a missing owner membership so
    // that the personal organization stays usable.
    const membership = await findMembership(table as any, {
      organizationId: user.personalOrganizationId,
      userId: args.userId,
    });

    if (!membership) {
      const organization = await table('organization').get(
        user.personalOrganizationId
      );

      if (organization) {
        await table('member').insert({
          createdAt: Date.now(),
          organizationId: user.personalOrganizationId,
          role: 'owner',
          userId: args.userId,
        });
      }
    }

    return null;
  }

  // Generate unique slug for personal org
  let slug = `personal-${args.userId.slice(-8)}`;
  const taken = await table('organization').get('slug', slug);
  if (taken) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const { id: orgId } = await createCrmOrganization(table, {
    logo: args.image,
    name: `${args.name}'s Organization`,
    ownerUserId: args.userId,
    slug,
  });

  // Update the user's last active organization and personal organization ID for future sessions
  await table('user').getX(args.userId).patch({
    lastActiveOrganizationId: orgId,
    personalOrganizationId: orgId,
  });

  return {
    id: orgId,
    slug: slug,
  };
};
