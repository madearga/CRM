import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import {
  createPublicPaginatedQuery,
  createPublicQuery,
} from '../functions';

const productTypeEnum = z.enum(['storable', 'consumable', 'service']);

/** List published products visible in shop (paginated, public). */
export const listPublished = createPublicPaginatedQuery({ publicOnly: true })({
  args: {
    organizationSlug: z.string(),
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
        price: z.number().optional(),
        stock: z.number().optional(),
        slug: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    ),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const org = await ctx.table('organization').get('slug', args.organizationSlug);
    if (!org) {
      return { page: [], continueCursor: '', isDone: true };
    }

    const orgId = org._id as any;
    let result;

    if (args.search) {
      result = await ctx
        .table('products')
        .search('search_products', (q: any) => {
          let builder = q.search('name', args.search!).eq('organizationId', orgId);
          if (args.category) builder = builder.eq('category', args.category);
          return builder;
        })
        .paginate(args.paginationOpts);
    } else if (args.category) {
      result = await ctx
        .table('products', 'organizationId_category', (q: any) =>
          q.eq('organizationId', orgId).eq('category', args.category)
        )
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('products', 'organizationId_visibleInShop', (q: any) =>
          q.eq('organizationId', orgId).eq('visibleInShop', true)
        )
        .paginate(args.paginationOpts);
    }

    // Filter to only published + visible products
    let page = (result.page as any[]).filter(
      (p) => p.active !== false && p.visibleInShop === true && !p.archivedAt
    );

    // Extra filter for search/category paths that don't use visibleInShop index
    if (args.search || args.category) {
      page = page.filter((p) => p.visibleInShop === true && p.active !== false && !p.archivedAt);
    }

    // Resolve category names
    const categoryIds = [...new Set(page.map((p) => p.category).filter(Boolean))];
    const categoryMap = new Map<string, string>();
    await Promise.all(
      categoryIds.map(async (catId) => {
        const cat = await ctx.table('productCategories').get(catId);
        if (cat) categoryMap.set(catId, cat.name);
      })
    );

    return {
      page: page.map((p) => ({
        id: p._id,
        name: p.name,
        description: p.description,
        type: p.type,
        category: p.category,
        categoryName: p.category ? categoryMap.get(p.category) : undefined,
        imageUrl: p.imageUrl,
        price: p.price,
        stock: p.stock,
        slug: p.slug,
        tags: p.tags,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/** Get a single published product by slug (public). */
export const getBySlug = createPublicQuery({ publicOnly: true })({
  args: {
    organizationSlug: z.string(),
    slug: z.string(),
  },
  returns: z
    .object({
      id: zid('products'),
      name: z.string(),
      description: z.string().optional(),
      type: productTypeEnum,
      category: zid('productCategories').optional(),
      categoryName: z.string().optional(),
      imageUrl: z.string().optional(),
      images: z.array(z.string()).optional(),
      price: z.number().optional(),
      cost: z.number().optional(),
      unit: z.string().optional(),
      sku: z.string().optional(),
      weight: z.number().optional(),
      stock: z.number().optional(),
      slug: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      variants: z.array(
        z.object({
          id: zid('productVariants'),
          name: z.string(),
          attributes: z.record(z.string(), z.string()).optional(),
          priceExtra: z.number().optional(),
          sku: z.string().optional(),
          barcode: z.string().optional(),
          active: z.boolean().optional(),
        })
      ),
    })
    .nullable(),
  handler: async (ctx, args) => {
    const org = await ctx.table('organization').get('slug', args.organizationSlug);
    if (!org) return null;

    const orgId = org._id as any;

    const products = await ctx
      .table('products', 'organizationId_slug', (q: any) =>
        q.eq('organizationId', orgId).eq('slug', args.slug)
      )
      .take(1);

    const product = products[0] as any;
    if (!product || product.visibleInShop !== true || product.active === false || product.archivedAt) {
      return null;
    }

    // Resolve category
    let categoryName: string | undefined;
    if (product.category) {
      const cat = await ctx.table('productCategories').get(product.category);
      if (cat) categoryName = cat.name;
    }

    // Get variants
    const variantDocs = await ctx
      .table('productVariants', 'organizationId_productId', (q: any) =>
        q.eq('organizationId', orgId).eq('productId', product._id)
      )
      .take(100);

    const variants = (variantDocs as any[])
      .filter((v) => v.active !== false)
      .map((v) => ({
        id: v._id,
        name: v.name,
        attributes: v.attributes,
        priceExtra: v.priceExtra,
        sku: v.sku,
        barcode: v.barcode,
        active: v.active,
      }));

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
      cost: product.cost,
      unit: product.unit,
      sku: product.sku,
      weight: product.weight,
      stock: product.stock,
      slug: product.slug,
      tags: product.tags,
      notes: product.notes,
      variants,
    };
  },
});

/** List shop-visible categories with product counts (public). */
export const listCategories = createPublicQuery({ publicOnly: true })({
  args: {
    organizationSlug: z.string(),
  },
  returns: z.array(
    z.object({
      id: zid('productCategories'),
      name: z.string(),
      description: z.string().optional(),
      productCount: z.number(),
    })
  ),
  handler: async (ctx, args) => {
    const org = await ctx.table('organization').get('slug', args.organizationSlug);
    if (!org) return [];

    const orgId = org._id as any;

    // Get all visible products
    const visibleProducts = await ctx
      .table('products', 'organizationId_visibleInShop', (q: any) =>
        q.eq('organizationId', orgId).eq('visibleInShop', true)
      )
      .take(1000);

    // Filter active + non-archived
    const activeVisible = (visibleProducts as any[]).filter(
      (p) => p.active !== false && !p.archivedAt
    );

    // Count products per category
    const categoryCounts = new Map<string, number>();
    for (const p of activeVisible) {
      if (p.category) {
        categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
      }
    }

    // Resolve categories that have at least one product
    const result: Array<{
      id: any;
      name: string;
      description: string | undefined;
      productCount: number;
    }> = [];
    for (const [catId, count] of categoryCounts) {
      const cat = await ctx.table('productCategories').get(catId as any);
      if (cat && cat.active !== false) {
        result.push({
          id: cat._id,
          name: cat.name,
          description: cat.description,
          productCount: count,
        });
      }
    }

    return result;
  },
});
