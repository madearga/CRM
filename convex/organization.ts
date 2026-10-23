import type { Id } from './_generated/dataModel';

import { hasPermission } from './authHelpers';
import {
  countOwnedOrganizations,
  createCrmOrganization,
  evaluateInvitation,
  findMembership,
  listUserOrganizations,
  ORGANIZATION_LIMIT,
} from './organizationHelpers';
import { canAssignRole, canInviteRole } from './orgAccess';
import { asyncMap } from 'convex-helpers';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import {
  type AuthMutationCtx,
  createAuthMutation,
  createAuthQuery,
} from './functions';

// Maximum members per organization (including pending invitations)
const MEMBER_LIMIT = 5;
// Validity of an invitation
const INVITATION_EXPIRY_MS = 24 * 60 * 60 * 7 * 1000;
// Default limit for listing operations to prevent unbounded queries
const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_PLAN = 'free';
const ORG_CURRENCIES = ['IDR', 'USD'] as const;

// List all organizations for current user (excluding active organization)
export const listOrganizations = createAuthQuery()({
  args: {},
  returns: z.object({
    canCreateOrganization: z.boolean(),
    organizations: z.array(
      z.object({
        id: zid('organization'),
        createdAt: z.number(),
        isPersonal: z.boolean(),
        logo: z.string().nullish(),
        name: z.string(),
        plan: z.string(),
        slug: z.string(),
      })
    ),
  }),
  handler: async (ctx) => {
    // Get all organizations for user using helper
    const orgs = await listUserOrganizations(ctx, ctx.user._id);

    // The user may own only a limited number of organizations. The personal
    // organization counts as one.
    const ownedCount = await countOwnedOrganizations(
      ctx.table as any,
      ctx.user._id
    );
    const canCreateOrganization = ownedCount < ORGANIZATION_LIMIT;

    if (!orgs || orgs.length === 0) {
      return {
        canCreateOrganization,
        organizations: [],
      };
    }

    const activeOrgId = ctx.user.activeOrganization?.id;

    // Filter out active organization from the list to return (but keep all orgs for permission check above)
    const filteredOrgs = orgs.filter((org): org is NonNullable<typeof org> => org != null && org._id !== activeOrgId);

    // Enrich organizations with plan data
    const enrichedOrgs = filteredOrgs.map((org) => ({
      id: org._id,
      createdAt: org._creationTime,
      isPersonal: org._id === ctx.user.personalOrganizationId,
      logo: org.logo || null,
      name: org.name,
      plan: DEFAULT_PLAN,
      slug: org.slug,
    }));

    return {
      canCreateOrganization,
      organizations: enrichedOrgs,
    };
  },
});

// Create a new organization (max 1 without subscription)
export const createOrganization = createAuthMutation({
  rateLimit: 'organization/create',
})({
  args: {
    name: z.string().min(1).max(100),
  },
  returns: z.object({
    id: zid('organization'),
    slug: z.string(),
  }),
  handler: async (ctx, args) => {
    // The user may own only a limited number of organizations. The personal
    // organization counts as one.
    const ownedCount = await countOwnedOrganizations(
      ctx.table as any,
      ctx.user._id
    );

    if (ownedCount >= ORGANIZATION_LIMIT) {
      throw new ConvexError({
        code: 'LIMIT_EXCEEDED',
        message: `Organization limit reached. Maximum ${ORGANIZATION_LIMIT} organizations per user.`,
      });
    }

    // Generate unique slug
    let slug = args.name;
    let attempt = 0;

    while (attempt < 10) {
      // Check if slug is already taken
      const existingOrg = await ctx.table('organization').get('slug', slug);

      if (!existingOrg) {
        break; // Slug is available!
      }

      // Add random suffix for uniqueness
      slug = `${slug}-${Math.random().toString(36).slice(2, 10)}`;
      attempt++;
    }

    if (attempt >= 10) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message:
          'Could not generate a unique slug. Please provide a custom slug.',
      });
    }

    // Create the organization in the CRM tables. The CRM tables own the
    // business organization and the business member, so the identifier of
    // the auth component is never used as a CRM foreign key.
    const { id: organizationId } = await createCrmOrganization(ctx.table as any, {
      name: args.name,
      ownerUserId: ctx.user._id,
      slug,
    });

    // Auto-create ecommerce plugin instance for the new org
    await ctx.table('pluginInstances').insert({
      organizationId,
      pluginId: 'ecommerce',
      isActive: true,
      publicSlug: slug,
    });

    // Set as active organization
    await setActiveOrganizationHandler(ctx, {
      organizationId,
    });

    return {
      id: organizationId,
      slug,
    };
  },
});

