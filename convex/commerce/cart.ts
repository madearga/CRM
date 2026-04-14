import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { getOrgId, resolveCustomerId, verifyCartOwnership } from './helpers';
import {
  createPublicMutation,
  createPublicQuery,
} from '../functions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve organization ID from slug. */
// Use imported getOrgId from helpers.ts

/** Find active cart for an authenticated customer. */
async function findActiveCustomerCart(ctx: any, orgId: any, customerId: any) {
  const carts = await ctx
    .table('carts', 'organizationId_customerId_status', (q: any) =>
      q.eq('organizationId', orgId).eq('customerId', customerId).eq('status', 'active')
    )
    .take(1);
  return carts[0] ?? null;
}

/** Find active cart for a guest session. */
async function findActiveSessionCart(ctx: any, sessionId: string) {
  const carts = await ctx
    .table('carts', 'sessionId', (q: any) =>
      q.eq('sessionId', sessionId).eq('status', 'active')
    )
    .take(1);
  return carts[0] ?? null;
}

/** Get or create an active cart. */
async function getOrCreateCart(
  ctx: any,
  orgId: any,
  customerId: any | null,
  sessionId: string | undefined,
) {
  // Authenticated: find by customer
  if (customerId) {
    const existing = await findActiveCustomerCart(ctx, orgId, customerId);
    if (existing) return existing;

    return ctx.table('carts').insert({
      organizationId: orgId,
      customerId,
      status: 'active',
      sessionId: null,
    } as any);
  }

  // Guest: find by sessionId
  if (!sessionId) throw new ConvexError({ code: 'BAD_REQUEST', message: 'sessionId required for guests' });

  const existing = await findActiveSessionCart(ctx, sessionId);
  if (existing) return existing;

  // Guest carts need a customer record. We won't have one for pure guests,
  // so we create a placeholder customer tied to the session.
  const guestCustomer = await ctx.table('customers').insert({
    name: `Guest ${sessionId.slice(0, 8)}`,
    email: `guest-${sessionId.slice(0, 8)}@placeholder`,
    organizationId: orgId,
    userId: undefined,
  } as any);

  return ctx.table('carts').insert({
    organizationId: orgId,
    customerId: guestCustomer._id,
    status: 'active',
    sessionId,
  } as any);
}

/** Resolve the customer ID for the current user (if any). */
// Use imported resolveCustomerId from helpers.ts

/** Verify the caller owns the cart. Throws if not. */
// Use imported verifyCartOwnership from helpers.ts

