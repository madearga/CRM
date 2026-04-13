import { z } from 'zod';
import { createAuthQuery } from './functions';
import { getPermissionsForUser } from './permissionHelpers';

/**
 * Get all permissions for the current user in their active organization.
 * Returns a Record<string, boolean> where keys are "feature:action".
 */
export const getMyPermissions = createAuthQuery()({
  args: {},
  returns: z.record(z.string(), z.boolean()),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return {};
    return getPermissionsForUser(ctx, {
      userId: ctx.user._id,
      orgId: orgId as any,
    });
  },
});
