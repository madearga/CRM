import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import {
  createOrgMutation,
  createOrgQuery,
} from './functions';
import { createAuditLog } from './auditLogs';

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const variantSchema = z.object({
  id: zid('productVariants'),
  name: z.string(),
  attributes: z.record(z.string(), z.string()).optional(),
  priceExtra: z.number().optional(),
  costExtra: z.number().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.number().optional(),
  active: z.boolean().optional(),
  productId: zid('products'),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all variants for a product. */
export const list = createOrgQuery()({
  args: {
    productId: zid('products'),
  },
  returns: z.array(variantSchema),
  handler: async (ctx, args) => {
    // Verify product belongs to org
    const product = await ctx.table('products').get(args.productId);
    if (!product || product.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Product not found',
      });
    }

    const variants = await product.edge('variants');

    return variants.map((v: any) => ({
      id: v._id,
      name: v.name,
      attributes: v.attributes,
      priceExtra: v.priceExtra,
      costExtra: v.costExtra,
      sku: v.sku,
      barcode: v.barcode,
      weight: v.weight,
      active: v.active,
      productId: v.productId,
    }));
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new variant for a product. */
export const create = createOrgMutation()({
  args: {
    productId: zid('products'),
    name: z.string().min(1),
    attributes: z.record(z.string(), z.string()).optional(),
    priceExtra: z.number().optional(),
    costExtra: z.number().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    weight: z.number().optional(),
  },
  returns: zid('productVariants'),
  handler: async (ctx, args) => {
    const { productId, ...variantData } = args;

    // Verify product belongs to org
    const product = await ctx.table('products').get(productId);
    if (!product || product.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Product not found',
      });
    }

    const variantId = await ctx.table('productVariants').insert({
      ...variantData,
      productId,
      organizationId: ctx.orgId,
      active: true,
    });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: productId as unknown as string,
      action: 'variant.create',
      after: { variantId: variantId as unknown as string, name: args.name },
    });

    return variantId;
  },
});

/** Update an existing variant. */
export const update = createOrgMutation()({
  args: {
    id: zid('productVariants'),
    name: z.string().min(1).optional(),
    attributes: z.record(z.string(), z.string()).optional(),
    priceExtra: z.number().optional(),
    costExtra: z.number().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    weight: z.number().optional(),
    active: z.boolean().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const variant = await ctx.table('productVariants').getX(id);
    if (variant.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Variant not found',
      });
    }

    const before = { name: variant.name, priceExtra: variant.priceExtra, active: variant.active };

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await variant.patch(cleanUpdates);

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: variant.productId as unknown as string,
      action: 'variant.update',
      before: { variantId: id as unknown as string, ...before },
      after: { variantId: id as unknown as string, ...cleanUpdates },
    });

    return null;
  },
});

/** Archive (soft delete) a variant. */
export const archive = createOrgMutation()({
  args: { id: zid('productVariants') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const variant = await ctx.table('productVariants').getX(args.id);
    if (variant.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Variant not found',
      });
    }

    await variant.patch({ active: false });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: variant.productId as unknown as string,
      action: 'variant.archive',
      after: { variantId: args.id as unknown as string, active: false },
    });

    return null;
  },
});

/** Unarchive (restore) a variant. */
export const unarchive = createOrgMutation()({
  args: { id: zid('productVariants') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const variant = await ctx.table('productVariants').getX(args.id);
    if (variant.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Variant not found',
      });
    }

    await variant.patch({ active: true });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: variant.productId as unknown as string,
      action: 'variant.unarchive',
      after: { variantId: args.id as unknown as string, active: true },
    });

    return null;
  },
});
