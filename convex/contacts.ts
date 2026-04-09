import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { createAuthMutation, createAuthQuery } from './functions';

const DEFAULT_LIST_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_TOUCH_GREEN_DAYS = 7;

// List contacts for current org
export const list = createAuthQuery()({
  args: {
    companyId: zid('companies').optional(),
    search: z.string().optional(),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

    let contacts;

    if (args.search) {
      contacts = await ctx
        .table('contacts')
        .search('search_contacts', (q) => {
          let query = q.search('fullName', args.search!).eq('organizationId', orgId);
          if (args.companyId) {
            query = query.eq('companyId', args.companyId);
          }
          return query;
        })
        .filter((q) => q.eq(q.field('archivedAt'), undefined))
        .take(DEFAULT_LIST_LIMIT);
    } else if (args.companyId) {
      contacts = await ctx
        .table('contacts', 'organizationId_companyId', (q) =>
          q.eq('organizationId', orgId).eq('companyId', args.companyId!)
        )
        .filter((q) => q.eq(q.field('archivedAt'), undefined))
        .take(DEFAULT_LIST_LIMIT);
    } else {
      contacts = await ctx
        .table('contacts', 'organizationId', (q) => q.eq('organizationId', orgId))
        .filter((q) => q.eq(q.field('archivedAt'), undefined))
        .take(DEFAULT_LIST_LIMIT);
    }

    const now = Date.now();

    return await Promise.all(
      contacts.map(async (contact) => {
        const lastTouch = await ctx
          .table('activities', 'organizationId_entityType_entityId', (q) =>
            q
              .eq('organizationId', orgId)
              .eq('entityType', 'contact')
              .eq('entityId', contact._id)
          )
          .order('desc')
          .first();

        const lastTouchedAt = lastTouch?._creationTime ?? null;
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
          lastTouchStatus:
            lastTouchedDays === null
              ? 'red'
              : lastTouchedDays <= LAST_TOUCH_GREEN_DAYS
                ? 'green'
                : 'red',
          lifecycleStage: contact.lifecycleStage,
          ownerId: contact.ownerId,
          phone: contact.phone,
          tags: contact.tags,
        };
      })
    );
  },
});

// Get single contact with company name and deal count
export const getById = createAuthQuery()({
  args: {
    id: zid('contacts'),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

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

    const lastTouch = await ctx
      .table('activities', 'organizationId_entityType_entityId', (q) =>
        q
          .eq('organizationId', orgId)
          .eq('entityType', 'contact')
          .eq('entityId', contact._id)
      )
      .order('desc')
      .first();

    const lastTouchedAt = lastTouch?._creationTime ?? null;
    const lastTouchedDays =
      lastTouchedAt === null ? null : Math.floor((Date.now() - lastTouchedAt) / DAY_MS);

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
      lastTouchStatus:
        lastTouchedDays === null
          ? 'red'
          : lastTouchedDays <= LAST_TOUCH_GREEN_DAYS
            ? 'green'
            : 'red',
      lifecycleStage: contact.lifecycleStage,
      notes: contact.notes,
      ownerId: contact.ownerId,
      phone: contact.phone,
      tags: contact.tags,
    };
  },
});

// Create contact with duplicate email detection
export const create = createAuthMutation()({
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
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

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
export const update = createAuthMutation()({
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
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

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
export const archive = createAuthMutation()({
  args: {
    id: zid('contacts'),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

    const contact = await ctx.table('contacts').getX(args.id);
    if (contact.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    }

    await contact.patch({ archivedAt: Date.now() });

    return null;
  },
});

// Restore archived contact
export const restore = createAuthMutation()({
  args: {
    id: zid('contacts'),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

    const contact = await ctx.table('contacts').getX(args.id);
    if (contact.organizationId !== orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    }

    await contact.patch({ archivedAt: undefined });

    return null;
  },
});
