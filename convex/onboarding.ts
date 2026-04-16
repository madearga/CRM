import type { Id } from './_generated/dataModel';

import { createAuthMutation } from './functions';
import { seedDefaultTemplates } from './permissionHelpers';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

const DEFAULT_ORG_CURRENCY = 'IDR' as const;

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

    // 3. Create organization via Better Auth
    const org = await ctx.auth.api.createOrganization({
      body: {
        monthlyCredits: 0,
        name: args.organizationName,
        slug,
      },
      headers: ctx.auth.headers,
    });

    if (!org) {
      throw new ConvexError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create organization',
      });
    }

    // 4. Patch org settings
    await ctx
      .table('organization')
      .getX(org.id as Id<'organization'>)
      .patch({
        settings: { currency: DEFAULT_ORG_CURRENCY },
      });

    // 5. Seed default permission templates
    await seedDefaultTemplates(
      ctx,
      org.id as Id<'organization'>,
      ctx.user._id as Id<'user'>
    );

    // 5b. Auto-create ecommerce plugin instance
    await ctx.table('pluginInstances').insert({
      organizationId: org.id as Id<'organization'>,
      pluginId: 'ecommerce',
      isActive: true,
      publicSlug: slug,
    });

    // 6. Set as active organization
    await ctx.auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      headers: ctx.auth.headers,
    });

    return {
      organizationId: org.id as Id<'organization'>,
    };
  },
});
