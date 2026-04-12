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
// Schemas
// ---------------------------------------------------------------------------

const lineSchema = z.object({
  id: zid('quotationTemplateLines'),
  productName: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  discount: z.number().min(0).optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  taxAmount: z.number().min(0).optional(),
  subtotal: z.number(),
  productId: zid('products').optional(),
  taxId: zid('taxes').optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateLineSubtotal(line: {
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  taxAmount?: number;
}): number {
  let subtotal = line.quantity * line.unitPrice;
  if (line.discount) {
    if (line.discountType === 'percentage') {
      subtotal -= subtotal * (line.discount / 100);
    } else {
      subtotal -= line.discount;
    }
  }
  return Math.round(subtotal * 100) / 100;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = createOrgPaginatedQuery()({
  args: {
    search: z.string().optional(),
    includeArchived: z.boolean().optional(),
  },
  returns: z.object({
    page: z.array(z.object({
      id: zid('quotationTemplates'),
      name: z.string(),
      description: z.string().optional(),
      discountAmount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      currency: z.string().optional(),
      validForDays: z.number().optional(),
      isDefault: z.boolean().optional(),
      archivedAt: z.number().optional(),
      ownerId: zid('user'),
      organizationId: zid('organization'),
      lineCount: z.number(),
    })),
    continueCursor: z.string(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    let result;
    if (args.search) {
      result = await ctx
        .table('quotationTemplates')
        .search('search_templates', (q: any) =>
          q.search('name', args.search!).eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    } else {
      result = await ctx
        .table('quotationTemplates', 'organizationId_name', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .paginate(args.paginationOpts);
    }

    let page = result.page as any[];

    if (!args.includeArchived) {
      page = page.filter((t: any) => !t.archivedAt);
    }

    // Resolve line counts in parallel
    const pagesWithCounts = await Promise.all(
      page.map(async (t: any) => {
        const lines = await t.edge('lines');
        return {
          id: t._id,
          name: t.name,
          description: t.description,
          discountAmount: t.discountAmount,
          discountType: t.discountType,
          currency: t.currency,
          validForDays: t.validForDays,
          isDefault: t.isDefault,
          archivedAt: t.archivedAt,
          ownerId: t.ownerId,
          organizationId: t.organizationId,
          lineCount: lines.length,
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

export const getById = createOrgQuery()({
  args: { id: zid('quotationTemplates') },
  returns: z.object({
    id: zid('quotationTemplates'),
    name: z.string(),
    description: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    internalNotes: z.string().optional(),
    customerNotes: z.string().optional(),
    terms: z.string().optional(),
    currency: z.string().optional(),
    validForDays: z.number().optional(),
    isDefault: z.boolean().optional(),
    archivedAt: z.number().optional(),
    ownerId: zid('user'),
    organizationId: zid('organization'),
    lines: z.array(lineSchema),
  }),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('quotationTemplates').get(args.id);
    if (!tmpl || tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }

    const lines = await tmpl.edge('lines');

    return {
      id: tmpl._id,
      name: tmpl.name,
      description: tmpl.description,
      discountAmount: tmpl.discountAmount,
      discountType: tmpl.discountType,
      internalNotes: tmpl.internalNotes,
      customerNotes: tmpl.customerNotes,
      terms: tmpl.terms,
      currency: tmpl.currency,
      validForDays: tmpl.validForDays,
      isDefault: tmpl.isDefault,
      archivedAt: tmpl.archivedAt,
      ownerId: tmpl.ownerId,
      organizationId: tmpl.organizationId,
      lines: lines.map((l: any) => ({
        id: l._id,
        productName: l.productName,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        taxAmount: l.taxAmount,
        subtotal: l.subtotal,
        productId: l.productId,
        taxId: l.taxId,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = createOrgMutation()({
  args: {
    name: z.string().min(1),
    description: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    internalNotes: z.string().optional(),
    customerNotes: z.string().optional(),
    terms: z.string().optional(),
    currency: z.string().optional(),
    validForDays: z.number().optional(),
    isDefault: z.boolean().optional(),
    lines: z.array(z.object({
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      productId: zid('products').optional(),
      taxId: zid('taxes').optional(),
    })).min(1),
  },
  returns: zid('quotationTemplates'),
  handler: async (ctx, args) => {
    const lineSubtotals = args.lines.map((line) => ({
      ...line,
      subtotal: calculateLineSubtotal(line),
    }));

    // If setting as default, unset other defaults first
    if (args.isDefault) {
      const defaults = await ctx
        .table('quotationTemplates', 'organizationId_name', (q: any) =>
          q.eq('organizationId', ctx.orgId)
        );
      for (const d of defaults) {
        if (d.isDefault) await d.patch({ isDefault: false });
      }
    }

    const tmplId = await ctx.table('quotationTemplates').insert({
      name: args.name,
      description: args.description,
      discountAmount: args.discountAmount,
      discountType: args.discountType,
      internalNotes: args.internalNotes,
      customerNotes: args.customerNotes,
      terms: args.terms,
      currency: args.currency,
      validForDays: args.validForDays,
      isDefault: args.isDefault,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of lineSubtotals) {
      await ctx.table('quotationTemplateLines').insert({
        ...line,
        templateId: tmplId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: tmplId as unknown as string,
      action: 'template.create',
      after: { name: args.name, lineCount: args.lines.length },
    });

    return tmplId;
  },
});

export const update = createOrgMutation()({
  args: {
    id: zid('quotationTemplates'),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    discountAmount: z.number().optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    internalNotes: z.string().optional(),
    customerNotes: z.string().optional(),
    terms: z.string().optional(),
    currency: z.string().optional(),
    validForDays: z.number().optional(),
    isDefault: z.boolean().optional(),
    lines: z.optional(z.array(z.object({
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      productId: zid('products').optional(),
      taxId: zid('taxes').optional(),
    })).min(1)),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const { id, lines: newLines, ...updates } = args;
    const tmpl = await ctx.table('quotationTemplates').getX(id);
    if (tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }

    // If setting as default, unset other defaults first
    if (args.isDefault) {
      const defaults = await ctx
        .table('quotationTemplates', 'organizationId_name', (q: any) =>
          q.eq('organizationId', ctx.orgId)
        );
      for (const d of defaults) {
        if (d.isDefault && d._id !== id) await d.patch({ isDefault: false });
      }
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Replace lines if provided
    if (newLines) {
      const existingLines = await tmpl.edge('lines');
      for (const line of existingLines) {
        await (line as any).delete();
      }
      const lineSubtotals = newLines.map((line) => ({
        ...line,
        subtotal: calculateLineSubtotal(line),
      }));
      for (const line of lineSubtotals) {
        await ctx.table('quotationTemplateLines').insert({
          ...line,
          templateId: id,
          organizationId: ctx.orgId,
        });
      }
    }

    await tmpl.patch(cleanUpdates);

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: id as unknown as string,
      action: 'template.update',
      after: cleanUpdates,
    });

    return null;
  },
});

export const duplicate = createOrgMutation()({
  args: { id: zid('quotationTemplates') },
  returns: zid('quotationTemplates'),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('quotationTemplates').getX(args.id);
    if (tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }

    const newTmplId = await ctx.table('quotationTemplates').insert({
      name: `${tmpl.name} (Copy)`,
      description: tmpl.description,
      discountAmount: tmpl.discountAmount,
      discountType: tmpl.discountType,
      internalNotes: tmpl.internalNotes,
      customerNotes: tmpl.customerNotes,
      terms: tmpl.terms,
      currency: tmpl.currency,
      validForDays: tmpl.validForDays,
      isDefault: false,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    const lines = await tmpl.edge('lines');
    for (const line of lines) {
      await ctx.table('quotationTemplateLines').insert({
        productName: line.productName,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        discountType: line.discountType,
        taxAmount: line.taxAmount,
        subtotal: line.subtotal,
        productId: line.productId,
        taxId: line.taxId,
        templateId: newTmplId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: newTmplId as unknown as string,
      action: 'template.duplicate',
      metadata: { sourceTemplateId: args.id as unknown as string },
    });

    return newTmplId;
  },
});

export const archive = createOrgMutation()({
  args: { id: zid('quotationTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('quotationTemplates').getX(args.id);
    if (tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }
    await tmpl.patch({ archivedAt: Date.now() });
    return null;
  },
});

export const unarchive = createOrgMutation()({
  args: { id: zid('quotationTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('quotationTemplates').getX(args.id);
    if (tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }
    await tmpl.patch({ archivedAt: undefined });
    return null;
  },
});

export const remove = createOrgMutation()({
  args: { id: zid('quotationTemplates') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const tmpl = await ctx.table('quotationTemplates').getX(args.id);
    if (tmpl.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template not found' });
    }

    // Delete all lines first
    const lines = await tmpl.edge('lines');
    for (const line of lines) {
      await (line as any).delete();
    }

    await tmpl.delete();

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: args.id as unknown as string,
      action: 'template.delete',
      before: { name: tmpl.name },
    });

    return null;
  },
});

export const createFromSaleOrder = createOrgMutation()({
  args: {
    saleOrderId: zid('saleOrders'),
    name: z.string().min(1),
    description: z.string().optional(),
  },
  returns: zid('quotationTemplates'),
  handler: async (ctx, args) => {
    const so = await ctx.table('saleOrders').getX(args.saleOrderId);
    if (so.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Sale order not found' });
    }

    const soLines = await so.edge('lines');

    const tmplId = await ctx.table('quotationTemplates').insert({
      name: args.name,
      description: args.description,
      discountAmount: so.discountAmount,
      discountType: so.discountType,
      internalNotes: so.internalNotes,
      customerNotes: so.customerNotes,
      terms: so.terms,
      currency: so.currency,
      organizationId: ctx.orgId,
      ownerId: ctx.userId,
    });

    for (const line of soLines) {
      await ctx.table('quotationTemplateLines').insert({
        productName: line.productName,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        discountType: line.discountType,
        taxAmount: line.taxAmount,
        subtotal: line.subtotal,
        productId: line.productId,
        templateId: tmplId,
        organizationId: ctx.orgId,
      });
    }

    await createAuditLog(ctx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      entityType: 'saleOrder',
      entityId: tmplId as unknown as string,
      action: 'template.createFromSaleOrder',
      metadata: { sourceSaleOrderId: args.saleOrderId as unknown as string },
    });

    return tmplId;
  },
});
