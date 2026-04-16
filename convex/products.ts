import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import {
  createOrgMutation,
  createOrgPaginatedQuery,
  createOrgQuery,
} from './functions';
import { createAuditLog } from './auditLogs';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const productTypeEnum = z.enum(['storable', 'consumable', 'service']);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List products for current org, optionally filtered & searched (paginated). */
export const list = createOrgPaginatedQuery()({
  args: {
    includeArchived: z.boolean().optional(),
    type: productTypeEnum.optional(),
    category: zid('productCategories').optional(),
    search: z.string().optional(),
  },
  returns: z.object({
    page: z.array(
      z.object({
        id: zid('products'),
        name: z.string(),
        description: z.string().optional(),
        type: productTypeEnum,
        category: zid('productCategories').optional(),
        categoryName: z.string().optional(),
        imageUrl: z.string().optional(),
        cost: z.number().optional(),
        price: z.number().optional(),
        unit: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        weight: z.number().optional(),
        active: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        archivedAt: z.number().optional(),
        ownerId: zid('user'),
        organizationId: zid('organization'),
      })
    ),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    let result;

    if (args.search) {
      // Search index supports filterFields: organizationId, type, category
      result = await ctx
        .table('products')
        .search('search_products', (q: any) => {
          let builder = q.search('name', args.search!).eq('organizationId', orgId);
          if (args.type) builder = (builder as any).eq('type', args.type);
          if (args.category) builder = (builder as any).eq('category', args.category);
          return builder;
        })
        .paginate(args.paginationOpts);
    } else if (args.type || args.category) {
      // Use appropriate index for filtered queries (avoids post-pagination filtering)
      if (args.category) {
        result = await ctx
          .table('products', 'organizationId_category', (q: any) =>
            q.eq('organizationId', orgId).eq('category', args.category)
          )
          .paginate(args.paginationOpts);
      } else {
        result = await ctx
          .table('products', 'organizationId_type', (q: any) =>
            q.eq('organizationId', orgId).eq('type', args.type)
          )
          .paginate(args.paginationOpts);
      }
    } else if (args.includeArchived) {
      result = await ctx
        .table('products', 'organizationId_name', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('products', 'organizationId_archivedAt', (q: any) =>
          q.eq('organizationId', orgId).eq('archivedAt', undefined)
        )
        .paginate(args.paginationOpts);
    }

    let page = result.page as any[];

    // Filter out archived unless requested
    if (!args.includeArchived) {
      page = page.filter((p: any) => !p.archivedAt);
    }

    // For type filter when category index was used, apply post-filter
    if (args.type && args.category) {
      page = page.filter((p: any) => p.type === args.type);
    }

    // Resolve category names
    const categoryIds = [...new Set(page.map((p: any) => p.category).filter(Boolean))];
    const categoryMap = new Map<string, string>();
    await Promise.all(
      categoryIds.map(async (catId) => {
        const cat = await ctx.table('productCategories').get(catId);
        if (cat) categoryMap.set(catId, cat.name);
      })
    );

    return {
      page: page.map((p: any) => ({
        id: p._id,
        name: p.name,
        description: p.description,
        type: p.type,
        category: p.category,
        categoryName: p.category ? categoryMap.get(p.category) : undefined,
        imageUrl: p.imageUrl,
        cost: p.cost,
        price: p.price,
        unit: p.unit,
        sku: p.sku,
        barcode: p.barcode,
        weight: p.weight,
        active: p.active,
        tags: p.tags,
        archivedAt: p.archivedAt,
        ownerId: p.ownerId,
        organizationId: p.organizationId,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/** Get a single product by ID with its variants. */
export const getById = createOrgQuery()({
  args: { id: zid('products') },
  returns: z.object({
    id: zid('products'),
    name: z.string(),
    description: z.string().optional(),
    type: productTypeEnum,
    category: zid('productCategories').optional(),
    categoryName: z.string().optional(),
    imageUrl: z.string().optional(),
    cost: z.number().optional(),
    price: z.number().optional(),
    unit: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    weight: z.number().optional(),
    active: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    archivedAt: z.number().optional(),
    ownerId: zid('user'),
    organizationId: zid('organization'),
    variants: z.array(z.object({
      id: zid('productVariants'),
      name: z.string(),
      attributes: z.record(z.string(), z.string()).optional(),
      priceExtra: z.number().optional(),
      costExtra: z.number().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      weight: z.number().optional(),
      active: z.boolean().optional(),
    })),
  }),
  handler: async (ctx, args) => {
    const product = await ctx.table('products').get(args.id);
    if (!product || product.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Product not found' });
    }

    const variants = await product.edge('variants');

    // Resolve category name
    let categoryName: string | undefined;
    if (product.category) {
      const cat = await ctx.table('productCategories').get(product.category);
      categoryName = cat?.name;
    }

    return {
      id: product._id,
      name: product.name,
      description: product.description,
      type: product.type,
      category: product.category,
      categoryName,
      imageUrl: product.imageUrl,
      cost: product.cost,
      price: product.price,
      unit: product.unit,
      sku: product.sku,
      barcode: product.barcode,
      weight: product.weight,
      active: product.active,
      tags: product.tags,
      notes: product.notes,
      archivedAt: product.archivedAt,
      ownerId: product.ownerId,
      organizationId: product.organizationId,
      variants: variants.map((v: any) => ({
        id: v._id,
        name: v.name,
        attributes: v.attributes,
        priceExtra: v.priceExtra,
        costExtra: v.costExtra,
        sku: v.sku,
        barcode: v.barcode,
        weight: v.weight,
        active: v.active,
      })),
    };
  },
});

/** Get products by category ID. Limited to 1000 results — for dropdowns/selectors. */
export const getByCategory = createOrgQuery()({
  args: { category: zid('productCategories') },
  returns: z.array(
    z.object({
      id: zid('products'),
      name: z.string(),
      type: productTypeEnum,
      price: z.number().optional(),
      sku: z.string().optional(),
    })
  ),
  handler: async (ctx, args) => {
    const results = await ctx
      .table('products', 'organizationId_category', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('category', args.category)
      )
      .filter((q: any) => q.eq(q.field('archivedAt'), undefined))
      .take(1000);

    return results.map((p: any) => ({
      id: p._id,
      name: p.name,
      type: p.type,
      price: p.price,
      sku: p.sku,
    }));
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new product with an auto-generated default variant. */
export const create = createOrgMutation()({
  args: {
    name: z.string().min(1),
    type: productTypeEnum,
    description: z.string().optional(),
    category: zid('productCategories').optional(),
    imageUrl: z.string().optional(),
    cost: z.number().optional(),
    price: z.number().optional(),
    unit: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    weight: z.number().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  },
  returns: zid('products'),
  handler: async (ctx, args) => {
    // Validate category belongs to org
    if (args.category) {
      const cat = await ctx.table('productCategories').get(args.category);
      if (!cat || cat.organizationId !== ctx.orgId) {
        throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Category not found' });
      }
    }

    // 1. Create product
    const productId = await ctx.table('products').insert({
      name: args.name,
      type: args.type,
      description: args.description,
      category: args.category,
      imageUrl: args.imageUrl,
      cost: args.cost,
      price: args.price,
      unit: args.unit,
      sku: args.sku,
      barcode: args.barcode,
      weight: args.weight,
      active: true,
      tags: args.tags,
      notes: args.notes,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
      visibleInShop: true,
    });

    // 2. Auto-create default variant (same name, no extra price)
    await ctx.table('productVariants').insert({
      name: args.name,
      productId,
      organizationId: ctx.orgId,
      active: true,
    });

    // 3. Audit log
    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: productId as unknown as string,
      action: 'create',
      after: {
        name: args.name,
        type: args.type,
        category: args.category,
        price: args.price,
        cost: args.cost,
      },
    });

    return productId;
  },
});

/** Update an existing product (only if in the same org). */
export const update = createOrgMutation()({
  args: {
    id: zid('products'),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    type: productTypeEnum.optional(),
    category: zid('productCategories').optional(),
    imageUrl: z.string().optional(),
    cost: z.number().optional(),
    price: z.number().optional(),
    unit: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    weight: z.number().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const product = await ctx.table('products').getX(id);
    if (product.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Product not found' });
    }

    // Validate category belongs to org
    if (updates.category) {
      const cat = await ctx.table('productCategories').get(updates.category);
      if (!cat || cat.organizationId !== ctx.orgId) {
        throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Category not found' });
      }
    }

    // Snapshot before for audit
    const before = {
      name: product.name,
      type: product.type,
      category: product.category,
      price: product.price,
      cost: product.cost,
      active: product.active,
    };

    // Remove undefined fields
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await product.patch(cleanUpdates);

    // Audit log
    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: id as unknown as string,
      action: 'update',
      before,
      after: cleanUpdates,
    });

    return null;
  },
});

/** Archive (soft delete) a product. */
export const archive = createOrgMutation()({
  args: { id: zid('products') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const product = await ctx.table('products').getX(args.id);
    if (product.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Product not found' });
    }

    await product.patch({ archivedAt: Date.now(), active: false });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: args.id as unknown as string,
      action: 'archive',
      before: { name: product.name, active: product.active },
      after: { archivedAt: true, active: false },
    });

    return null;
  },
});

/** Unarchive (restore) a product. */
export const unarchive = createOrgMutation()({
  args: { id: zid('products') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const product = await ctx.table('products').getX(args.id);
    if (product.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Product not found' });
    }

    await product.patch({ archivedAt: undefined, active: true });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: args.id as unknown as string,
      action: 'unarchive',
      before: { name: product.name, archivedAt: true },
      after: { active: true },
    });

    return null;
  },
});

/** Duplicate a product (with all its variants). */
export const duplicate = createOrgMutation()({
  args: { id: zid('products') },
  returns: zid('products'),
  handler: async (ctx, args) => {
    const product = await ctx.table('products').getX(args.id);
    if (product.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Product not found' });
    }

    // Create copy with "(copy)" suffix
    const newProductId = await ctx.table('products').insert({
      name: `${product.name} (copy)`,
      type: product.type,
      description: product.description,
      category: product.category,
      imageUrl: product.imageUrl,
      cost: product.cost,
      price: product.price,
      unit: product.unit,
      sku: product.sku ? `${product.sku}-copy` : undefined,
      barcode: product.barcode,
      weight: product.weight,
      active: true,
      tags: product.tags,
      notes: product.notes,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    // Copy variants
    const variants = await product.edge('variants');
    for (const variant of variants) {
      await ctx.table('productVariants').insert({
        name: variant.name,
        attributes: variant.attributes,
        priceExtra: variant.priceExtra,
        costExtra: variant.costExtra,
        sku: variant.sku,
        barcode: variant.barcode,
        weight: variant.weight,
        active: variant.active,
        productId: newProductId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: newProductId as unknown as string,
      action: 'duplicate',
      metadata: { sourceProductId: args.id as unknown as string },
    });

    return newProductId;
  },
});
