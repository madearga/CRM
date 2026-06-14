import { ConvexError } from 'convex/values';

export function sanitizePublicUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function assertOrgMember(ctx: any, organizationId: any, userId: any) {
  if (!userId) {
    throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
  }
  const member = await ctx
    .table('member', 'organizationId_userId', (q: any) =>
      q.eq('organizationId', organizationId).eq('userId', userId),
    )
    .first();
  if (!member) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Not a member of this organization' });
  }
  return member;
}

export function requireStorefrontSession(sessionId: string | undefined) {
  if (!sessionId || sessionId.length < 8) {
    throw new ConvexError({ code: 'BAD_REQUEST', message: 'Valid sessionId required' });
  }
  return sessionId;
}

export function verifyGuestCart(cart: any, organizationId: any, sessionId: string | undefined) {
  const verifiedSessionId = requireStorefrontSession(sessionId);
  if (cart.organizationId !== organizationId || cart.sessionId !== verifiedSessionId) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Not your cart' });
  }
}


export function requireCartAccess(cart: any, organizationId: any, customerId: any | null, sessionId?: string) {
  if (cart.organizationId !== organizationId) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Cart does not belong to this organization' });
  }
  if (customerId && cart.customerId === customerId) return;
  if (cart.sessionId && sessionId && cart.sessionId === sessionId) return;
  throw new ConvexError({ code: 'FORBIDDEN', message: 'Not your cart' });
}

export function requireGuestMutationSession(customerId: any | null, sessionId?: string) {
  if (!customerId) requireStorefrontSession(sessionId);
}

export function publicProductDto(product: any, categoryName?: string, variants: any[] = []) {
  return {
    id: product._id,
    name: product.name,
    description: product.description,
    type: product.type,
    category: product.category,
    categoryName,
    imageUrl: product.imageUrl,
    images: product.images,
    price: product.price,
    unit: product.unit,
    weight: product.weight,
    stock: product.stock,
    slug: product.slug,
    tags: product.tags,
    variants: variants.map((v: any) => ({
      id: v._id,
      name: v.name,
      attributes: v.attributes,
      priceExtra: v.priceExtra,
      active: v.active,
    })),
  };
}

export function orgMemberProductDto(product: any, categoryName?: string, variants: any[] = []) {
  return {
    ...publicProductDto(product, categoryName, variants),
    cost: product.cost,
    sku: product.sku,
    notes: product.notes,
    variants: variants.map((v: any) => ({
      id: v._id,
      name: v.name,
      attributes: v.attributes,
      priceExtra: v.priceExtra,
      active: v.active,
      sku: v.sku,
      barcode: v.barcode,
    })),
  };
}

export type OrderActor =
  | { type: 'guest'; note?: string }
  | { type: 'admin'; userId?: string; note?: string }
  | { type: 'webhook'; provider?: string; note?: string };

const TERMINAL_STOCK_RESTORE_STATUSES = new Set(['cancelled', 'expired']);

export function orderTimelineEntry(status: string, actor: OrderActor) {
  const actorLabel = actor.type === 'webhook' ? `webhook${actor.provider ? `:${actor.provider}` : ''}` : actor.type;
  return {
    status,
    timestamp: Date.now(),
    note: actor.note ?? `Status updated by ${actorLabel}`,
  };
}

export async function transitionOrderStatus(
  ctx: any,
  order: any,
  nextStatus: string,
  actor: OrderActor,
  patch: Record<string, any> = {},
) {
  if (order.status === nextStatus) {
    return { changed: false, stockRestored: false };
  }

  const shouldRestoreStock =
    TERMINAL_STOCK_RESTORE_STATUSES.has(nextStatus) &&
    !TERMINAL_STOCK_RESTORE_STATUSES.has(order.status);

  const currentTimeline = order.orderTimeline ?? [];
  await order.patch({
    ...patch,
    status: nextStatus,
    orderTimeline: [...currentTimeline, orderTimelineEntry(nextStatus, actor)],
  });

  if (shouldRestoreStock) {
    const orderItems = await ctx
      .table('shopOrderItems', 'shopOrderId', (q: any) => q.eq('shopOrderId', order._id));
    for (const item of orderItems) {
      const product = await ctx.table('products').get(item.productId);
      if (product && product.stock != null) {
        await product.patch({ stock: product.stock + item.quantity });
      }
    }
  }

  return { changed: true, stockRestored: shouldRestoreStock };
}


function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateOrderAccessToken() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generator is unavailable');
  }
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashOrderAccessToken(token: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto SHA-256 is unavailable');
  }
  const data = new TextEncoder().encode(token);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

export async function verifyOrderAccessToken(order: any, token: string | undefined) {
  if (!token || !order.orderAccessTokenHash) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Valid order access token required' });
  }
  if (order.orderAccessTokenExpiresAt && order.orderAccessTokenExpiresAt < Date.now()) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Order access token expired' });
  }
  const tokenHash = await hashOrderAccessToken(token);
  if (tokenHash !== order.orderAccessTokenHash) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Invalid order access token' });
  }
}
