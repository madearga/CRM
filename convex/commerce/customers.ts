import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import {
  createAuthMutation,
  createAuthQuery,
  createAuthPaginatedQuery,
} from '../functions';

// ---------------------------------------------------------------------------
// registerOrLogin — mutation
// Derives identity from auth session (NOT client args).
// ---------------------------------------------------------------------------
export const registerOrLogin = createAuthMutation()({
  args: {
    organizationSlug: z.string(),
  },
  returns: z.object({
    id: zid('customers'),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    contactId: zid('contacts').optional(),
  }),
  handler: async (ctx, args) => {
    // 1. userId guaranteed by createAuthMutation — ctx.user is populated
    const { user } = ctx;
    const email = user.email;
    const name = user.name || email;
    const avatarUrl = user.image || null;

    // 2. Resolve org by slug
    const org = await ctx.table('organization').get('slug', args.organizationSlug);
    if (!org) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }
    const organizationId = org._id as any;

    // 3. Check existing customer by org+email index
    const existing = await ctx
      .table('customers', 'organizationId_email', (q: any) =>
        q.eq('organizationId', organizationId).eq('email', email)
      )
      .first();

    if (existing) {
      // Update profile fields from latest auth data
      await existing.patch({
        name,
        avatarUrl: avatarUrl ?? undefined,
        userId: user.id,
      });

      return {
        id: existing._id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone ?? null,
        address: existing.address ?? null,
        city: existing.city ?? null,
        postalCode: existing.postalCode ?? null,
        avatarUrl: existing.avatarUrl ?? null,
        contactId: existing.contactId ?? undefined,
      };
    }

    // 4. Check CRM contact with same email for linking
    const contact = await ctx
      .table('contacts', 'organizationId_email', (q: any) =>
        q.eq('organizationId', organizationId).eq('email', email)
      )
      .first();

    // 5. Create new customer
    const customerId = await ctx.table('customers').insert({
      name,
      email,
      avatarUrl: avatarUrl ?? undefined,
      organizationId,
      userId: user.id,
      contactId: contact?._id ?? undefined,
    });

    const customer = await ctx.table('customers').getX(customerId);

    return {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
      city: customer.city ?? null,
      postalCode: customer.postalCode ?? null,
      avatarUrl: customer.avatarUrl ?? null,
      contactId: customer.contactId ?? undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// getProfile — query
// ---------------------------------------------------------------------------
export const getProfile = createAuthQuery()({
  args: {
    organizationSlug: z.string(),
  },
  returns: z.object({
    id: zid('customers'),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    contactId: zid('contacts').optional(),
    orderCount: z.number(),
    totalSpent: z.number(),
  }),
  handler: async (ctx, args) => {
    const { user } = ctx;
    const org = await ctx.table('organization').get('slug', args.organizationSlug);
    if (!org) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }
    const organizationId = org._id as any;

    const customer = await ctx
      .table('customers', 'organizationId_email', (q: any) =>
        q.eq('organizationId', organizationId).eq('email', user.email)
      )
      .first();

    if (!customer) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Customer profile not found' });
    }

    // Aggregate order stats — load via paginate to collect all
    let allOrders: any[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const result = await ctx
        .table('shopOrders', 'organizationId_customerId', (q: any) =>
          q.eq('organizationId', organizationId).eq('customerId', customer._id)
        )
        .paginate({ cursor, numItems: 100 });
      allOrders = allOrders.concat(result.page as any[]);
      cursor = result.continueCursor;
      isDone = result.isDone;
    }

    const paidOrders = allOrders.filter((o: any) => o.paymentStatus === 'paid');
    const orderCount = paidOrders.length;
    const totalSpent = paidOrders.reduce((sum: number, o: any) => sum + (o.totalAmount ?? 0), 0);

    return {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
      city: customer.city ?? null,
      postalCode: customer.postalCode ?? null,
      avatarUrl: customer.avatarUrl ?? null,
      contactId: customer.contactId ?? undefined,
      orderCount,
      totalSpent,
    };
  },
});

// ---------------------------------------------------------------------------
// getOrders — paginated query
// ---------------------------------------------------------------------------
export const getOrders = createAuthPaginatedQuery()({
  args: {
    organizationSlug: z.string(),
  },
  returns: z.object({
    page: z.array(
      z.object({
        id: zid('shopOrders'),
        orderNumber: z.string(),
        status: z.string(),
        paymentStatus: z.string(),
        totalAmount: z.number(),
        currency: z.string(),
        createdAt: z.number().optional(),
      })
    ),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { user } = ctx;
    const org = await ctx.table('organization').get('slug', args.organizationSlug);
    if (!org) {
      return { page: [], continueCursor: '', isDone: true };
    }
    const organizationId = org._id as any;

    const customer = await ctx
      .table('customers', 'organizationId_email', (q: any) =>
        q.eq('organizationId', organizationId).eq('email', user.email)
      )
      .first();

    if (!customer) {
      return { page: [], continueCursor: '', isDone: true };
    }

    const result = await ctx
      .table('shopOrders', 'organizationId_customerId', (q: any) =>
        q.eq('organizationId', organizationId).eq('customerId', customer._id)
      )
      .paginate(args.paginationOpts);

    return {
      page: (result.page as any[]).map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        currency: o.currency,
        createdAt: o._creationTime,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ---------------------------------------------------------------------------
// updateProfile — mutation
// ---------------------------------------------------------------------------
export const updateProfile = createAuthMutation()({
  args: {
    organizationSlug: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
  },
  returns: z.object({
    id: zid('customers'),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    contactId: zid('contacts').optional(),
  }),
  handler: async (ctx, args) => {
    const { user } = ctx;
    const { organizationSlug, ...updates } = args;

    const org = await ctx.table('organization').get('slug', organizationSlug);
    if (!org) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }
    const organizationId = org._id as any;

    const customer = await ctx
      .table('customers', 'organizationId_email', (q: any) =>
        q.eq('organizationId', organizationId).eq('email', user.email)
      )
      .first();

    if (!customer) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Customer profile not found' });
    }

    // Build patch — only provided fields
    const patch: Record<string, any> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.address !== undefined) patch.address = updates.address;
    if (updates.city !== undefined) patch.city = updates.city;
    if (updates.postalCode !== undefined) patch.postalCode = updates.postalCode;

    if (Object.keys(patch).length > 0) {
      await customer.patch(patch);
    }

    // Refetch for latest state
    const updated = await ctx.table('customers').getX(customer._id);

    return {
      id: updated._id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone ?? null,
      address: updated.address ?? null,
      city: updated.city ?? null,
      postalCode: updated.postalCode ?? null,
      avatarUrl: updated.avatarUrl ?? null,
      contactId: updated.contactId ?? undefined,
    };
  },
});
