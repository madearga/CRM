import { internalMutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';

// Sessions must come from Better Auth. This former public fixture must not
// create an identity, even when an internal caller invokes it accidentally.
export const createSession = internalMutation({
  args: { userId: v.string(), orgId: v.string() },
  handler: async () => {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Test session creation is disabled; use Better Auth',
    });
  },
});
