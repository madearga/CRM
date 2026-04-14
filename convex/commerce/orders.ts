import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
  createPublicQuery,
} from '../functions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve customer ID for authenticated user. */
async function resolveCustomerId(ctx: any, orgId: any, userId: any | null) {
  if (!userId) return null;
  const customers = await ctx
    .table('customers', 'organizationId_email', (q: any) => q.eq('organizationId', orgId));
  const match = customers.find((c: any) => c.userId === userId);
  return match?._id ?? null;
}

/** Resolve org from slug. */
async function getOrg(ctx: any, slug: string) {
  const org = await ctx.table('organization').get('slug', slug);
  if (!org) throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
  return org;
}

/** Verify caller owns the order. */
async function verifyOrderOwnership(ctx: any, order: any) {
  const customerId = ctx.userId
    ? await resolveCustomerId(ctx, order.organizationId, ctx.userId)
    : null;
  if (!customerId || order.customerId !== customerId) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Not your order' });
  }
}

/** Timeline entry helper. */
function timelineEntry(status: string, note?: string) {
  return { status, timestamp: Date.now(), note };
}

// ---------------------------------------------------------------------------
// 1. getOrderDetail — public query (customer portal)
// ---------------------------------------------------------------------------

export const getOrderDetail = createPublicQuery()({
  args: {
    orderNumber: z.string(),
    organizationSlug: z.string(),
  },
  returns: z.any(),
  handler: async (ctx, args) => {
    const org = await getOrg(ctx, args.organizationSlug);
    const orgId = org._id as any;

    const order = await ctx
      .table('shopOrders', 'organizationId_orderNumber', (q: any) =>
        q.eq('organizationId', orgId).eq('orderNumber', args.orderNumber),
      )
      .first();

    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Order not found' });

    // Verify ownership
    await verifyOrderOwnership(ctx, order);

    // Load items
    const items = await ctx
      .table('shopOrderItems', 'shopOrderId', (q: any) => q.eq('shopOrderId', order._id));

    const customer = await ctx.table('customers').getX(order.customerId);

    return {
      id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      totalAmount: order.totalAmount,
      currency: order.currency,
      notes: order.notes,
      shippingAddress: order.shippingAddress,
      paymentData: order.paymentData,
      orderTimeline: order.orderTimeline,
      createdAt: order._creationTime,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      items: items.map((item: any) => ({
        id: item._id,
        productName: item.productName,
        productPrice: item.productPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        productId: item.productId,
        variantId: item.variantId,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// 2. listOrders — org admin query (CRM dashboard)
// ---------------------------------------------------------------------------

export const listOrders = createOrgPaginatedQuery()({
  args: {
    status: z.string().optional(),
  },
  returns: z.any(),
  handler: async (ctx, args) => {
    const orgId = ctx.orgId;

    let query;
    if (args.status) {
      query = ctx
        .table('shopOrders', 'organizationId_status', (q: any) =>
          q.eq('organizationId', orgId).eq('status', args.status),
        )
        .order('desc');
    } else {
      query = ctx
        .table('shopOrders', 'organizationId_status', (q: any) =>
          q.eq('organizationId', orgId),
        )
        .order('desc');
    }

    const result = await query.paginate(args.paginationOpts);

    // Enrich with customer name
    const page = await Promise.all(
      result.page.map(async (order: any) => {
        const customer = await ctx.table('customers').get(order.customerId);
        return {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount,
          currency: order.currency,
          customerName: customer?.name ?? 'Unknown',
          createdAt: order._creationTime,
        };
      }),
    );

    return {
      page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ---------------------------------------------------------------------------
// 3. updateOrderStatus — org admin mutation
// ---------------------------------------------------------------------------

export const updateOrderStatus = createOrgMutation()({
  args: {
    orderId: zid('shopOrders'),
    status: z.enum([
      'pending_payment',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'expired',
    ]),
  },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    const order = await ctx.table('shopOrders').get(args.orderId);
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Order not found' });

    // Verify order belongs to this org
    if (order.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Order does not belong to this organization' });
    }

    const currentTimeline = order.orderTimeline ?? [];
    await order.patch({
      status: args.status,
      orderTimeline: [...currentTimeline, timelineEntry(args.status, 'Status updated by admin')],
    });

    // If cancelled/expired: restore stock
    if (args.status === 'cancelled' || args.status === 'expired') {
      const orderItems = await ctx
        .table('shopOrderItems', 'shopOrderId', (q: any) => q.eq('shopOrderId', args.orderId));
      for (const item of orderItems) {
        const product = await ctx.table('products').get(item.productId);
        if (product && product.stock != null) {
          await product.patch({ stock: product.stock + item.quantity });
        }
      }
    }

    return { success: true };
  },
});