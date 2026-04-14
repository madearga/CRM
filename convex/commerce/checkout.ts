import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { httpAction } from '../_generated/server';
import { internal } from '../_generated/api';
import {
  createPublicMutation,
  createPublicQuery,
  createInternalMutation,
} from '../functions';
import { getOrgId, resolveCustomerId, verifyCartOwnership, timelineEntry } from './helpers';
import { getPaymentProvider, getProviderConfig } from './payments/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find active cart by customer or session. */
async function findActiveCart(ctx: any, orgId: any, customerId: any | null, sessionId?: string) {
  if (customerId) {
    const carts = await ctx
      .table('carts', 'organizationId_customerId_status', (q: any) =>
        q.eq('organizationId', orgId).eq('customerId', customerId).eq('status', 'active'),
      )
      .take(1);
    if (carts[0]) return carts[0];
  }
  if (sessionId) {
    const carts = await ctx
      .table('carts', 'sessionId', (q: any) =>
        q.eq('sessionId', sessionId).eq('status', 'active'),
      )
      .take(1);
    if (carts[0]) return carts[0];
  }
  return null;
}

// getOrgId, resolveCustomerId, verifyCartOwnership, timelineEntry — imported from ./helpers

/** Format date as YYYYMMDD. */
function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** Restore stock for a list of { productId, quantity }. */
async function restoreStock(ctx: any, items: Array<{ productId: any; quantity: number }>) {
  for (const item of items) {
    const product = await ctx.table('products').get(item.productId);
    if (product && product.stock != null) {
      await product.patch({ stock: product.stock + item.quantity });
    }
  }
}

// ---------------------------------------------------------------------------
// 1. initiateCheckout — mutation
// ---------------------------------------------------------------------------

export const initiateCheckout = createPublicMutation()({
  args: {
    organizationSlug: z.string(),
    shippingAddress: z.object({
      recipientName: z.string(),
      phone: z.string(),
      address: z.string(),
      city: z.string(),
      postalCode: z.string(),
    }),
    notes: z.string().optional(),
    sessionId: z.string().optional(),
  },
  returns: z.object({
    orderId: zid('shopOrders'),
    orderNumber: z.string(),
    paymentData: z.any().nullable(),
  }),
  handler: async (ctx, args) => {
    const orgId = await getOrgId(ctx, args.organizationSlug);

    // Resolve customer
    const customerId = await resolveCustomerId(ctx, orgId, ctx.userId);

    // Find active cart
    const cart = await findActiveCart(ctx, orgId, customerId, args.sessionId);
    if (!cart) throw new ConvexError({ code: 'NOT_FOUND', message: 'No active cart' });
    verifyCartOwnership(cart, customerId, args.sessionId);

    // Load cart items
    const cartItems = await ctx.table('cartItems', 'cartId', (q: any) => q.eq('cartId', cart._id));
    if (cartItems.length === 0) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Cart is empty' });
    }

    // --- Validate & decrement stock ---
    const stockSnapshots: Array<{ productId: any; quantity: number }> = [];
    for (const item of cartItems) {
      const product = await ctx.table('products').get(item.productId);
      if (!product) {
        await restoreStock(ctx, stockSnapshots);
        throw new ConvexError({ code: 'NOT_FOUND', message: `Product ${item.productId} not found` });
      }

      // Price guard
      if (item.unitPrice !== (product.price ?? 0)) {
        await restoreStock(ctx, stockSnapshots);
        throw new ConvexError({
          code: 'CONFLICT',
          message: `Price changed for "${product.name}". Please refresh your cart.`,
        });
      }

      // Stock guard
      if (product.stock != null && product.stock < item.quantity) {
        await restoreStock(ctx, stockSnapshots);
        throw new ConvexError({
          code: 'CONFLICT',
          message: `Insufficient stock for "${product.name}"`,
        });
      }

      // Atomic decrement
      if (product.stock != null) {
        await product.patch({ stock: product.stock - item.quantity });
      }
      stockSnapshots.push({ productId: item.productId, quantity: item.quantity });
    }

    // --- Generate order number (atomic counter) ---
    const now = Date.now();
    const dk = dateKey(now);
    const existingCounter = await ctx
      .table('orderCounters', 'organizationId_date', (q: any) =>
        q.eq('organizationId', orgId).eq('date', dk),
      )
      .first();

    let counter: number;
    if (existingCounter) {
      counter = existingCounter.counter + 1;
      await existingCounter.patch({ counter });
    } else {
      counter = 1;
      await ctx.table('orderCounters').insert({
        organizationId: orgId,
        date: dk,
        counter: 1,
      } as any);
    }
    const orderNumber = `ORD-${dk}-${String(counter).padStart(4, '0')}`;

    // --- Calculate totals ---
    let subtotal = 0;
    const orderItemData: Array<{
      productName: string;
      productPrice: number;
      quantity: number;
      subtotal: number;
      productId: any;
      variantId: any;
    }> = [];

    for (const item of cartItems) {
      const product = await ctx.table('products').get(item.productId);
      const lineSubtotal = item.unitPrice * item.quantity;
      subtotal += lineSubtotal;
      orderItemData.push({
        productName: product!.name,
        productPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        productId: item.productId,
        variantId: item.variantId ?? undefined,
      });
    }

    // Shipping: flat rate 10000, free above 500000 (configurable per org later)
    const shippingCost = subtotal >= 500000 ? 0 : 10000;
    const totalAmount = subtotal + shippingCost;

    // Currency from org settings or default IDR
    const org = await ctx.table('organization').getX(orgId);
    const currency = (org.settings as any)?.currency ?? 'IDR';

    // --- Create shopOrder ---
    const tlEntry = timelineEntry('pending_payment', 'Order created');
    const orderId = await ctx.table('shopOrders').insert({
      organizationId: orgId,
      customerId: cart.customerId,
      orderNumber,
      status: 'pending_payment',
      paymentStatus: 'pending',
      subtotal,
      shippingCost,
      totalAmount,
      currency,
      notes: args.notes,
      shippingAddress: args.shippingAddress,
      orderTimeline: [tlEntry],
    } as any);

    // --- Create shopOrderItems ---
    for (const line of orderItemData) {
      await ctx.table('shopOrderItems').insert({
        shopOrderId: orderId,
        organizationId: orgId,
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        productPrice: line.productPrice,
        quantity: line.quantity,
        subtotal: line.subtotal,
      } as any);
    }

    // --- Mark cart converted ---
    await cart.patch({ status: 'converted' });

    // --- Initiate payment via provider config ---
    const ppConfig = await ctx
      .table('paymentProviders', 'organizationId_provider', (q: any) =>
        q.eq('organizationId', orgId).eq('provider', 'midtrans'),
      )
      .first();

    if (!ppConfig) {
      // Order created but no payment provider configured
      return { orderId, orderNumber, paymentData: null };
    }

    const provider = getPaymentProvider('midtrans');
    const config = getProviderConfig({
      providerName: 'midtrans',
      dbRecord: {
        sandboxMode: ppConfig.sandboxMode ?? false,
        config: ppConfig.config as Record<string, any>,
      },
    });

    // Get customer details for payment
    const customer = await ctx.table('customers').getX(cart.customerId);
    const paymentResult = await provider.initiatePayment({
      orderId: orderNumber,
      amount: totalAmount,
      currency,
      itemDetails: orderItemData.map((l) => ({
        id: l.productId,
        name: l.productName,
        price: l.productPrice,
        quantity: l.quantity,
      })),
      customerDetails: {
        firstName: customer.name,
        email: customer.email,
        phone: customer.phone ?? undefined,
      },
      config,
    });

    // Update order with payment refs
    const order = await ctx.table('shopOrders').getX(orderId);
    await order.patch({
      paymentProvider: 'midtrans',
      paymentRef: paymentResult.paymentRef,
      paymentData: paymentResult.clientData,
    });

    return {
      orderId,
      orderNumber,
      paymentData: paymentResult.clientData,
    };
  },
});

