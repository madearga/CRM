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

const pricelistTypeEnum = z.enum(['fixed', 'percentage_discount', 'formula']);

const priceRuleSchema = z.object({
  productId: zid('products').optional(),
  productCategoryId: zid('productCategories').optional(),
  minQuantity: z.number().optional(),
  fixedPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  formula: z.string().optional(),
  startDate: z.number().optional(),
  endDate: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List pricelists for current org, optionally filtered & searched (paginated). */
export const list = createOrgPaginatedQuery()({
  args: {
    includeArchived: z.boolean().optional(),
    isActive: z.boolean().optional(),
    search: z.string().optional(),
  },
  returns: z.object({
    page: z.array(
      z.object({
        id: zid('pricelists'),
        name: z.string(),
        description: z.string().optional(),
        type: pricelistTypeEnum,
        defaultDiscount: z.number().optional(),
        currency: z.string().optional(),
        priority: z.number().optional(),
        isActive: z.boolean().optional(),
        archivedAt: z.number().optional(),
        ruleCount: z.number(),
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
      result = await ctx
        .table('pricelists')
        .search('search_pricelists', (q: any) =>
          q.search('name', args.search!).eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('pricelists', 'organizationId_active', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    }

    let page = result.page as any[];

    // Filter archived unless requested
    if (!args.includeArchived) {
      page = page.filter((p: any) => !p.archivedAt);
    }

    // Filter by active status
    if (args.isActive !== undefined) {
      page = page.filter((p: any) => p.isActive === args.isActive);
    }

    // Get rule counts
    const pagesWithCounts = await Promise.all(
      page.map(async (p: any) => {
        const rules = await p.edge('rules');
        return {
          id: p._id,
          name: p.name,
          description: p.description,
          type: p.type,
          defaultDiscount: p.defaultDiscount,
          currency: p.currency,
          priority: p.priority,
          isActive: p.isActive,
          archivedAt: p.archivedAt,
          ruleCount: rules.length,
          organizationId: p.organizationId,
        };
      })
    );

    return {
      page: pagesWithCounts,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/** Get a single pricelist by ID with its rules. */
export const getById = createOrgQuery()({
  args: { id: zid('pricelists') },
  returns: z.object({
    id: zid('pricelists'),
    name: z.string(),
    description: z.string().optional(),
    type: pricelistTypeEnum,
    defaultDiscount: z.number().optional(),
    currency: z.string().optional(),
    priority: z.number().optional(),
    isActive: z.boolean().optional(),
    archivedAt: z.number().optional(),
    organizationId: zid('organization'),
    rules: z.array(
      z.object({
        id: zid('priceRules'),
        productId: zid('products').optional(),
        productCategoryId: zid('productCategories').optional(),
        productName: z.string().optional(),
        categoryName: z.string().optional(),
        minQuantity: z.number().optional(),
        fixedPrice: z.number().optional(),
        discountPercent: z.number().optional(),
        formula: z.string().optional(),
        startDate: z.number().optional(),
        endDate: z.number().optional(),
      })
    ),
    companies: z.array(
      z.object({
        id: zid('companies'),
        name: z.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const pricelist = await ctx.table('pricelists').get(args.id);
    if (!pricelist || pricelist.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Pricelist not found' });
    }

    const rules = await pricelist.edge('rules');
    const companies = await pricelist.edge('applicableCompanies');

    // Resolve product & category names for rules
    const rulesWithNames = await Promise.all(
      rules.map(async (r: any) => {
        let productName: string | undefined;
        let categoryName: string | undefined;
        if (r.productId) {
          const product = await ctx.table('products').get(r.productId);
          productName = product?.name;
        }
        if (r.productCategoryId) {
          const cat = await ctx.table('productCategories').get(r.productCategoryId);
          categoryName = cat?.name;
        }
        return {
          id: r._id,
          productId: r.productId,
          productCategoryId: r.productCategoryId,
          productName,
          categoryName,
          minQuantity: r.minQuantity,
          fixedPrice: r.fixedPrice,
          discountPercent: r.discountPercent,
          formula: r.formula,
          startDate: r.startDate,
          endDate: r.endDate,
        };
      })
    );

    return {
      id: pricelist._id,
      name: pricelist.name,
      description: pricelist.description,
      type: pricelist.type,
      defaultDiscount: pricelist.defaultDiscount,
      currency: pricelist.currency,
      priority: pricelist.priority,
      isActive: pricelist.isActive,
      archivedAt: pricelist.archivedAt,
      organizationId: pricelist.organizationId,
      rules: rulesWithNames,
      companies: companies.map((c: any) => ({ id: c._id, name: c.name })),
    };
  },
});

/** Get all active pricelists for dropdowns (limited). */
export const listActive = createOrgQuery()({
  args: {},
  returns: z.array(
    z.object({
      id: zid('pricelists'),
      name: z.string(),
      type: pricelistTypeEnum,
      defaultDiscount: z.number().optional(),
    })
  ),
  handler: async (ctx) => {
    const results = await ctx
      .table('pricelists', 'organizationId_active', (q: any) =>
        q.eq('organizationId', ctx.orgId)
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field('archivedAt'), undefined),
          q.eq(q.field('isActive'), true)
        )
      )
      .take(500);

    return results.map((p: any) => ({
      id: p._id,
      name: p.name,
      type: p.type,
      defaultDiscount: p.defaultDiscount,
    }));
  },
});

// ---------------------------------------------------------------------------
// Price Resolution
// ---------------------------------------------------------------------------

/** Resolve the effective price for a product given company & quantity. */
export const resolvePrice = createOrgQuery()({
  args: {
    productId: zid('products'),
    companyId: zid('companies').optional(),
    quantity: z.number().optional(),
  },
  returns: z.object({
    basePrice: z.number(),
    finalPrice: z.number(),
    pricelistId: zid('pricelists').optional(),
    pricelistName: z.string().optional(),
    discountPercent: z.number().optional(),
    ruleApplied: z.string().optional(),
  }),
  handler: async (ctx, args) => {
    // 1. Get product base price
    const product = await ctx.table('products').get(args.productId);
    if (!product || product.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Product not found' });
    }

    const basePrice = product.price ?? 0;
    let pricelistId: any;
    let pricelist: any;

    // 2. Check if company has a pricelist assigned
    if (args.companyId) {
      const company = await ctx.table('companies').get(args.companyId);
      if (company?.pricelistId) {
        pricelistId = company.pricelistId;
        pricelist = await ctx.table('pricelists').get(pricelistId);
      }
    }

    // 3. If no company pricelist, try to find a default active pricelist
    if (!pricelistId) {
      return {
        basePrice,
        finalPrice: basePrice,
        pricelistId: undefined,
        pricelistName: undefined,
        discountPercent: undefined,
        ruleApplied: undefined,
      };
    }

    if (!pricelist) {
      return {
        basePrice,
        finalPrice: basePrice,
        pricelistId: undefined,
        pricelistName: undefined,
        discountPercent: undefined,
        ruleApplied: undefined,
      };
    }

    // 4. Get rules for this pricelist
    const rules = await pricelist.edge('rules');
    const now = Date.now();
    const qty = args.quantity ?? 1;

    // 5. Find best matching rule:
    //    Priority: productId match > categoryId match > wildcard (all null)
    //    Among matches: higher minQuantity wins (volume tier)
    //    Check promotional period (startDate/endDate)
    let bestRule: any = null;
    let bestScore = -1;

    for (const rule of rules) {
      // Check promotional period
      if (rule.startDate && now < rule.startDate) continue;
      if (rule.endDate && now > rule.endDate) continue;

      // Check minQuantity
      if (rule.minQuantity && qty < rule.minQuantity) continue;

      // Score: productId match = 3, categoryId match = 2, wildcard = 1
      let score = 0;
      if (rule.productId === args.productId) {
        score = 3;
      } else if (rule.productId) {
        // Rule targets different product
        continue;
      }

      if (rule.productCategoryId && rule.productCategoryId === product.category) {
        score += 2;
      } else if (rule.productCategoryId && rule.productCategoryId !== product.category) {
        // Rule targets different category
        continue;
      }

      if (!rule.productId && !rule.productCategoryId) {
        score = 1; // wildcard
      }

      // Prefer higher minQuantity (volume tier) among same-score rules
      const volumeBonus = (rule.minQuantity ?? 0) / 1000000;
      const totalScore = score + volumeBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestRule = rule;
      }
    }

    // 6. Apply rule
    if (bestRule) {
      let finalPrice = basePrice;
      let discountPercent: number | undefined;

      if (pricelist.type === 'fixed' && bestRule.fixedPrice != null) {
        finalPrice = bestRule.fixedPrice;
        if (basePrice > 0) {
          discountPercent = Math.round((1 - finalPrice / basePrice) * 10000) / 100;
        }
      } else if (pricelist.type === 'percentage_discount' && bestRule.discountPercent != null) {
        discountPercent = bestRule.discountPercent;
        finalPrice = basePrice * (1 - (discountPercent as number) / 100);
      } else if (pricelist.type === 'formula' && bestRule.formula) {
        // Simple formula evaluation: base * 0.9, base - 1000, etc.
        try {
          const formula = bestRule.formula.replace(/base/gi, String(basePrice));
          finalPrice = new Function('return ' + formula)() as number;
          if (isNaN(finalPrice)) finalPrice = basePrice;
        } catch {
          finalPrice = basePrice;
        }
      }

      const ruleDesc = bestRule.productId
        ? 'Product-specific rule'
        : bestRule.productCategoryId
        ? 'Category rule'
        : 'Wildcard rule';

      return {
        basePrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        pricelistId,
        pricelistName: pricelist.name,
        discountPercent,
        ruleApplied: bestRule.minQuantity
          ? `${ruleDesc} (qty ≥ ${bestRule.minQuantity})`
          : ruleDesc,
      };
    }

    // 7. No matching rule — apply pricelist defaultDiscount
    if (pricelist.defaultDiscount) {
      const finalPrice = basePrice * (1 - pricelist.defaultDiscount / 100);
      return {
        basePrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        pricelistId,
        pricelistName: pricelist.name,
        discountPercent: pricelist.defaultDiscount,
        ruleApplied: `Default discount (${pricelist.defaultDiscount}%)`,
      };
    }

    // 8. No rule, no default discount — return base price
    return {
      basePrice,
      finalPrice: basePrice,
      pricelistId,
      pricelistName: pricelist.name,
      discountPercent: undefined,
      ruleApplied: undefined,
    };
  },
});

/** Resolve prices for multiple products at once (batch). */
export const resolvePrices = createOrgQuery()({
  args: {
    productIds: z.array(zid('products')),
    companyId: zid('companies').optional(),
    quantities: z.array(z.number()).optional(),
  },
  returns: z.array(
    z.object({
      productId: zid('products'),
      basePrice: z.number(),
      finalPrice: z.number(),
      pricelistId: zid('pricelists').optional(),
      pricelistName: z.string().optional(),
      discountPercent: z.number().optional(),
      ruleApplied: z.string().optional(),
    })
  ),
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.productIds.map(async (productId, i) => {
        const qty = args.quantities?.[i] ?? 1;

        // Inline resolvePrice logic
        const product = await ctx.table('products').get(productId);
        if (!product || product.organizationId !== ctx.orgId) {
          return {
            productId,
            basePrice: 0,
            finalPrice: 0,
            pricelistId: undefined,
            pricelistName: undefined,
            discountPercent: undefined,
            ruleApplied: undefined,
          };
        }

        const basePrice = product.price ?? 0;
        let pricelist: any;

        if (args.companyId) {
          const company = await ctx.table('companies').get(args.companyId);
          if (company?.pricelistId) {
            pricelist = await ctx.table('pricelists').get(company.pricelistId);
          }
        }

        if (!pricelist) {
          return { productId, basePrice, finalPrice: basePrice, pricelistId: undefined, pricelistName: undefined, discountPercent: undefined, ruleApplied: undefined };
        }

        const rules = await ctx
          .table('priceRules', 'organizationId_pricelistId', (q: any) =>
            q.eq('organizationId', ctx.orgId).eq('pricelistId', pricelist._id)
          )
          .take(1000);
        const now = Date.now();

        let bestRule: any = null;
        let bestScore = -1;

        for (const rule of rules) {
          if (rule.startDate && now < rule.startDate) continue;
          if (rule.endDate && now > rule.endDate) continue;
          if (rule.minQuantity && qty < rule.minQuantity) continue;

          let score = 0;
          if (rule.productId === productId) {
            score = 3;
          } else if (rule.productId) {
            continue;
          }

          if (rule.productCategoryId && rule.productCategoryId === product.category) {
            score += 2;
          } else if (rule.productCategoryId) {
            continue;
          }

          if (!rule.productId && !rule.productCategoryId) score = 1;

          const volumeBonus = (rule.minQuantity ?? 0) / 1000000;
          const totalScore = score + volumeBonus;
          if (totalScore > bestScore) { bestScore = totalScore; bestRule = rule; }
        }

        if (bestRule) {
          let finalPrice = basePrice;
          let discountPercent: number | undefined;

          if (pricelist.type === 'fixed' && bestRule.fixedPrice != null) {
            finalPrice = bestRule.fixedPrice;
            if (basePrice > 0) discountPercent = Math.round((1 - finalPrice / basePrice) * 10000) / 100;
          } else if (pricelist.type === 'percentage_discount' && bestRule.discountPercent != null) {
            discountPercent = bestRule.discountPercent;
            finalPrice = basePrice * (1 - (discountPercent as number) / 100);
          } else if (pricelist.type === 'formula' && bestRule.formula) {
            try {
              const formula = bestRule.formula.replace(/base/gi, String(basePrice));
              finalPrice = new Function('return ' + formula)() as number;
              if (isNaN(finalPrice)) finalPrice = basePrice;
            } catch { finalPrice = basePrice; }
          }

          const ruleDesc = bestRule.productId ? 'Product-specific rule' : bestRule.productCategoryId ? 'Category rule' : 'Wildcard rule';
          return {
            productId,
            basePrice,
            finalPrice: Math.round(finalPrice * 100) / 100,
            pricelistId: pricelist._id as any,
            pricelistName: pricelist.name,
            discountPercent,
            ruleApplied: bestRule.minQuantity ? `${ruleDesc} (qty ≥ ${bestRule.minQuantity})` : ruleDesc,
          };
        }

        if (pricelist.defaultDiscount) {
          const finalPrice = basePrice * (1 - pricelist.defaultDiscount / 100);
          return {
            productId,
            basePrice,
            finalPrice: Math.round(finalPrice * 100) / 100,
            pricelistId: pricelist._id as any,
            pricelistName: pricelist.name,
            discountPercent: pricelist.defaultDiscount,
            ruleApplied: `Default discount (${pricelist.defaultDiscount}%)`,
          };
        }

        return { productId, basePrice, finalPrice: basePrice, pricelistId: pricelist._id as any, pricelistName: pricelist.name, discountPercent: undefined, ruleApplied: undefined };
      })
    );
    return results;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new pricelist with optional rules. */
export const create = createOrgMutation()({
  args: {
    name: z.string().min(1),
    type: pricelistTypeEnum,
    description: z.string().optional(),
    defaultDiscount: z.number().optional(),
    currency: z.string().optional(),
    priority: z.number().optional(),
    rules: z.array(priceRuleSchema).optional(),
  },
  returns: zid('pricelists'),
  handler: async (ctx, args) => {
    const { rules, ...plData } = args;

    const pricelistId = await ctx.table('pricelists').insert({
      ...plData,
      isActive: true,
      organizationId: ctx.orgId,
    });

    // Insert rules
    if (rules?.length) {
      for (const rule of rules) {
        await ctx.table('priceRules').insert({
          ...rule,
          pricelistId,
          organizationId: ctx.orgId,
        });
      }
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: pricelistId as unknown as string,
      action: 'create',
      after: { name: args.name, type: args.type },
    });

    return pricelistId;
  },
});

/** Update an existing pricelist. */
export const update = createOrgMutation()({
  args: {
    id: zid('pricelists'),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    type: pricelistTypeEnum.optional(),
    defaultDiscount: z.number().optional(),
    currency: z.string().optional(),
    priority: z.number().optional(),
    isActive: z.boolean().optional(),
    rules: z.array(
      z.object({
        id: zid('priceRules').optional(),
        productId: zid('products').optional(),
        productCategoryId: zid('productCategories').optional(),
        minQuantity: z.number().optional(),
        fixedPrice: z.number().optional(),
        discountPercent: z.number().optional(),
        formula: z.string().optional(),
        startDate: z.number().optional(),
        endDate: z.number().optional(),
      })
    ).optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, rules, ...updates } = args;
    const pricelist = await ctx.table('pricelists').getX(id);
    if (pricelist.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Pricelist not found' });
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await pricelist.patch(cleanUpdates);

    // Replace rules if provided
    if (rules !== undefined) {
      // Delete existing rules
      const existingRules = await pricelist.edge('rules');
      for (const rule of existingRules) {
        await ctx.db.delete(rule._id);
      }

      // Insert new rules
      for (const rule of rules) {
        const { id: ruleId, ...ruleData } = rule;
        await ctx.table('priceRules').insert({
          ...ruleData,
          pricelistId: id,
          organizationId: ctx.orgId,
        });
      }
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: id as unknown as string,
      action: 'update',
      after: cleanUpdates,
    });

    return null;
  },
});

/** Archive (soft delete) a pricelist. */
export const archive = createOrgMutation()({
  args: { id: zid('pricelists') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const pricelist = await ctx.table('pricelists').getX(args.id);
    if (pricelist.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Pricelist not found' });
    }

    await pricelist.patch({ archivedAt: Date.now(), isActive: false });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: args.id as unknown as string,
      action: 'archive',
      before: { name: pricelist.name },
      after: { archivedAt: true },
    });

    return null;
  },
});

/** Unarchive (restore) a pricelist. */
export const unarchive = createOrgMutation()({
  args: { id: zid('pricelists') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const pricelist = await ctx.table('pricelists').getX(args.id);
    if (pricelist.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Pricelist not found' });
    }

    await pricelist.patch({ archivedAt: undefined, isActive: true });

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: args.id as unknown as string,
      action: 'unarchive',
      before: { name: pricelist.name },
      after: { isActive: true },
    });

    return null;
  },
});

/** Hard delete a pricelist and its rules. */
export const remove = createOrgMutation()({
  args: { id: zid('pricelists') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const pricelist = await ctx.table('pricelists').getX(args.id);
    if (pricelist.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Pricelist not found' });
    }

    // Delete all rules
    const rules = await pricelist.edge('rules');
    for (const rule of rules) {
      await ctx.db.delete(rule._id);
    }

    // Clear pricelistId from companies
    const companies = await pricelist.edge('applicableCompanies');
    for (const company of companies) {
      await ctx.db.patch(company._id, { pricelistId: undefined });
    }

    await pricelist.delete();

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: args.id as unknown as string,
      action: 'delete',
      before: { name: pricelist.name },
    });

    return null;
  },
});

/** Duplicate a pricelist with all its rules. */
export const duplicate = createOrgMutation()({
  args: { id: zid('pricelists') },
  returns: zid('pricelists'),
  handler: async (ctx, args) => {
    const pricelist = await ctx.table('pricelists').getX(args.id);
    if (pricelist.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Pricelist not found' });
    }

    const newPricelistId = await ctx.table('pricelists').insert({
      name: `${pricelist.name} (copy)`,
      description: pricelist.description,
      type: pricelist.type,
      defaultDiscount: pricelist.defaultDiscount,
      currency: pricelist.currency,
      priority: pricelist.priority,
      isActive: true,
      organizationId: ctx.orgId,
    });

    // Copy rules
    const rules = await pricelist.edge('rules');
    for (const rule of rules) {
      await ctx.table('priceRules').insert({
        productId: rule.productId,
        productCategoryId: rule.productCategoryId,
        minQuantity: rule.minQuantity,
        fixedPrice: rule.fixedPrice,
        discountPercent: rule.discountPercent,
        formula: rule.formula,
        startDate: rule.startDate,
        endDate: rule.endDate,
        pricelistId: newPricelistId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'product',
      entityId: newPricelistId as unknown as string,
      action: 'duplicate',
      metadata: { sourcePricelistId: args.id as unknown as string },
    });

    return newPricelistId;
  },
});
