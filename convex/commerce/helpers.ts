import { ConvexError } from 'convex/values';

/** Resolve organization ID from slug. */
export async function getOrgId(ctx: any, slug: string) {
  const org = await ctx.table('organization').get('slug', slug);
  if (!org) throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
  return org._id;
}

/** Resolve customer ID for authenticated user. */
export async function resolveCustomerId(ctx: any, orgId: any, userId: any | null) {
  if (!userId) return null;
  const customers = await ctx
    .table('customers', 'organizationId_email', (q: any) => q.eq('organizationId', orgId));
  const match = customers.find((c: any) => c.userId === userId);
  return match?._id ?? null;
}

/** Verify caller owns the cart. */
export function verifyCartOwnership(cart: any, customerId: any | null, sessionId?: string) {
  if (customerId && cart.customerId === customerId) return;
  if (sessionId && cart.sessionId === sessionId) return;
  throw new ConvexError({ code: 'FORBIDDEN', message: 'Not your cart' });
}

/** Timeline entry helper. */
export function timelineEntry(status: string, note?: string) {
  return { status, timestamp: Date.now(), note };
}
