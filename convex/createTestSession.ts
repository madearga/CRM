import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createSession = mutation({
  args: { userId: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    const token = "test-token-" + Date.now();
    // @ts-ignore
    await ctx.db.insert("betterAuth.session", {
      userId: args.userId,
      activeOrganizationId: args.orgId,
      token: token,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return token;
  },
});
