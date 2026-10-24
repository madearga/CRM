// The replay guard of the signed bridge.
//
// The signature covers a timestamp, and the window is five minutes, so a
// captured request can be replayed inside that window. Each message carries
// a nonce; the first use of a nonce is kept and every later use is refused.

import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { createInternalMutation } from './functions';

/** How long a nonce is remembered. It is longer than the signature window. */
export const NONCE_TTL_MS = 30 * 60 * 1000;

export const claim = createInternalMutation()({
  args: { nonce: z.string().min(8).max(200) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('agentBridgeNonces')
      .withIndex('nonce', (q) => q.eq('nonce', args.nonce))
      .first();

    if (existing) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'This request was already delivered',
      });
    }

    const now = Date.now();
    await ctx.db.insert('agentBridgeNonces', { nonce: args.nonce, createdAt: now });

    // Keep the table small without a separate job.
    const stale = await ctx.db
      .query('agentBridgeNonces')
      .withIndex('nonce')
      .filter((q) => q.lt(q.field('createdAt'), now - NONCE_TTL_MS))
      .take(20);
    for (const row of stale) await ctx.db.delete(row._id);

    return { claimed: true as const };
  },
});
