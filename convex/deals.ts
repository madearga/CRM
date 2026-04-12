import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import {
  type DealStage,
  isValidTransition as domainIsValidTransition,
  DEAL_STAGES,
  CURRENCIES,
  DEFAULT_CURRENCY,
} from '@crm/domain';
import { createOrgMutation, createOrgPaginatedQuery, createOrgQuery } from './functions';
import { nextSequence } from './shared/sequenceGenerator';
import { createAuditLog } from './auditLogs';

const DEFAULT_ORG_CURRENCY = DEFAULT_CURRENCY;

const stageEnum = z.enum(DEAL_STAGES);

function validateStageTransition(from: DealStage, to: DealStage) {
  if (!domainIsValidTransition(from, to)) {
    throw new ConvexError({
      code: 'BAD_REQUEST',
      message: `Invalid stage transition from "${from}" to "${to}"`,
    });
  }
}

// List deals for current org, filter archived, optional stage filter (paginated)
export const list = createOrgPaginatedQuery()({
  args: {
    stage: stageEnum.optional(),
  },
  returns: z.object({
    page: z.array(
      z.object({
        id: zid('deals'),
        title: z.string(),
        value: z.number().optional(),
        currency: z.string().optional(),
        probability: z.number().optional(),
        expectedCloseDate: z.number().optional(),
        stage: stageEnum,
        companyId: zid('companies').optional(),
        primaryContactId: zid('contacts').optional(),
        ownerId: zid('user'),
        createdAt: z.number(),
      })
    ),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const query = args.stage
      ? ctx.table('deals', 'organizationId_stage', (q) =>
          q.eq('organizationId', orgId).eq('stage', args.stage!)
        )
      : ctx.table('deals', 'organizationId', (q) => q.eq('organizationId', orgId));

    const result = await query
      .filter((q) => q.eq(q.field('archivedAt'), undefined))
      .paginate(args.paginationOpts);

    return {
      page: result.page.map((deal) => ({
        id: deal._id,
        title: deal.title,
        value: deal.value,
        currency: deal.currency,
        probability: deal.probability,
        expectedCloseDate: deal.expectedCloseDate,
        stage: deal.stage,
        companyId: deal.companyId,
        primaryContactId: deal.primaryContactId,
        ownerId: deal.ownerId,
        createdAt: deal._creationTime,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// Get deals grouped by stage for kanban view
export const listByStage = createOrgQuery()({
  args: {},
  returns: z.object({
    new: z.array(z.object({ id: zid('deals'), title: z.string(), value: z.number().optional(), probability: z.number().optional(), stageEnteredAt: z.number().optional(), ownerId: zid('user') })),
    contacted: z.array(z.object({ id: zid('deals'), title: z.string(), value: z.number().optional(), probability: z.number().optional(), stageEnteredAt: z.number().optional(), ownerId: zid('user') })),
    proposal: z.array(z.object({ id: zid('deals'), title: z.string(), value: z.number().optional(), probability: z.number().optional(), stageEnteredAt: z.number().optional(), ownerId: zid('user') })),
    won: z.array(z.object({ id: zid('deals'), title: z.string(), value: z.number().optional(), probability: z.number().optional(), stageEnteredAt: z.number().optional(), ownerId: zid('user') })),
    lost: z.array(z.object({ id: zid('deals'), title: z.string(), value: z.number().optional(), probability: z.number().optional(), stageEnteredAt: z.number().optional(), ownerId: zid('user') })),
  }),
  handler: async (ctx) => {
    const { orgId } = ctx;

    const allDeals = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(500);

    const activeDeals = allDeals.filter((deal) => !deal.archivedAt);

    const grouped: Record<string, { id: any; title: string; value?: number; probability?: number; stageEnteredAt?: number; ownerId: any }[]> = {
      new: [],
      contacted: [],
      proposal: [],
      won: [],
      lost: [],
    };

    for (const deal of activeDeals) {
      grouped[deal.stage].push({
        id: deal._id,
        title: deal.title,
        value: deal.value,
        probability: deal.probability,
        stageEnteredAt: deal.stageEnteredAt,
        ownerId: deal.ownerId,
      });
    }

    return grouped as any;
  },
});

// Get single deal with company name, contact name
export const getById = createOrgQuery()({
  args: {
    id: zid('deals'),
  },
  returns: z.object({
    id: zid('deals'),
    title: z.string(),
    value: z.number().optional(),
    currency: z.string().optional(),
    probability: z.number().optional(),
    expectedCloseDate: z.number().optional(),
    lostReason: z.string().optional(),
    wonAt: z.number().optional(),
    lostAt: z.number().optional(),
    archivedAt: z.number().optional(),
    stage: stageEnum,
    organizationId: zid('organization'),
    companyId: zid('companies').optional(),
    companyName: z.string().nullish(),
    primaryContactId: zid('contacts').optional(),
    primaryContactName: z.string().nullish(),
    ownerId: zid('user'),
    createdAt: z.number(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const deal = await ctx.table('deals').get(args.id);
    if (!deal || deal.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Deal not found' });
    }

    let companyName: string | null = null;
    if (deal.companyId) {
      const company = await ctx.table('companies').get(deal.companyId);
      companyName = company?.name ?? null;
    }

    let primaryContactName: string | null = null;
    if (deal.primaryContactId) {
      const contact = await ctx.table('contacts').get(deal.primaryContactId);
      primaryContactName = contact?.fullName ?? null;
    }

    return {
      id: deal._id,
      title: deal.title,
      value: deal.value,
      currency: deal.currency,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      lostReason: deal.lostReason,
      wonAt: deal.wonAt,
      lostAt: deal.lostAt,
      archivedAt: deal.archivedAt,
      stage: deal.stage,
      organizationId: deal.organizationId,
      companyId: deal.companyId,
      companyName,
      primaryContactId: deal.primaryContactId,
      primaryContactName,
      ownerId: deal.ownerId,
      createdAt: deal._creationTime,
    };
  },
});

// Create deal, default stage "new", set ownerId
export const create = createOrgMutation()({
  args: {
    title: z.string().min(1).max(200),
    value: z.number().nonnegative().optional(),
    currency: z.string().max(3).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.number().optional(),
    companyId: zid('companies').optional(),
    primaryContactId: zid('contacts').optional(),
  },
  returns: zid('deals'),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const organization = await ctx.table('organization').get(orgId);
    if (!organization) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    const orgCurrency = organization.settings?.currency ?? DEFAULT_ORG_CURRENCY;
    const requestedCurrency = (args.currency ?? orgCurrency).toUpperCase();

    if (!CURRENCIES.includes(requestedCurrency as (typeof CURRENCIES)[number])) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: `Unsupported currency "${requestedCurrency}"`,
      });
    }

    if (requestedCurrency !== orgCurrency) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: `Organization currency is "${orgCurrency}". Deals must use the same currency.`,
      });
    }

    const id = await ctx.table('deals').insert({
      title: args.title,
      value: args.value,
      currency: requestedCurrency,
      probability: args.probability,
      expectedCloseDate: args.expectedCloseDate,
      stage: 'new',
      stageEnteredAt: Date.now(),
      organizationId: orgId,
      companyId: args.companyId,
      primaryContactId: args.primaryContactId,
      ownerId: ctx.user._id,
    });

    return id;
  },
});

// Update deal fields (not stage)
export const update = createOrgMutation()({
  args: {
    id: zid('deals'),
    title: z.string().min(1).max(200).optional(),
    value: z.number().nonnegative().optional(),
    currency: z.string().max(3).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.number().optional(),
    companyId: zid('companies').optional(),
    primaryContactId: zid('contacts').optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const deal = await ctx.table('deals').get(args.id);
    if (!deal || deal.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Deal not found' });
    }

    const { id: _, ...updates } = args;

    if (updates.currency !== undefined) {
      const organization = await ctx.table('organization').get(orgId);
      if (!organization) {
        throw new ConvexError({ code: 'NOT_FOUND', message: 'Organization not found' });
      }

      const orgCurrency = organization.settings?.currency ?? DEFAULT_ORG_CURRENCY;
      const requestedCurrency = updates.currency.toUpperCase();

      if (!CURRENCIES.includes(requestedCurrency as (typeof CURRENCIES)[number])) {
        throw new ConvexError({
          code: 'BAD_REQUEST',
          message: `Unsupported currency "${requestedCurrency}"`,
        });
      }

      if (requestedCurrency !== orgCurrency) {
        throw new ConvexError({
          code: 'BAD_REQUEST',
          message: `Organization currency is "${orgCurrency}". Deals must use the same currency.`,
        });
      }

      updates.currency = requestedCurrency;
    }

    await ctx.table('deals').getX(args.id).patch(updates);

    return null;
  },
});

// Update deal stage with state machine validation
export const updateStage = createOrgMutation()({
  args: {
    id: zid('deals'),
    stage: stageEnum,
    lostReason: z.string().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const deal = await ctx.table('deals').get(args.id);
    if (!deal || deal.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Deal not found' });
    }

    validateStageTransition(deal.stage, args.stage);

    const now = Date.now();
    const patch: Record<string, any> = { stage: args.stage, stageEnteredAt: now };

    if (args.stage === 'won') {
      patch.wonAt = now;
      patch.probability = 100;
    } else if (args.stage === 'lost') {
      if (!args.lostReason) {
        throw new ConvexError({
          code: 'BAD_REQUEST',
          message: 'lostReason is required when moving to "lost" stage',
        });
      }
      patch.lostAt = now;
      patch.lostReason = args.lostReason;
    } else if (args.stage === 'new' && (deal.stage === 'won' || deal.stage === 'lost')) {
      // Reopen: clear won/lost fields
      patch.wonAt = undefined;
      patch.lostAt = undefined;
      patch.lostReason = undefined;
    }

    await ctx.table('deals').getX(args.id).patch(patch);

    return null;
  },
});

// Soft delete (archive)
export const archive = createOrgMutation()({
  args: {
    id: zid('deals'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const deal = await ctx.table('deals').get(args.id);
    if (!deal || deal.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Deal not found' });
    }

    await ctx.table('deals').getX(args.id).patch({ archivedAt: Date.now() });

    return null;
  },
});

// Unarchive (restore)
export const restore = createOrgMutation()({
  args: {
    id: zid('deals'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const deal = await ctx.table('deals').get(args.id);
    if (!deal || deal.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Deal not found' });
    }

    await ctx.table('deals').getX(args.id).patch({ archivedAt: undefined });

    return null;
  },
});

// Convert a won deal to a Sale Order
export const convertToSaleOrder = createOrgMutation()({
  args: {
    id: zid('deals'),
    lines: z.array(z.object({
      productName: z.string(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      productId: zid('products').optional(),
    })).min(1),
  },
  returns: zid('saleOrders'),
  handler: async (ctx, args) => {
    const deal = await ctx.table('deals').getX(args.id);
    if (deal.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Deal not found' });
    }

    if (deal.stage !== 'won') {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Can only convert won deals to sale orders',
      });
    }

    if (deal.convertedToSaleOrderId) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Deal already converted to a Sale Order',
      });
    }

    const number = await nextSequence(ctx, ctx.orgId, 'saleOrder');
    const subtotal = args.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const totalAmount = Math.round(subtotal * 100) / 100;

    const soId = await ctx.table('saleOrders').insert({
      number,
      state: 'draft',
      orderDate: Date.now(),
      subtotal,
      totalAmount,
      source: 'deal',
      companyId: deal.companyId,
      contactId: deal.primaryContactId,
      dealId: args.id,
      invoiceStatus: 'to_invoice',
      deliveryStatus: 'to_deliver',
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of args.lines) {
      const lineSubtotal = line.quantity * line.unitPrice;
      await ctx.table('saleOrderLines').insert({
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: lineSubtotal,
        productId: line.productId,
        saleOrderId: soId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: soId as unknown as string,
      action: 'createFromDeal',
      metadata: { dealId: args.id as unknown as string },
    });

    await ctx.table('deals').getX(args.id).patch({ convertedToSaleOrderId: soId });

    return soId;
  },
});
