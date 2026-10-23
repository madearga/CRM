import { createAuthMutation } from './functions';
import {
  countOwnedOrganizations,
  createCrmOrganization,
  ORGANIZATION_LIMIT,
} from './organizationHelpers';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

export const completeOnboarding = createAuthMutation({
  rateLimit: 'organization/create',
})({
  args: {
    organizationName: z.string().min(2).max(100),
    userName: z.string().min(2).max(100),
  },
  returns: z.object({
    organizationId: zid('organization'),
  }),
  handler: async (ctx, args) => {
    // Guard: user must not already have an active org
    if (ctx.user.activeOrganization?.id) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'User already has an active organization',
      });
    }

    // 1. Update user name
    await ctx.user.patch({ name: args.userName });

    // 2. The user may own only a limited number of organizations. The
    // personal organization counts as one.
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

    // 2. Generate slug from org name
    let slug = args.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) slug = 'workspace';

    // Ensure slug uniqueness
    let attempt = 0;
    while (attempt < 10) {
      const existing = await ctx.table('organization').get('slug', slug);
      if (!existing) break;
      slug = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
      attempt++;
    }

    if (attempt >= 10) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'Could not generate a unique slug. Please try a different name.',
      });
    }

    // 3. Create the organization in the CRM tables. The CRM tables own the
    // business organization and the business member. The helper also creates
    // the owner membership and the default permission templates.
    const { id: organizationId } = await createCrmOrganization(
      ctx.table as any,
      {
        name: args.organizationName,
        ownerUserId: ctx.user._id,
        slug,
      }
    );

    // 3b. Auto-create ecommerce plugin instance
    await ctx.table('pluginInstances').insert({
      organizationId,
      pluginId: 'ecommerce',
      isActive: true,
      publicSlug: slug,
    });

    // 4. Set as active organization. The active organization lives in the CRM
    // user row. The session of the auth component has no organization field.
    await ctx.table('user').getX(ctx.user._id).patch({
      lastActiveOrganizationId: organizationId,
    });

    return {
      organizationId,
    };
  },
});
