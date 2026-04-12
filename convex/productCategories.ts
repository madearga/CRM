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

const categorySchema = z.object({
  id: zid('productCategories'),
  name: z.string(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  parentId: zid('productCategories').optional(),
  organizationId: zid('organization'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function validateUniqueName(
  ctx: any,
  orgId: string,
  name: string,
  excludeId?: string,
) {
  const existing = await ctx
    .table('productCategories', 'organizationId_parentId', (q: any) =>
      q.eq('organizationId', orgId)
    )
    .filter((q: any) => q.eq(q.field('name'), name))
    .first();

  if (existing && existing._id !== excludeId) {
    throw new ConvexError({
      code: 'VALIDATION_ERROR',
      message: `Category "${name}" already exists`,
    });
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all categories for the current org (flat list). */
export const list = createOrgQuery()({
  args: {
    search: z.string().optional(),
  },
  returns: z.array(categorySchema),
  handler: async (ctx, args) => {
    let results = await ctx
      .table('productCategories', 'organizationId_parentId', (q: any) =>
        q.eq('organizationId', ctx.orgId)
      )
      .take(1000);

    // Filter by search
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      results = results.filter((c: any) =>
        c.name.toLowerCase().includes(searchLower)
      );
    }

    return results.map((c: any) => ({
      id: c._id,
      name: c.name,
      description: c.description,
      active: c.active,
      parentId: c.parentId,
      organizationId: c.organizationId,
    }));
  },
});

/** Get a single category by ID. */
export const getById = createOrgQuery()({
  args: { id: zid('productCategories') },
  returns: categorySchema,
  handler: async (ctx, args) => {
    const category = await ctx.table('productCategories').get(args.id);
    if (!category || category.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Category not found',
      });
    }

    return {
      id: category._id,
      name: category.name,
      description: category.description,
      active: category.active,
      parentId: category.parentId,
      organizationId: category.organizationId,
    };
  },
});

/** Get categories as a nested tree structure. */
export const tree = createOrgQuery()({
  args: {},
  returns: z.array(z.any()), // Recursive tree structure — z.any() for children
  handler: async (ctx, _args) => {
    const all = await ctx
      .table('productCategories', 'organizationId_parentId', (q: any) =>
        q.eq('organizationId', ctx.orgId)
      )
      .take(1000);

    const items = all.map((c: any) => ({
      id: c._id,
      name: c.name,
      description: c.description,
      active: c.active,
      parentId: c.parentId,
      children: [] as any[],
    }));

    // Build tree: max 3 levels deep
    const map = new Map(items.map((item: any) => [item.id, item]));
    const roots: typeof items = [];

    for (const item of items) {
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new product category. */
export const create = createOrgMutation()({
  args: {
    name: z.string().min(1),
    description: z.string().optional(),
    parentId: zid('productCategories').optional(),
  },
  returns: zid('productCategories'),
  handler: async (ctx, args) => {
    // Check for duplicate name in org
    await validateUniqueName(ctx, ctx.orgId, args.name);

    // Validate parent exists and belongs to org (max depth check)
    if (args.parentId) {
      const parent = await ctx.table('productCategories').get(args.parentId);
      if (!parent || parent.organizationId !== ctx.orgId) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'Parent category not found',
        });
      }

      // Max depth 3 levels: root → level 1 → level 2
      if (parent.parentId) {
        const grandparent = await ctx
          .table('productCategories')
          .get(parent.parentId);
        if (grandparent?.parentId) {
          throw new ConvexError({
            code: 'VALIDATION_ERROR',
            message: 'Maximum category depth is 3 levels',
          });
        }
      }
    }

    const categoryId = await ctx.table('productCategories').insert({
      name: args.name,
      description: args.description,
      parentId: args.parentId,
      active: true,
      organizationId: ctx.orgId,
    });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: categoryId as unknown as string,
      action: 'category.create',
      after: { name: args.name, parentId: args.parentId },
    });

    return categoryId;
  },
});

/** Update an existing category. */
export const update = createOrgMutation()({
  args: {
    id: zid('productCategories'),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    active: z.boolean().optional(),
    parentId: zid('productCategories').optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const category = await ctx.table('productCategories').getX(id);
    if (category.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Category not found',
      });
    }

    // Check for duplicate name if name is being changed
    if (updates.name && updates.name !== category.name) {
      await validateUniqueName(ctx, ctx.orgId, updates.name, id as unknown as string);
    }

    // Prevent setting self as parent or creating circular reference
    // Also validates max depth (3 levels) in a single traversal
    if (updates.parentId) {
      if (updates.parentId === id) {
        throw new ConvexError({
          code: 'VALIDATION_ERROR',
          message: 'Category cannot be its own parent',
        });
      }

      // Traverse up from new parent, checking for cycles and depth
      let depth = 0;
      let currentId: any = updates.parentId;
      const visited = new Set<string>();
      while (currentId) {
        if (currentId === id) {
          throw new ConvexError({
            code: 'VALIDATION_ERROR',
            message: 'Circular reference detected',
          });
        }
        if (visited.has(currentId as string)) {
          throw new ConvexError({
            code: 'VALIDATION_ERROR',
            message: 'Circular reference detected in existing data',
          });
        }
        visited.add(currentId as string);
        depth++;
        if (depth > 2) {
          throw new ConvexError({
            code: 'VALIDATION_ERROR',
            message: 'Maximum category depth is 3 levels',
          });
        }
        const node = await ctx.table('productCategories').get(currentId);
        currentId = node?.parentId;
      }
    }

    const before = { name: category.name, active: category.active, parentId: category.parentId };

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await category.patch(cleanUpdates);

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: id as unknown as string,
      action: 'category.update',
      before,
      after: cleanUpdates,
    });

    return null;
  },
});

/** Delete a category (only if it has no children and no products). */
export const remove = createOrgMutation()({
  args: { id: zid('productCategories') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const category = await ctx.table('productCategories').getX(args.id);
    if (category.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Category not found',
      });
    }

    // Check for children
    const children = await ctx
      .table('productCategories', 'organizationId_parentId', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('parentId', args.id)
      )
      .take(1000);

    if (children.length > 0) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete category with sub-categories',
      });
    }

    // Check for products referencing this category (FK-based check)
    const productsInCategory = await ctx
      .table('products', 'organizationId_category', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('category', args.id)
      )
      .first();

    if (productsInCategory) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete category with associated products',
      });
    }

    const before = { name: category.name, parentId: category.parentId };

    await category.delete();

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: args.id as unknown as string,
      action: 'category.delete',
      before,
    });

    return null;
  },
});