// ---------------------------------------------------------------------------
// 2. handlePaymentWebhook — httpAction (delegates to internal mutation)
// ---------------------------------------------------------------------------

export const handlePaymentWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();

  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const orderNumber: string = parsed.order_id ?? '';
  const transactionStatus: string = parsed.transaction_status ?? '';
  const transactionId: string = parsed.transaction_id ?? '';
  const fraudStatus: string = parsed.fraud_status ?? '';
  const paymentType: string = parsed.payment_type ?? '';
  const transactionTime: string = parsed.transaction_time ?? '';
  const grossAmount: string = parsed.gross_amount ?? '';
  const statusCode: string = parsed.status_code ?? '';
  const signatureKey: string = parsed.signature_key ?? '';

  // Verify Midtrans signature (mandatory)
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    console.error('MIDTRANS_SERVER_KEY not configured');
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (!signatureKey) {
    return Response.json({ error: 'Missing signature' }, { status: 401 });
  }
  const expectedInput = [orderNumber, statusCode, grossAmount, serverKey].join('');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(expectedInput));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (computed !== signatureKey) {
    return Response.json({ error: 'Signature verification failed' }, { status: 401 });
  }

  try {
    await ctx.runMutation(internal.commerce.checkout.processWebhook, {
      orderNumber,
      transactionStatus,
      transactionId,
      fraudStatus,
      paymentType,
      transactionTime,
      grossAmount,
      statusCode,
      signatureKey,
    });
  } catch (e: any) {
    console.error('Webhook processing failed:', e);
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }

  return Response.json({ received: true });
});

// ---------------------------------------------------------------------------
// 2b. processWebhook — internal mutation (does all DB work)
// ---------------------------------------------------------------------------