/** Load cart items with product details. */
async function loadCartItems(ctx: any, cartId: any) {
  const items = await ctx.table('cartItems', 'cartId', (q: any) =>
    q.eq('cartId', cartId)
  ).order('desc');

  const enriched = await Promise.all(
    items.map(async (item: any) => {
      const product = await ctx.table('products').get(item.productId);
      return {
        id: item._id,
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        product: product
          ? {
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl,
              stock: product.stock,
            }
          : null,
      };
    }),
  );
  return enriched;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getCart = createPublicQuery()({
  args: {
    organizationSlug: z.string(),
    sessionId: z.string().optional(),
  },
  returns: z.object({
    id: zid('carts'),
    status: z.string(),
    items: z.array(
      z.object({
        id: zid('cartItems'),
        productId: zid('products'),
        variantId: zid('productVariants').optional(),
        quantity: z.number(),
        unitPrice: z.number(),
        product: z
          .object({
            name: z.string(),
            price: z.number().optional(),
            imageUrl: z.string().optional(),
            stock: z.number().optional(),
          })
          .nullable(),
      }),
    ),
  }).nullable(),
  handler: async (ctx, args) => {
    const orgId = await getOrgId(ctx, args.organizationSlug);
    const customerId = await resolveCustomerId(ctx, orgId, ctx.userId);

    let cart: any;
    if (customerId) {
      cart = await findActiveCustomerCart(ctx, orgId, customerId);
    } else if (args.sessionId) {
      cart = await findActiveSessionCart(ctx, args.sessionId);
    } else {
      return null;
    }

    if (!cart) return null;

    const items = await loadCartItems(ctx, cart._id);
    return {
      id: cart._id,
      status: cart.status,
      items,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const addItem = createPublicMutation()({
  args: {
    organizationSlug: z.string(),
    productId: zid('products'),
    variantId: zid('productVariants').optional(),
    quantity: z.number().min(1),
    sessionId: z.string().optional(),
  },
  returns: z.object({
    id: zid('carts'),
    status: z.string(),
    items: z.array(
      z.object({
        id: zid('cartItems'),
        productId: zid('products'),
        variantId: zid('productVariants').optional(),
        quantity: z.number(),
        unitPrice: z.number(),
        product: z
          .object({
            name: z.string(),
            price: z.number().optional(),
            imageUrl: z.string().optional(),
            stock: z.number().optional(),
          })
          .nullable(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const orgId = await getOrgId(ctx, args.organizationSlug);
    const customerId = await resolveCustomerId(ctx, orgId, ctx.userId);

    // Get or create cart
    const cart = await getOrCreateCart(ctx, orgId, customerId, args.sessionId);
    verifyCartOwnership(cart, customerId, args.sessionId);

    // Get product & verify stock
    const product = await ctx.table('products').getX(args.productId);
    if (product.organizationId !== orgId) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Product not in this organization' });
    }
    if (product.stock !== undefined && product.stock !== null && product.stock < args.quantity) {
      throw new ConvexError({ code: 'OUT_OF_STOCK', message: `Only ${product.stock} available` });
    }

    // Determine effective unit price (variant priceExtra + base)
    let unitPrice = product.price ?? 0;
    if (args.variantId) {
      const variant = await ctx.table('productVariants').get(args.variantId);
      if (variant) {
        unitPrice += variant.priceExtra ?? 0;
      }
    }

    // Dedup: check existing item with same product+variant
    const existingItems = await ctx
      .table('cartItems', 'cartId', (q: any) => q.eq('cartId', cart._id));

    const dup = existingItems.find(
      (i: any) =>
        i.productId === args.productId &&
        (i.variantId ?? undefined) === (args.variantId ?? undefined),
    );

    if (dup) {
      // Increment quantity
      const newQty = dup.quantity + args.quantity;
      // Verify stock for new total
      if (product.stock !== undefined && product.stock !== null && product.stock < newQty) {
        throw new ConvexError({ code: 'OUT_OF_STOCK', message: `Only ${product.stock} available` });
      }
      await ctx.table('cartItems').getX(dup._id).patch({ quantity: newQty });
    } else {
      await ctx.table('cartItems').insert({
        cartId: cart._id,
        productId: args.productId,
        variantId: args.variantId ?? undefined,
        quantity: args.quantity,
        unitPrice,
        organizationId: orgId,
      } as any);
    }

    const items = await loadCartItems(ctx, cart._id);
    return { id: cart._id, status: cart.status, items };
  },
});

export const removeItem = createPublicMutation()({
  args: {
    cartItemId: zid('cartItems'),
    sessionId: z.string().optional(),
  },
  returns: z.boolean(),
  handler: async (ctx, args) => {
    const item = await ctx.table('cartItems').getX(args.cartItemId);
    const cart = await ctx.table('carts').getX(item.cartId);

    const orgId = cart.organizationId;
    const customerId = await resolveCustomerId(ctx, orgId, ctx.userId);
    verifyCartOwnership(cart, customerId, args.sessionId);

    await ctx.table('cartItems').getX(args.cartItemId).delete();
    return true;
  },
});

export const updateQuantity = createPublicMutation()({
  args: {
    cartItemId: zid('cartItems'),
    quantity: z.number().min(0),
    sessionId: z.string().optional(),
  },
  returns: z.boolean(),
  handler: async (ctx, args) => {
    const item = await ctx.table('cartItems').getX(args.cartItemId);
    const cart = await ctx.table('carts').getX(item.cartId);

    const orgId = cart.organizationId;
    const customerId = await resolveCustomerId(ctx, orgId, ctx.userId);
    verifyCartOwnership(cart, customerId, args.sessionId);

    // Quantity <= 0 → delete
    if (args.quantity <= 0) {
      await ctx.table('cartItems').getX(args.cartItemId).delete();
      return true;
    }

    // Verify stock
    const product = await ctx.table('products').get(item.productId);
    if (product?.stock !== undefined && product?.stock !== null && product.stock < args.quantity) {
      throw new ConvexError({ code: 'OUT_OF_STOCK', message: `Only ${product.stock} available` });
    }

    await ctx.table('cartItems').getX(args.cartItemId).patch({ quantity: args.quantity });
    return true;
  },
});

export const clearCart = createPublicMutation()({
  args: {
    organizationSlug: z.string(),
    sessionId: z.string().optional(),
  },
  returns: z.boolean(),
  handler: async (ctx, args) => {
    const orgId = await getOrgId(ctx, args.organizationSlug);
    const customerId = await resolveCustomerId(ctx, orgId, ctx.userId);

    let cart: any;
    if (customerId) {
      cart = await findActiveCustomerCart(ctx, orgId, customerId);
    } else if (args.sessionId) {
      cart = await findActiveSessionCart(ctx, args.sessionId);
    }

    if (!cart) return true;

    verifyCartOwnership(cart, customerId, args.sessionId);

    const items = await ctx
      .table('cartItems', 'cartId', (q: any) => q.eq('cartId', cart._id));

    await Promise.all(items.map((item: any) => ctx.table('cartItems').getX(item._id).delete()));
    return true;
  },
});

export const mergeGuestCart = createPublicMutation()({
  args: {
    organizationSlug: z.string(),
    sessionId: z.string(),
  },
  returns: z.boolean(),
  handler: async (ctx, args) => {
    const orgId = await getOrgId(ctx, args.organizationSlug);

    // Must be authenticated
    if (!ctx.userId) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Must be logged in to merge cart' });
    }

    const customerId = await resolveCustomerId(ctx, orgId, ctx.userId);
    if (!customerId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Customer profile not found' });
    }

    // Find guest cart
    const guestCart = await findActiveSessionCart(ctx, args.sessionId);
    if (!guestCart) return true; // Nothing to merge

    // Get or create authenticated cart
    const authedCart = await getOrCreateCart(ctx, orgId, customerId, undefined);

    // Load guest items
    const guestItems = await ctx
      .table('cartItems', 'cartId', (q: any) => q.eq('cartId', guestCart._id));

    // Load existing authed items for dedup
    const authedItems = await ctx
      .table('cartItems', 'cartId', (q: any) => q.eq('cartId', authedCart._id));

    for (const guestItem of guestItems) {
      const dup = authedItems.find(
        (i: any) =>
          i.productId === guestItem.productId &&
          (i.variantId ?? undefined) === (guestItem.variantId ?? undefined),
      );

      if (dup) {
        // Increment quantity on authed cart
        await ctx.table('cartItems').getX(dup._id).patch({
          quantity: dup.quantity + guestItem.quantity,
        });
      } else {
        // Move item to authed cart
        await ctx.table('cartItems').insert({
          cartId: authedCart._id,
          productId: guestItem.productId,
          variantId: guestItem.variantId ?? undefined,
          quantity: guestItem.quantity,
          unitPrice: guestItem.unitPrice,
          organizationId: orgId,
        } as any);
      }

      // Delete from guest cart
      await ctx.table('cartItems').getX(guestItem._id).delete();
    }

    // Mark guest cart as abandoned
    await ctx.table('carts').getX(guestCart._id).patch({ status: 'abandoned' });

    return true;
  },
});