// Update organization details
export const updateOrganization = createAuthMutation({
  rateLimit: 'organization/update',
})({
  args: {
    currency: z.enum(ORG_CURRENCIES).optional(),
    logo: z.string().url().optional(),
    name: z.string().min(1).max(100).optional(),
    slug: z.string().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    // Check active organization exists first
    if (!ctx.user.activeOrganization?.id) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    // Then check permissions
    await hasPermission(ctx, {
      permissions: { organization: ['update'] },
    });

    let slug = args.slug;

    // If slug is provided, validate it
    if (args.slug) {
      if (ctx.user.activeOrganization.id === ctx.user.personalOrganizationId) {
        slug = undefined;
      } else {
        slugSchema.parse(args.slug);

        // Check if slug is taken
        const existingOrg = await ctx.table('organization').get('slug', slug!);

        if (
          existingOrg &&
          existingOrg._id !== ctx.user.activeOrganization.id
        ) {
          throw new ConvexError({
            code: 'BAD_REQUEST',
            message: 'This slug is already taken',
          });
        }
      }
    }

    const organization = await ctx
      .table('organization')
      .getX(ctx.user.activeOrganization.id as Id<'organization'>);

    if (args.currency) {
      const deals = await ctx
        .table('deals', 'organizationId', (q) =>
          q.eq('organizationId', ctx.user.activeOrganization!.id)
        )
        .take(5000);

      const mixedCurrencyDeal = deals.find(
        (deal) =>
          !deal.archivedAt &&
          deal.currency !== undefined &&
          deal.currency.toUpperCase() !== args.currency
      );

      if (mixedCurrencyDeal) {
        throw new ConvexError({
          code: 'BAD_REQUEST',
          message: `Cannot change organization currency to "${args.currency}" while deals still use a different currency.`,
        });
      }
    }

    await organization.patch({
      logo: args.logo,
      name: args.name,
      ...(slug ? { slug } : {}),
      ...(args.currency
        ? {
            settings: {
              ...(organization.settings ?? {}),
              currency: args.currency,
            },
          }
        : {}),
    });

    return null;
  },
});

const slugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/);

const setActiveOrganizationHandler = async (
  ctx: AuthMutationCtx,
  args: { organizationId: Id<'organization'> }
) => {
  // Only an organization with a real CRM membership can become active.
  const membership = await findMembership(ctx.table as any, {
    organizationId: args.organizationId,
    userId: ctx.user._id,
  });

  if (!membership) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'You are not a member of this organization',
    });
  }

  // The active organization is stored in the CRM user row. The session of the
  // auth component has no organization field.
  await ctx.table('user').getX(ctx.user._id).patch({
    lastActiveOrganizationId: args.organizationId,
  });

  return null;
};