export const processWebhook = createInternalMutation()({
  args: {
    orderNumber: z.string(),
    transactionStatus: z.string(),
    transactionId: z.string(),
    fraudStatus: z.string(),
    paymentType: z.string(),
    transactionTime: z.string(),
    grossAmount: z.string(),
    statusCode: z.string(),
    signatureKey: z.string(),
  },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    // Find order directly by orderNumber using global index (O(1) instead of O(orgs))
    const order = await ctx
      .table('shopOrders', 'orderNumber', (q: any) =>
        q.eq('orderNumber', args.orderNumber),
      )
      .first();

    if (!order) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    const orgId = order.organizationId;
    // Signature verification is done in the httpAction layer (crypto.subtle
    // is available there but not inside mutations).

    // Map transaction status to our statuses
    const statusMap: Record<string, { status: string; paymentStatus: string }> = {
      capture: { status: 'paid', paymentStatus: 'paid' },
      settlement: { status: 'paid', paymentStatus: 'paid' },
      deny: { status: 'pending_payment', paymentStatus: 'failed' },
      cancel: { status: 'cancelled', paymentStatus: 'failed' },
      expire: { status: 'expired', paymentStatus: 'expired' },
      pending: { status: 'pending_payment', paymentStatus: 'pending' },
      refund: { status: 'pending_payment', paymentStatus: 'refunded' },
    };

    const mapped = statusMap[args.transactionStatus];
    if (!mapped) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: `Unknown status: ${args.transactionStatus}` });
    }

    // Idempotency: skip if already in target state (duplicate webhook)
    if (order.status === mapped.status && order.paymentStatus === mapped.paymentStatus) {
      return { success: true };
    }

    // Update order
    const currentTimeline = order.orderTimeline ?? [];
    await order.patch({
      status: mapped.status as any,
      paymentStatus: mapped.paymentStatus as any,
      paymentRef: args.transactionId,
      orderTimeline: [...currentTimeline, timelineEntry(mapped.status, `Payment ${args.transactionStatus}`)],
    });

    // If cancelled/expired: restore stock
    if (mapped.status === 'cancelled' || mapped.status === 'expired') {
      const orderItems = await ctx
        .table('shopOrderItems', 'shopOrderId', (q: any) => q.eq('shopOrderId', order._id));
      for (const item of orderItems) {
        const product = await ctx.table('products').get(item.productId);
        if (product && product.stock != null) {
          await product.patch({ stock: product.stock + item.quantity });
        }
      }
    }

    // If paid: create a CRM saleOrder link
    if (mapped.status === 'paid' && !order.saleOrderId) {
      const customer = await ctx.table('customers').getX(order.customerId);
      const saleOrderNumber = `SO-${Date.now()}`;
      const saleOrderId = await ctx.table('saleOrders').insert({
        organizationId: orgId,
        number: saleOrderNumber,
        state: 'confirmed',
        orderDate: Date.now(),
        subtotal: order.subtotal,
        totalAmount: order.totalAmount,
        currency: order.currency,
        customerNotes: order.notes ?? undefined,
        source: 'manual' as const,
        contactId: customer.contactId ?? undefined,
      } as any);

      await order.patch({ saleOrderId });
    }

    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// 3. checkPaymentStatus — query
// ---------------------------------------------------------------------------

export const checkPaymentStatus = createPublicQuery()({
  args: {
    orderId: zid('shopOrders'),
  },
  returns: z.object({
    status: z.string(),
    paymentStatus: z.string(),
  }),
  handler: async (ctx, args) => {
    const order = await ctx.table('shopOrders').get(args.orderId);
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Order not found' });

    // Verify ownership
    const customerId = ctx.userId
      ? await resolveCustomerId(ctx, order.organizationId, ctx.userId)
      : null;
    if (!customerId || order.customerId !== customerId) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Not your order' });
    }

    return {
      status: order.status,
      paymentStatus: order.paymentStatus,
    };
  },
});

// ---------------------------------------------------------------------------
// 4. cancelOrder — mutation
// ---------------------------------------------------------------------------

export const cancelOrder = createPublicMutation()({
  args: {
    orderId: zid('shopOrders'),
  },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    const order = await ctx.table('shopOrders').get(args.orderId);
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Order not found' });

    // Verify ownership
    const customerId = ctx.userId
      ? await resolveCustomerId(ctx, order.organizationId, ctx.userId)
      : null;
    if (!customerId || order.customerId !== customerId) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Not your order' });
    }

    // Only cancel pending_payment
    if (order.status !== 'pending_payment') {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Can only cancel orders awaiting payment' });
    }

    // Restore stock
    const orderItems = await ctx
      .table('shopOrderItems', 'shopOrderId', (q: any) => q.eq('shopOrderId', args.orderId));
    for (const item of orderItems) {
      const product = await ctx.table('products').get(item.productId);
      if (product && product.stock != null) {
        await product.patch({ stock: product.stock + item.quantity });
      }
    }

    // Update status
    const currentTimeline = order.orderTimeline ?? [];
    await order.patch({
      status: 'cancelled',
      paymentStatus: 'failed',
      orderTimeline: [...currentTimeline, timelineEntry('cancelled', 'Cancelled by customer')],
    });

    return { success: true };
  },
});
