import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
  createPublicQuery,
} from '../functions';
import { getOrgId, resolveCustomerId } from './helpers';
import { transitionOrderStatus, verifyOrderAccessToken } from './security';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// resolveCustomerId, getOrgId, timelineEntry — imported from ./helpers

/** Resolve org from slug (returns full org object, not just id). */
async function getOrg(ctx: any, slug: string) {
  const org = await ctx.table('organization').get('slug', slug);
  if (!org) throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
  return org;
}

/** Verify caller owns the order. */
async function verifyOrderOwnership(ctx: any, order: any, orderAccessToken?: string) {
  const customerId = ctx.userId
    ? await resolveCustomerId(ctx, order.organizationId, ctx.userId)
    : null;
  if (customerId && order.customerId === customerId) return;
  await verifyOrderAccessToken(order, orderAccessToken);
}

// ---------------------------------------------------------------------------
// 1. getOrderDetail — public query (customer portal)
// ---------------------------------------------------------------------------

export const getOrderDetail = createPublicQuery()({
  args: {
    orderNumber: z.string(),
    organizationSlug: z.string(),
    orderAccessToken: z.string().optional(),
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
    await verifyOrderOwnership(ctx, order, args.orderAccessToken);

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

    // Batch customer lookups (deduplicated)
    const customerIds = [...new Set(result.page.map((o: any) => o.customerId).filter(Boolean))];
    const customerMap = new Map<string, string>();
    await Promise.all(
      customerIds.map(async (id) => {
        const c = await ctx.table('customers').get(id as any);
        if (c) customerMap.set(id as string, c.name);
      }),
    );

    const page = result.page.map((order: any) => ({
      id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      currency: order.currency,
      customerName: order.customerId ? customerMap.get(order.customerId) ?? 'Unknown' : 'Unknown',
      createdAt: order._creationTime,
    }));

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

    // Permission check: only admin/owner can change order status
    const membership = await ctx
      .table('member', 'organizationId_userId', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('userId', ctx.user._id)
      )
      .first();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Only admin/owner can update order status' });
    }

    // Idempotency check: prevent repeated cancel/expire that could inflate stock
    if (['cancelled', 'expired'].includes(args.status) && ['cancelled', 'expired'].includes(order.status)) {
      throw new ConvexError({ code: 'CONFLICT', message: `Order is already ${order.status}` });
    }

    await transitionOrderStatus(ctx, order, args.status, {
      type: 'admin',
      userId: String(ctx.user._id),
      note: 'Status updated by admin',
    });

    return { success: true };
  },
});