import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgMutation, createOrgPaginatedQuery, createOrgQuery } from './functions';

const DEFAULT_LIST_LIMIT = 100;

const sizeEnum = z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']);
const sourceEnum = z.enum(['referral', 'website', 'linkedin', 'cold', 'event', 'other']);
const statusEnum = z.enum(['active', 'inactive', 'prospect']);

// List companies for current org, filter out archived by default, support search (paginated)
export const list = createOrgPaginatedQuery()({
  args: {
    includeArchived: z.boolean().optional(),
    search: z.string().optional(),
  },
  returns: z.object({
    page: z.array(
      z.object({
        id: zid('companies'),
        name: z.string(),
        website: z.string().optional(),
        industry: z.string().optional(),
        size: sizeEnum.optional(),
        status: statusEnum.optional(),
        country: z.string().optional(),
        source: sourceEnum.optional(),
        tags: z.array(z.string()).optional(),
        archivedAt: z.number().optional(),
        ownerId: zid('user'),
        createdAt: z.number(),
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
        .table('companies')
        .search('search_companies', (q) =>
          q.search('name', args.search!).eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    } else if (args.includeArchived) {
      result = await ctx
        .table('companies', 'organizationId', (q) => q.eq('organizationId', orgId))
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('companies', 'organizationId_archivedAt', (q) =>
          q.eq('organizationId', orgId).eq('archivedAt', undefined)
        )
        .paginate(args.paginationOpts);
    }

    const page = result.page;

    return {
      page: page.map((c) => ({
        id: c._id,
        name: c.name,
        website: c.website,
        industry: c.industry,
        size: c.size,
        status: c.status,
        country: c.country,
        source: c.source,
        tags: c.tags,
        archivedAt: c.archivedAt,
        ownerId: c.ownerId,
        createdAt: c._creationTime,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// Get single company by ID with related contacts/deals counts
export const getById = createOrgQuery()({
  args: {
    id: zid('companies'),
  },
  returns: z
    .object({
      id: zid('companies'),
      name: z.string(),
      website: z.string().optional(),
      industry: z.string().optional(),
      size: sizeEnum.optional(),
      address: z.string().optional(),
      country: z.string().optional(),
      source: sourceEnum.optional(),
      tags: z.array(z.string()).optional(),
      status: statusEnum.optional(),
      notes: z.string().optional(),
      archivedAt: z.number().optional(),
      ownerId: zid('user'),
      organizationId: zid('organization'),
      createdAt: z.number(),
      contactsCount: z.number(),
      dealsCount: z.number(),
      pricelistId: zid('pricelists').optional(),
      pricelistName: z.string().optional(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const company = await ctx.table('companies').get(args.id);
    if (!company || company.organizationId !== orgId) {
      return null;
    }

    const [contacts, deals] = await Promise.all([
      ctx
        .table('contacts', 'organizationId_companyId', (q) =>
          q.eq('organizationId', orgId).eq('companyId', company._id)
        )
        .take(DEFAULT_LIST_LIMIT),
      ctx
        .table('deals', 'companyId', (q) => q.eq('companyId', company._id))
        .take(DEFAULT_LIST_LIMIT),
    ]);

    return {
      id: company._id,
      name: company.name,
      website: company.website,
      industry: company.industry,
      size: company.size,
      address: company.address,
      country: company.country,
      source: company.source,
      tags: company.tags,
      status: company.status,
      notes: company.notes,
      archivedAt: company.archivedAt,
      ownerId: company.ownerId,
      organizationId: company.organizationId,
      createdAt: company._creationTime,
      contactsCount: contacts.length,
      dealsCount: deals.length,
      pricelistId: company.pricelistId,
      pricelistName: company.pricelistId
        ? (await ctx.table('pricelists').get(company.pricelistId))?.name
        : undefined,
    };
  },
});

// Create company (requires activeOrganization), sets ownerId to current user
export const create = createOrgMutation()({
  args: {
    name: z.string().min(1).max(200),
    website: z.string().optional(),
    industry: z.string().optional(),
    size: sizeEnum.optional(),
    address: z.string().optional(),
    country: z.string().optional(),
    source: sourceEnum.optional(),
    tags: z.array(z.string()).optional(),
    status: statusEnum.optional(),
    notes: z.string().optional(),
  },
  returns: z.object({
    id: zid('companies'),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    // Duplicate detection: check if same name exists in org
    const existing = await ctx
      .table('companies', 'organizationId_name', (q) =>
        q.eq('organizationId', orgId).eq('name', args.name)
      )
      .first();

    if (existing) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `A company named "${args.name}" already exists in this organization`,
      });
    }

    const id = await ctx.table('companies').insert({
      name: args.name,
      website: args.website,
      industry: args.industry,
      size: args.size,
      address: args.address,
      country: args.country,
      source: args.source,
      tags: args.tags,
      status: args.status,
      notes: args.notes,
      organizationId: orgId,
      ownerId: ctx.user._id,
    });

    return { id };
  },
});

// Update company fields
export const update = createOrgMutation()({
  args: {
    id: zid('companies'),
    name: z.string().min(1).max(200).optional(),
    website: z.string().optional(),
    industry: z.string().optional(),
    size: sizeEnum.optional(),
    address: z.string().optional(),
    country: z.string().optional(),
    source: sourceEnum.optional(),
    tags: z.array(z.string()).optional(),
    status: statusEnum.optional(),
    notes: z.string().optional(),
    pricelistId: zid('pricelists').optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const company = await ctx.table('companies').getX(args.id);
    if (company.organizationId !== orgId) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Company not in your organization' });
    }

    // If renaming, check for duplicate name
    if (args.name && args.name !== company.name) {
      const existing = await ctx
        .table('companies', 'organizationId_name', (q) =>
          q.eq('organizationId', orgId).eq('name', args.name!)
        )
        .first();

      if (existing) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: `A company named "${args.name}" already exists in this organization`,
        });
      }
    }

    const { id: _, ...updates } = args;
    await ctx.table('companies').getX(args.id).patch(updates);

    return null;
  },
});

// Soft delete (set archivedAt), block if active deals exist
export const archive = createOrgMutation()({
  args: {
    id: zid('companies'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const company = await ctx.table('companies').getX(args.id);
    if (company.organizationId !== orgId) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Company not in your organization' });
    }

    if (company.archivedAt) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Company is already archived' });
    }

    // Block if active deals exist (not won/lost)
    const activeDeals = await ctx
      .table('deals', 'companyId', (q) => q.eq('companyId', company._id))
      .filter((q) =>
        q.and(
          q.neq(q.field('stage'), 'won'),
          q.neq(q.field('stage'), 'lost'),
          q.eq(q.field('archivedAt'), undefined)
        )
      )
      .first();

    if (activeDeals) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'Cannot archive company with active deals. Close or archive deals first.',
      });
    }

    await ctx.table('companies').getX(args.id).patch({ archivedAt: Date.now() });

    return null;
  },
});

// Bulk create companies (CSV import), skipping duplicates
export const bulkCreate = createOrgMutation()({
  args: {
    companies: z.array(
      z.object({
        name: z.string(),
        website: z.string().optional(),
        industry: z.string().optional(),
        size: sizeEnum.optional(),
        address: z.string().optional(),
        country: z.string().optional(),
        source: sourceEnum.optional(),
        tags: z.array(z.string()).optional(),
        status: statusEnum.optional(),
        notes: z.string().optional(),
      })
    ),
  },
  returns: z.object({
    created: z.number(),
    errors: z.array(
      z.object({
        identifier: z.string(),
        reason: z.string(),
        row: z.number(),
      })
    ),
    skipped: z.number(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    if (args.companies.length > 500) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Maximum 500 companies per import' });
    }

    let created = 0;
    let skipped = 0;
    const errors: { row: number; identifier: string; reason: string }[] = [];
    const seenNames = new Set<string>();

    // Pre-fetch existing company names in org for faster duplicate detection
    const existingCompanies = await ctx
      .table('companies', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(10000);
    const existingNames = new Set(existingCompanies.map((c) => c.name.toLowerCase()));

    for (let i = 0; i < args.companies.length; i++) {
      const company = args.companies[i];
      const normalizedName = company.name.trim().toLowerCase();

      try {
        // Intra-batch duplicate check
        if (seenNames.has(normalizedName)) {
          skipped++;
          errors.push({ row: i, identifier: company.name, reason: 'Duplicate name in import' });
          continue;
        }
        seenNames.add(normalizedName);

        // Check duplicate name in org (pre-fetched)
        if (existingNames.has(normalizedName)) {
          skipped++;
          continue;
        }

        await ctx.table('companies').insert({
          ...company,
          organizationId: orgId,
          ownerId: ctx.user._id,
        });

        created++;
      } catch (err) {
        errors.push({
          identifier: company.name,
          reason: err instanceof Error ? err.message : String(err),
          row: i,
        });
      }
    }

    return { created, skipped, errors };
  },
});

// Unarchive (clear archivedAt)
export const restore = createOrgMutation()({
  args: {
    id: zid('companies'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const company = await ctx.table('companies').getX(args.id);
    if (company.organizationId !== orgId) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Company not in your organization' });
    }

    if (!company.archivedAt) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Company is not archived' });
    }

    await ctx.table('companies').getX(args.id).patch({ archivedAt: undefined });

    return null;
  },
});