// Set active organization
export const setActiveOrganization = createAuthMutation({
  rateLimit: 'organization/setActive',
})({
  args: {
    organizationId: zid('organization'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    return setActiveOrganizationHandler(ctx, args);
  },
});

// Accept invitation
//
// The invitation row lives in the CRM tables. The identifier of the
// invitation is a CRM identifier. The acceptance creates the CRM membership.
export const acceptInvitation = createAuthMutation({})({
  args: {
    invitationId: zid('invitation'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    // The invitation row lives in the CRM tables.
    const invitation = await ctx.table('invitation').get(args.invitationId);

    // The membership of the CRM tables is the business membership.
    const existing = invitation
      ? await findMembership(ctx.table as any, {
          organizationId: invitation.organizationId,
          userId: ctx.user._id,
        })
      : null;

    // The member limit of the organization applies to an accepted invitation.
    const members = invitation
      ? await ctx
          .table('member', 'organizationId_userId', (q: any) =>
            q.eq('organizationId', invitation.organizationId)
          )
          .take(DEFAULT_LIST_LIMIT)
      : [];

    const decision = evaluateInvitation({
      invitation: invitation
        ? {
            email: invitation.email,
            expiresAt: invitation.expiresAt,
            organizationId: invitation.organizationId,
            role: invitation.role,
            roleTemplateId: invitation.roleTemplateId,
            status: invitation.status,
          }
        : null,
      memberCount: members.length,
      memberLimit: MEMBER_LIMIT,
      userEmail: ctx.user.email,
    });

    if (!decision.allowed) {
      const code = decision.reason?.includes('limit')
        ? 'LIMIT_EXCEEDED'
        : decision.reason?.includes('email address')
          ? 'FORBIDDEN'
          : 'BAD_REQUEST';

      throw new ConvexError({
        code,
        message: decision.reason,
      });
    }

    if (existing) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'You are already a member of this organization',
      });
    }

    const roleTemplateId = invitation!.roleTemplateId;
    const orgId = invitation!.organizationId;

    await ctx.table('member').insert({
      createdAt: Date.now(),
      organizationId: orgId,
      role: invitation!.role ?? 'member',
      userId: ctx.user._id,
      ...(roleTemplateId ? { permissionTemplateId: roleTemplateId } : {}),
    });

    await invitation!.patch({ status: 'accepted' });

    return null;
  },
});

// Reject invitation
export const rejectInvitation = createAuthMutation({
  rateLimit: 'organization/rejectInvite',
})({
  args: {
    invitationId: zid('invitation'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    // Get the specific invitation directly
    const invitation = await ctx.table('invitation').get(args.invitationId);

    // Additional validation that it's for the current user
    if (invitation && invitation.email !== ctx.user.email) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'This invitation is not found for your email address',
      });
    }
    if (!invitation) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'This invitation is not found for your email address',
      });
    }
    if (invitation.status !== 'pending') {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'This invitation has already been processed',
      });
    }

    await invitation.patch({ status: 'rejected' });

    return null;
  },
});

// Remove member from organization
export const removeMember = createAuthMutation({
  rateLimit: 'organization/removeMember',
})({
  args: {
    memberId: zid('member'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    // Permission: member delete
    await hasPermission(ctx, { permissions: { member: ['delete'] } });

    const organizationId = ctx.user.activeOrganization?.id;
    if (!organizationId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    // The CRM member row is the business membership. The membership of the
    // auth component is not used here.
    const member = await ctx.table('member').get(args.memberId);
    if (!member || member.organizationId !== organizationId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'This member is not a member of the active organization',
      });
    }

    if (member.role === 'owner') {
      const owners = await ctx
        .table('member', 'organizationId_role', (q) =>
          q.eq('organizationId', organizationId).eq('role', 'owner')
        )
        .take(2);

      if (owners.length <= 1) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message:
            'Cannot remove the only owner of the organization. Transfer ownership or add another owner first.',
        });
      }
    }

    await member.delete();

    return null;
  },
});

