import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import {
  createOrgMutation,
  createOrgPaginatedQuery,
  createOrgQuery,
} from './functions';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// List reminder rules for org
export const listReminderRules = createOrgQuery()({
  args: {},
  handler: async (ctx) => {
    const { orgId } = ctx;

    return await ctx
      .table('reminderRules', 'organizationId', (q) =>
        q.eq('organizationId', orgId)
      );
  },
});

// Get a single reminder rule
export const getReminderRule = createOrgQuery()({
  args: { id: zid('reminderRules') },
  handler: async (ctx, args) => {
    const rule = await ctx.table('reminderRules').get(args.id);
    if (!rule || rule.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Reminder rule not found' });
    }
    return rule;
  },
});

// Get overdue invoices (posted, amountDue > 0, dueDate < now)
export const checkOverdue = createOrgQuery()({
  args: {},
  handler: async (ctx) => {
    const { orgId } = ctx;
    const now = Date.now();

    const posted = await ctx
      .table('invoices', 'organizationId_state', (q) =>
        q.eq('organizationId', orgId).eq('state', 'posted')
      );

    const overdue = posted.filter((inv: any) =>
      inv.amountDue > 0 && inv.dueDate < now
    );

    // Resolve company names
    const companyMap = new Map<string, string>();
    await Promise.all(
      [...new Set(overdue.map((inv: any) => inv.companyId).filter(Boolean))].map(
        async (id) => {
          const c = await ctx.table('companies').get(id);
          if (c) companyMap.set(id, c.name);
        }
      )
    );

    return overdue.map((inv: any) => ({
      id: inv._id,
      number: inv.number,
      type: inv.type,
      dueDate: inv.dueDate,
      totalAmount: inv.totalAmount,
      amountDue: inv.amountDue,
      currency: inv.currency,
      companyId: inv.companyId,
      companyName: inv.companyId ? companyMap.get(inv.companyId) : undefined,
      daysOverdue: Math.floor((now - inv.dueDate) / (24 * 60 * 60 * 1000)),
    }));
  },
});

// Overdue summary buckets
export const overdueSummary = createOrgQuery()({
  args: {},
  handler: async (ctx) => {
    // Re-query overdue invoices directly
    const now = Date.now();
    const posted = await ctx
      .table('invoices', 'organizationId_state', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('state', 'posted')
      );
    const overdue = posted.filter((inv: any) =>
      inv.amountDue > 0 && inv.dueDate < now
    );

    let totalOverdue = 0;
    let bucket030 = 0;
    let bucket3160 = 0;
    let bucket6190 = 0;
    let bucket90plus = 0;

    for (const inv of overdue) {
      totalOverdue += inv.amountDue;
      const days = Math.floor((now - inv.dueDate) / (1000 * 60 * 60 * 24));
      if (days <= 30) bucket030 += inv.amountDue;
      else if (days <= 60) bucket3160 += inv.amountDue;
      else if (days <= 90) bucket6190 += inv.amountDue;
      else bucket90plus += inv.amountDue;
    }

    return {
      totalOverdue,
      totalInvoices: overdue.length,
      bucket030,
      bucket3160,
      bucket6190,
      bucket90plus,
    };
  },
});

// Get reminder history for an invoice
export const getReminderHistory = createOrgQuery()({
  args: { invoiceId: zid('invoices') },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const reminders = await ctx
      .table('invoiceReminders', 'organizationId_invoiceId', (q) =>
        q.eq('organizationId', orgId).eq('invoiceId', args.invoiceId)
      );

    // Resolve rule names
    const ruleMap = new Map<string, string>();
    await Promise.all(
      [...new Set(reminders.map((r: any) => r.reminderRuleId as string))].map(
        async (id) => {
          const rule = await ctx.table('reminderRules').get(id as any);
          if (rule) ruleMap.set(id, rule.name);
        }
      )
    );

    return reminders.map((r: any) => ({
      id: r._id,
      reminderRuleId: r.reminderRuleId,
      ruleName: ruleMap.get(r.reminderRuleId as string) ?? 'Unknown',
      sentAt: r.sentAt,
      status: r.status,
    }));
  },
});

// Get reminder count for an invoice
export const getReminderCount = createOrgQuery()({
  args: { invoiceId: zid('invoices') },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const reminders = await ctx
      .table('invoiceReminders', 'organizationId_invoiceId', (q) =>
        q.eq('organizationId', orgId).eq('invoiceId', args.invoiceId)
      );

    return reminders.filter((r: any) => r.status === 'sent').length;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

// Create a reminder rule
export const createReminderRule = createOrgMutation()({
  args: {
    name: z.string().min(1),
    daysOverdue: z.number().min(0),
    subject: z.string().min(1),
    body: z.string().min(1),
    includeInvoicePdf: z.boolean().optional(),
    isActive: z.boolean().optional(),
  },
  handler: async (ctx, args) => {
    return await ctx.table('reminderRules').insert({
      name: args.name,
      daysOverdue: args.daysOverdue,
      subject: args.subject,
      body: args.body,
      includeInvoicePdf: args.includeInvoicePdf,
      isActive: args.isActive ?? true,
      organizationId: ctx.orgId,
    });
  },
});

// Update a reminder rule
export const updateReminderRule = createOrgMutation()({
  args: {
    id: zid('reminderRules'),
    name: z.string().min(1).optional(),
    daysOverdue: z.number().min(0).optional(),
    subject: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    includeInvoicePdf: z.boolean().optional(),
    isActive: z.boolean().optional(),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.table('reminderRules').getX(args.id);
    if (rule.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Reminder rule not found' });
    }

    const { id, ...fields } = args;
    await rule.patch(fields);
  },
});

// Send a reminder for an overdue invoice
export const sendReminder = createOrgMutation()({
  args: {
    invoiceId: zid('invoices'),
    reminderRuleId: zid('reminderRules'),
  },
  handler: async (ctx, args) => {
    const inv = await ctx.table('invoices').getX(args.invoiceId);
    if (inv.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    const rule = await ctx.table('reminderRules').getX(args.reminderRuleId);
    if (rule.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Reminder rule not found' });
    }

    const now = Date.now();
    const daysOverdue = Math.floor((now - inv.dueDate) / (24 * 60 * 60 * 1000));

    if (daysOverdue < rule.daysOverdue) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Invoice is ${daysOverdue} days overdue, but rule requires ${rule.daysOverdue} days`,
      });
    }

    // Check if reminder already sent with this rule
    const existing = await ctx
      .table('invoiceReminders', 'organizationId_invoiceId', (q) =>
        q.eq('organizationId', ctx.orgId).eq('invoiceId', args.invoiceId)
      );

    const alreadySent = existing.some(
      (r: any) => r.reminderRuleId === args.reminderRuleId && r.status === 'sent'
    );

    if (alreadySent) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: `Reminder "${rule.name}" already sent for this invoice`,
      });
    }

    // Log the reminder (actual email sending to be added later)
    const reminderId = await ctx.table('invoiceReminders').insert({
      invoiceId: inv._id,
      reminderRuleId: rule._id,
      sentAt: now,
      status: 'sent', // Mark as sent since we're logging the action
      organizationId: ctx.orgId,
    });

    return reminderId;
  },
});
