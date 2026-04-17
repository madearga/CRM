import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import type { Id } from './convex/_generated/dataModel';
import { z } from 'zod';

import { createOrgMutation, createOrgPaginatedQuery, createOrgQuery } from './functions';

const DEFAULT_LIST_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_TOUCH_GREEN_DAYS = 7;

const lifecycleStageEnum = z.enum(['lead', 'prospect', 'customer', 'churned']);
const lastTouchStatusEnum = z.enum(['green', 'red']);

const contactListReturnSchema = z.array(
  z.object({
    id: zid('contacts'),
    companyId: zid('companies').optional(),
    createdAt: z.number(),
    email: z.string(),
    firstName: z.string().optional(),
    fullName: z.string(),
    jobTitle: z.string().optional(),
    lastName: z.string().optional(),
    lastTouchedAt: z.number().nullable(),
    lastTouchedDays: z.number().nullable(),
    lastTouchStatus: lastTouchStatusEnum,
    lifecycleStage: lifecycleStageEnum.optional(),
    ownerId: zid('user'),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
);

const contactDetailReturnSchema = z.object({
  id: zid('contacts'),
  archivedAt: z.number().optional(),
  companyId: zid('companies').optional(),
  companyName: z.string().nullable(),
  createdAt: z.number(),
  dealCount: z.number(),
  email: z.string(),
  firstName: z.string().optional(),
  fullName: z.string(),
  jobTitle: z.string().optional(),
  lastName: z.string().optional(),
  lastTouchedAt: z.number().nullable(),
  lastTouchedDays: z.number().nullable(),
  lastTouchStatus: lastTouchStatusEnum,
  lifecycleStage: lifecycleStageEnum.optional(),
  notes: z.string().optional(),
  ownerId: zid('user'),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// List contacts for current org (paginated)
export const list = createOrgPaginatedQuery()({
  args: {
    companyId: zid('companies').optional(),
    search: z.string().optional(),
  },
  returns: z.object({
    page: contactListReturnSchema,
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    let result;

    if (args.search) {
      result = await ctx
        .table('contacts')
        .search('search_contacts', (q) => {
          let query = q.search('fullName', args.search!).eq('organizationId', orgId);
          if (args.companyId) {
            query = query.eq('companyId', args.companyId);
          }
          return query;
        })
        .filter((q) => q.eq(q.field('archivedAt'), undefined))
        .paginate(args.paginationOpts);
    } else if (args.companyId) {
      result = await ctx
        .table('contacts', 'organizationId_companyId', (q) =>
          q.eq('organizationId', orgId).eq('companyId', args.companyId!)
        )
        .filter((q) => q.eq(q.field('archivedAt'), undefined))
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('contacts', 'organizationId_archivedAt', (q) =>
          q.eq('organizationId', orgId).eq('archivedAt', undefined)
        )
        .paginate(args.paginationOpts);
    }

    const now = Date.now();

    // Uses denormalized lastActivityAt field (updated via trigger in triggers.ts)
    // instead of N+1 activity queries per contact.
    return {
      page: result.page.map((contact) => {
        const lastTouchedAt = contact.lastActivityAt ?? null;
        const lastTouchedDays =
          lastTouchedAt === null ? null : Math.floor((now - lastTouchedAt) / DAY_MS);

        return {
          id: contact._id,
          companyId: contact.companyId,
          createdAt: contact._creationTime,
          email: contact.email,
          firstName: contact.firstName,
          fullName: contact.fullName,
          jobTitle: contact.jobTitle,
          lastName: contact.lastName,
          lastTouchedAt,
          lastTouchedDays,
          lastTouchStatus: (
            lastTouchedDays === null
              ? 'red'
              : lastTouchedDays <= LAST_TOUCH_GREEN_DAYS
                ? 'green'
                : 'red'
          ) as 'green' | 'red',
          lifecycleStage: contact.lifecycleStage,
          ownerId: contact.ownerId,
          phone: contact.phone,
          tags: contact.tags,
        };
      }),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// Get single contact with company name and deal count
export const getById = createOrgQuery()({
  args: {
    id: zid('contacts'),
  },
  returns: contactDetailReturnSchema,
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const contact = await ctx.table('contacts').get(args.id);
    if (!contact || contact.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    }

    const company = contact.companyId
      ? await ctx.table('companies').get(contact.companyId)
      : null;

    const deals = await ctx
      .table('deals', 'primaryContactId', (q) => q.eq('primaryContactId', contact._id))
      .filter((q) => q.eq(q.field('organizationId'), orgId));

    // Uses denormalized lastActivityAt field (updated via trigger in triggers.ts)
    const now = Date.now();
    const lastTouchedAt = contact.lastActivityAt ?? null;
    const lastTouchedDays =
      lastTouchedAt === null ? null : Math.floor((now - lastTouchedAt) / DAY_MS);

    return {
      id: contact._id,
      archivedAt: contact.archivedAt,
      companyId: contact.companyId,
      companyName: company?.name ?? null,
      createdAt: contact._creationTime,
      dealCount: deals.length,
      email: contact.email,
      firstName: contact.firstName,
      fullName: contact.fullName,
      jobTitle: contact.jobTitle,
      lastName: contact.lastName,
      lastTouchedAt,
      lastTouchedDays,
      lastTouchStatus: (
        lastTouchedDays === null
          ? 'red'
          : lastTouchedDays <= LAST_TOUCH_GREEN_DAYS
            ? 'green'
            : 'red'
      ) as 'green' | 'red',
      lifecycleStage: contact.lifecycleStage,
      notes: contact.notes,
      ownerId: contact.ownerId,
      phone: contact.phone,
      tags: contact.tags,
    };
  },
});

// Create contact with duplicate email detection
export const create = createOrgMutation()({
  args: {
    companyId: zid('companies').optional(),
    email: z.string().email(),
    firstName: z.string().optional(),
    jobTitle: z.string().optional(),
    lastName: z.string().optional(),
    lifecycleStage: z.enum(['lead', 'prospect', 'customer', 'churned']).optional(),
    notes: z.string().optional(),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    // Check duplicate email in same org
    const existing = await ctx
      .table('contacts')
      .get('organizationId_email', orgId, args.email);

    if (existing) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `A contact with email "${args.email}" already exists in this organization`,
      });
    }

    const fullName = [args.firstName, args.lastName].filter(Boolean).join(' ') || args.email;

    const id = await ctx.table('contacts').insert({
      companyId: args.companyId,
      email: args.email,
      firstName: args.firstName,
      fullName,
      jobTitle: args.jobTitle,
      lastName: args.lastName,
      lifecycleStage: args.lifecycleStage,
      notes: args.notes,
      organizationId: orgId,
      ownerId: ctx.user._id,
      phone: args.phone,
      tags: args.tags,
    });

    return { id };
  },
});

// Update contact fields
export const update = createOrgMutation()({
  args: {
    companyId: zid('companies').optional(),
    email: z.string().email().optional(),
    firstName: z.string().optional(),
    id: zid('contacts'),
    jobTitle: z.string().optional(),
    lastName: z.string().optional(),
    lifecycleStage: z.enum(['lead', 'prospect', 'customer', 'churned']).optional(),
    notes: z.string().optional(),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const contact = await ctx.table('contacts').getX(args.id);
    if (contact.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    }

    // Check duplicate email if email is changing
    if (args.email && args.email !== contact.email) {
      const existing = await ctx
        .table('contacts')
        .get('organizationId_email', orgId, args.email);

      if (existing) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: `A contact with email "${args.email}" already exists in this organization`,
        });
      }
    }

    // Recompute fullName if name fields change
    const firstName = args.firstName !== undefined ? args.firstName : contact.firstName;
    const lastName = args.lastName !== undefined ? args.lastName : contact.lastName;
    const nameChanged = args.firstName !== undefined || args.lastName !== undefined;
    const fullName = nameChanged
      ? [firstName, lastName].filter(Boolean).join(' ') || contact.email
      : undefined;

    const { id: _, ...updateFields } = args;

    await contact.patch({
      ...updateFields,
      ...(fullName ? { fullName } : {}),
    });

    return null;
  },
});

// Soft delete (archive)
export const archive = createOrgMutation()({
  args: {
    id: zid('contacts'),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const contact = await ctx.table('contacts').getX(args.id);
    if (contact.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    }

    await contact.patch({ archivedAt: Date.now() });

    return null;
  },
});

// Bulk create contacts (CSV import), skipping duplicates
export const bulkCreate = createOrgMutation()({
  args: {
    contacts: z.array(
      z.object({
        companyName: z.string().optional(),
        email: z.string().email(),
        firstName: z.string().optional(),
        jobTitle: z.string().optional(),
        lastName: z.string().optional(),
        lifecycleStage: z.enum(['lead', 'prospect', 'customer', 'churned']).optional(),
        notes: z.string().optional(),
        phone: z.string().optional(),
        tags: z.array(z.string()).optional(),
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

    if (args.contacts.length > 500) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Maximum 500 contacts per import' });
    }

    let created = 0;
    let skipped = 0;
    const errors: { row: number; identifier: string; reason: string }[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < args.contacts.length; i++) {
      const contact = args.contacts[i];
      try {
        // Intra-batch duplicate check
        if (seenEmails.has(contact.email)) {
          skipped++;
          errors.push({ row: i, identifier: contact.email, reason: 'Duplicate email in import' });
          continue;
        }
        seenEmails.add(contact.email);

        // Check duplicate email in org using indexed lookup
        const existing = await ctx
          .table('contacts', 'organizationId_email', (q) =>
            q.eq('organizationId', orgId).eq('email', contact.email)
          )
          .first();
        if (existing) {
          skipped++;
          errors.push({ row: i, identifier: contact.email, reason: 'Email already exists in organization' });
          continue;
        }

        const fullName =
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email;

        // Look up company by name using indexed lookup
        let companyId: Id<'companies'> | undefined;
        if (contact.companyName) {
          const company = await ctx
            .table('companies', 'organizationId_name', (q) =>
              q.eq('organizationId', orgId).eq('name', contact.companyName!)
            )
            .first();
          companyId = company?._id;
        }

        await ctx.table('contacts').insert({
          companyId,
          email: contact.email,
          firstName: contact.firstName,
          fullName,
          jobTitle: contact.jobTitle,
          lastName: contact.lastName,
          lifecycleStage: contact.lifecycleStage,
          notes: contact.notes,
          organizationId: orgId,
          ownerId: ctx.user._id,
          phone: contact.phone,
          tags: contact.tags,
        });

        created++;
      } catch (err) {
        errors.push({
          identifier: contact.email,
          reason: err instanceof Error ? err.message : String(err),
          row: i,
        });
      }
    }

    return { created, errors, skipped };
  },
});

// Restore archived contact
export const restore = createOrgMutation()({
  args: {
    id: zid('contacts'),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const contact = await ctx.table('contacts').getX(args.id);
    if (contact.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    }

    await contact.patch({ archivedAt: undefined });

    return null;
  },
});