// Leave organization (self-leave)
export const leaveOrganization = createAuthMutation({
  rateLimit: 'organization/leave',
})({
  args: {},
  returns: z.null(),
  handler: async (ctx) => {
    // Prevent leaving personal organizations (similar to personal org deletion protection)
    // Personal organizations typically have a specific naming pattern or metadata
    if (ctx.user.activeOrganization?.id === ctx.user.personalOrganizationId) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message:
          'You cannot leave your personal organization. Personal organizations are required for your account.',
      });
    }
    // Prevent the last owner from leaving the organization
    // (Organizations must have at least one owner)
    if (ctx.user.activeOrganization?.role === 'owner') {
      // Use the compound index to efficiently find owners
      const owners = await ctx
        .table('member', 'organizationId_role', (q) =>
          q
            .eq('organizationId', ctx.user.activeOrganization!.id)
            .eq('role', 'owner')
        )
        .take(2); // We only need to know if there's more than one owner

      if (owners.length <= 1) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message:
            'Cannot leave organization as the only owner. Transfer ownership or add another owner first.',
        });
      }
    }

    const organizationId = ctx.user.activeOrganization?.id;
    if (!organizationId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    const membership = await findMembership(ctx.table as any, {
      organizationId,
      userId: ctx.user._id,
    });

    if (!membership) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You are not a member of the active organization',
      });
    }

    await ctx.table('member').getX(membership._id).delete();

    // Automatically switch to personal organization
    await setActiveOrganizationHandler(ctx, {
      organizationId: ctx.user.personalOrganizationId!,
    });

    return null;
  },
});

// Update member role
export const updateMemberRole = createAuthMutation({
  rateLimit: 'organization/updateRole',
})({
  args: {
    memberId: zid('member'),
    role: z.enum(['owner', 'member']),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    // Permission: member update
    await hasPermission(ctx, { permissions: { member: ['update'] } });

    const organizationId = ctx.user.activeOrganization?.id;
    if (!organizationId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    const member = await ctx.table('member').get(args.memberId);
    if (!member || member.organizationId !== organizationId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'This member is not a member of the active organization',
      });
    }

    // The current membership decides. A member that is not an owner may not
    // give the owner role and may not change the role of an owner.
    const membership = await findMembership(ctx.table as any, {
      organizationId,
      userId: ctx.user._id,
    });

    if (!membership) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You are not a member of the active organization',
      });
    }

    const roleDecision = canAssignRole({
      currentRole: membership.role as string,
      destinationRole: args.role,
      sourceRole: member.role as string,
    });

    if (!roleDecision.allowed) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: roleDecision.reason,
      });
    }

    // The organization must keep one owner.
    if (member.role === 'owner' && args.role !== 'owner') {
      const owners = await ctx
        .table('member', 'organizationId_role', (q) =>
          q.eq('organizationId', organizationId).eq('role', 'owner')
        )
        .take(2);

      if (owners.length <= 1) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message:
            'Cannot demote the only owner of the organization. Add another owner first.',
        });
      }
    }

    // Update member role directly
    await ctx.table('member').getX(args.memberId).patch({ role: args.role });

    return null;
  },
});

// Delete organization (owner only)
//
// The deletion fails closed. The business rows of an organization, such as
// deals, contacts and invoices, point to the organization identifier. A
// deletion without a cleanup of these rows would leave orphaned data. The
// cleanup needs its own change, so the endpoint refuses the deletion.
export const deleteOrganization = createAuthMutation({})({
  args: {},
  returns: z.null(),
  handler: async (ctx) => {
    // Permission: organization delete
    await hasPermission(ctx, { permissions: { organization: ['delete'] } });

    const organizationId = ctx.user.activeOrganization!.id;

    // Prevent deletion of personal organizations
    if (organizationId === ctx.user.personalOrganizationId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message:
          'Personal organizations can be deleted only by deleting your account.',
      });
    }

    throw new ConvexError({
      code: 'FAILED_PRECONDITION',
      message:
        'Deleting an organization is not available yet. The business data of the organization would be left behind. Remove the business data first.',
    });
  },
});

// Get organization details by slug
export const getOrganization = createAuthQuery()({
  args: {
    slug: z.string(),
  },
  returns: z
    .object({
      id: zid('organization'),
      createdAt: z.number(),
      isActive: z.boolean(),
      isPersonal: z.boolean(),
      logo: z.string().nullish(),
      membersCount: z.number(),
      name: z.string(),
      plan: z.string(),
      role: z.string().optional(),
      slug: z.string(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    // Get organization by slug using index
    const org = await ctx.table('organization').get('slug', args.slug);

    if (!org) return null;

    // Get all members for this organization
    const members = await ctx
      .table('member', 'organizationId_userId', (q) =>
        q.eq('organizationId', org._id)
      )
      .take(DEFAULT_LIST_LIMIT);

    // Get current user's role
    const currentMember = members.find((m) => m.userId === ctx.user._id);

    const plan = DEFAULT_PLAN;

    return {
      id: org._id,
      createdAt: org.createdAt as any,
      isActive: org._id === ctx.user.activeOrganization?.id,
      isPersonal: org._id === ctx.user.personalOrganizationId,
      logo: org.logo || null,
      membersCount: members.length || 1,
      name: org.name,
      plan,
      role: currentMember?.role,
      slug: org.slug,
    };
  },
});

// Get organization overview with optional invitation details
export const getOrganizationOverview = createAuthQuery()({
  args: {
    inviteId: zid('invitation').optional(),
    slug: z.string(),
  },
  returns: z
    .object({
      id: zid('organization'),
      createdAt: z.number(),
      invitation: z
        .object({
          id: zid('invitation'),
          email: z.string(),
          expiresAt: z.number(),
          inviterEmail: z.string(),
          inviterId: zid('user'),
          inviterName: z.string(),
          inviterUsername: z.string().nullable(),
          organizationId: zid('organization'),
          organizationName: z.string(),
          organizationSlug: z.string(),
          role: z.string(),
          status: z.string(),
        })
        .nullable(),
      isActive: z.boolean(),
      isPersonal: z.boolean(),
      logo: z.string().nullish(),
      name: z.string(),
      plan: z.string().optional(),
      role: z.string().optional(),
      slug: z.string(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    // Get organization details
    const org = await ctx.table('organization').get('slug', args.slug);

    if (!org) {
      return null;
    }

    const organizationData = {
      id: org._id,
      createdAt: org.createdAt,
      isActive: ctx.user.activeOrganization?.id === org._id,
      isPersonal: org._id === ctx.user.personalOrganizationId,
      logo: org.logo,
      name: org.name,
      plan: undefined,
      role: ctx.user.activeOrganization?.role,
      slug: org.slug,
    };

    // Handle invitation - either by ID or auto-find by user email
    const invitationData = await (async () => {
      const invitation = await (async () => {
        if (args.inviteId) {
          // If inviteId is provided, fetch specific invitation
          const inv = await ctx.table('invitation').get(args.inviteId);

          if (!inv || inv.organizationId !== org._id) {
            return null;
          }

          return inv;
        }

        // If no inviteId, search for pending invitations for current user's email
        // Using the email_organizationId_status index for efficient lookup
        return await ctx
          .table('invitation', 'email_organizationId_status', (q) =>
            q
              .eq('email', ctx.user.email)
              .eq('organizationId', org._id)
              .eq('status', 'pending')
          )
          .first();
      })();

      if (!invitation) {
        return null;
      }

      // Get inviter details (inviter must exist for invitation)
      const inviter = await ctx.table('user').getX(invitation.inviterId);
      // Inviter already has all the user data we need
      const inviterUsername = inviter.username ?? null;

      return {
        id: invitation._id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        inviterEmail: inviter.email,
        inviterId: invitation.inviterId,
        inviterName: inviter.name,
        inviterUsername,
        organizationId: invitation.organizationId,
        organizationName: org.name,
        organizationSlug: org.slug,
        role: invitation.role ?? 'member',
        status: invitation.status,
      };
    })();

    return {
      ...organizationData,
      invitation: invitationData,
    };
  },
});

// List members by organization slug
export const listMembers = createAuthQuery()({
  args: {
    slug: z.string(),
  },
  returns: z.object({
    currentUserRole: z.string().optional(),
    isPersonal: z.boolean(),
    members: z.array(
      z.object({
        id: zid('member'),
        createdAt: z.number(),
        organizationId: zid('organization'),
        role: z.string().optional(),
        user: z.object({
          id: zid('user'),
          email: z.string(),
          image: z.string().nullish(),
          name: z.string().nullable(),
        }),
        userId: zid('user'),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const org = await ctx.table('organization').get('slug', args.slug);

    if (!org) {
      return {
        isPersonal: false,
        members: [],
      };
    }
    if (ctx.user.activeOrganization?.id !== org._id) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this organization',
      });
    }

    // Get members using organization's edge relationship
    // Limited to prevent unbounded queries with large organizations
    const members = await org.edge('members').take(DEFAULT_LIST_LIMIT);

    if (!members || members.length === 0) {
      return {
        isPersonal: org._id === ctx.user.personalOrganizationId,
        members: [],
      };
    }

    // Enrich with user data using member's edge to user
    const enrichedMembers = await asyncMap(members, async (member) => {
      // Use member's edge to get user (member always has a user)
      const user = await member.edgeX('user');

      return {
        id: member._id,
        createdAt: member.createdAt,
        organizationId: org._id,
        role: member.role,
        user: {
          id: user._id,
          email: user.email,
          image: user.image,
          name: user.name,
        },
        userId: member.userId,
      };
    });

    return {
      currentUserRole: ctx.user.activeOrganization?.role,
      isPersonal: org._id === ctx.user.personalOrganizationId,
      members: enrichedMembers,
    };
  },
});

// List pending invitations by organization slug
export const listPendingInvitations = createAuthQuery()({
  args: {
    slug: z.string(),
  },
  returns: z.array(
    z.object({
      id: zid('invitation'),
      createdAt: z.number(),
      email: z.string(),
      expiresAt: z.number(),
      organizationId: zid('organization'),
      role: z.string(),
      status: z.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Get organization by slug using index
    const org = await ctx.table('organization').get('slug', args.slug);

    if (!org) return [];

    // Permission: invitation management (use create permission as a proxy for managing invites)
    const canManageInvites = await hasPermission(
      ctx,
      { permissions: { invitation: ['create'] } },
      false
    );

    if (!canManageInvites || ctx.user.activeOrganization?.id !== org._id) {
      return [];
    }

    // Get pending invitations directly using the organizationId_status index
    // Limited to 100 to prevent unbounded queries with many invitations
    const pendingInvitations = await ctx
      .table('invitation', 'organizationId_status', (q) =>
        q.eq('organizationId', org._id).eq('status', 'pending')
      )
      .take(DEFAULT_LIST_LIMIT) // Limit to prevent unbounded query
      .map((invitation) => ({
        id: invitation._id,
        createdAt: invitation._creationTime,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        organizationId: invitation.organizationId,
        role: invitation.role || 'member',
        status: invitation.status,
      }));

    return pendingInvitations;
  },
});

// Invite member to organization by slug
//
// The invitation row lives in the CRM tables. The identifier of the
// invitation is a CRM identifier. The tables of the auth component keep no
// invitation for the organization.
export const inviteMember = createAuthMutation({
  rateLimit: 'organization/invite',
})({
  args: {
    email: z.string().email(),
    role: z.enum(['owner', 'member']),
    roleTemplateId: zid('permissionTemplates').optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    // Premium guard for invitations
    // premiumGuard(ctx.user);

    // Permission: invitation create
    await hasPermission(ctx, { permissions: { invitation: ['create'] } });

    const orgId = ctx.user.activeOrganization?.id;

    if (!orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    // The current membership decides. An admin may invite members. An owner
    // invitation needs an owner.
    const membership = await findMembership(ctx.table as any, {
      organizationId: orgId,
      userId: ctx.user._id,
    });

    if (!membership) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You are not a member of the active organization',
      });
    }

    const inviteDecision = canInviteRole({
      currentRole: membership.role as string,
      invitedRole: args.role,
    });

    if (!inviteDecision.allowed) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: inviteDecision.reason,
      });
    }

    // Check member count limit (5 members max per organization)
    // Get all members for this organization
    const members = await ctx
      .table('member', 'organizationId_userId', (q) =>
        q.eq('organizationId', orgId)
      )
      .take(DEFAULT_LIST_LIMIT);

    // Check current member count (including pending invitations)
    const currentMemberCount = members.length;

    // Get pending invitations count
    // Count pending invitations to check against member limit
    const pendingInvitations = await ctx
      .table('invitation', 'organizationId_status', (q) =>
        q.eq('organizationId', orgId).eq('status', 'pending')
      )
      .take(DEFAULT_LIST_LIMIT); // Limited query for counting

    const pendingCount = pendingInvitations?.length || 0;
    const totalCount = currentMemberCount + pendingCount;

    // Check against limit (5 members)
    if (totalCount >= MEMBER_LIMIT) {
      throw new ConvexError({
        code: 'LIMIT_EXCEEDED',
        message: `Organization member limit reached. Maximum ${MEMBER_LIMIT} members allowed (${currentMemberCount} current, ${pendingCount} pending invitations).`,
      });
    }

    // Could check if user has opted out of organization invitations

    // Check for existing pending invitations and cancel them
    // Using the email_organizationId_status index for efficient lookup
    const existingInvitations = await ctx
      .table('invitation', 'email_organizationId_status', (q) =>
        q
          .eq('email', args.email)
          .eq('organizationId', orgId)
          .eq('status', 'pending')
      )
      .take(DEFAULT_LIST_LIMIT);

    // Cancel existing invitations by updating their status
    for (const existingInvitation of existingInvitations) {
      await ctx
        .table('invitation')
        .getX(existingInvitation._id)
        .patch({ status: 'canceled' });
    }

    // Check if user is already a member
    // Need to fetch all members and check emails (no direct email index on members)
    const existingMember = await ctx
      .table('member', 'organizationId_userId', (q) =>
        q.eq('organizationId', orgId)
      )
      .take(DEFAULT_LIST_LIMIT);

    // Check if any member has the invited email
    for (const member of existingMember) {
      const memberUser = await ctx.table('user').get(member.userId);

      if (memberUser?.email === args.email) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: `${args.email} is already a member of this organization`,
        });
      }
    }

    // Create the invitation in the CRM tables. The invitation owns its CRM
    // identifier, so the acceptance creates the CRM membership.
    try {
      const invitationId = await ctx.table('invitation').insert({
        email: args.email,
        expiresAt: Date.now() + INVITATION_EXPIRY_MS,
        inviterId: ctx.user._id,
        organizationId: orgId,
        role: args.role,
        status: 'pending',
        ...(args.roleTemplateId
          ? { roleTemplateId: args.roleTemplateId }
          : {}),
      });

      if (!invitationId) {
        throw new ConvexError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create invitation',
        });
      }

      // Known gap: the invitation email is not sent. The old flow only wrote
      // a log line. The email step must call the action
      // emails.sendOrganizationInviteEmail.
      console.log(
        '[inviteMember] Invitation email would be sent to:',
        args.email,
        'invitation:',
        invitationId
      );
    } catch (error: any) {
      if (error instanceof ConvexError) throw error;

      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: `Failed to send invitation: ${error.message || 'Unknown error'}`,
      });
    }

    return null;
  },
});

// Cancel invitation
export const cancelInvitation = createAuthMutation({
  rateLimit: 'organization/cancelInvite',
})({
  args: {
    invitationId: zid('invitation'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.table('invitation').get(args.invitationId);

    // Permission: invitation cancel and ownership of current active org
    await hasPermission(ctx, { permissions: { invitation: ['cancel'] } });

    if (ctx.user.activeOrganization?.id !== invitation?.organizationId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to cancel this invitation',
      });
    }

    // Cancel the invitation in the CRM tables.
    if (!invitation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Invitation not found or already processed',
      });
    }

    if (invitation.status !== 'pending') {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'Invitation not found or already processed',
      });
    }

    await invitation.patch({ status: 'canceled' });

    // Note: Email cancellation through Resend is non-critical
    // The invitation being cancelled is the primary action

    return null;
  },
});
