import { z } from 'zod';

import type { Id } from './_generated/dataModel';

import { internal } from './_generated/api';
import { createInternalMutation } from './functions';
import { getEnv } from './helpers/getEnv';
import { nextSequence } from './shared/sequenceGenerator';

const getAdminConfig = () => {
  const adminEmail = getEnv().ADMIN[0] || 'admin@example.com';
  return { adminEmail };
};

// Sample CRM data
const SAMPLE_COMPANIES = [
  { name: 'TechVentures Indonesia', website: 'https://techventures.id', industry: 'Technology', size: '11-50' as const, country: 'Indonesia', source: 'referral' as const, status: 'active' as const },
  { name: 'Digital Nusantara', website: 'https://digitalnusantara.com', industry: 'Digital Marketing', size: '1-10' as const, country: 'Indonesia', source: 'linkedin' as const, status: 'active' as const },
  { name: 'CloudFirst Solutions', website: 'https://cloudfirst.io', industry: 'Cloud Services', size: '51-200' as const, country: 'Singapore', source: 'website' as const, status: 'active' as const },
  { name: 'Startup Garage Jakarta', website: 'https://startupgarage.id', industry: 'Incubator', size: '1-10' as const, country: 'Indonesia', source: 'event' as const, status: 'prospect' as const },
  { name: 'PayEasy Asia', website: 'https://payeasy.asia', industry: 'Fintech', size: '201-500' as const, country: 'Malaysia', source: 'cold' as const, status: 'prospect' as const },
];

const SAMPLE_CONTACTS = [
  { firstName: 'Budi', lastName: 'Santoso', email: 'budi@techventures.id', jobTitle: 'CTO', phone: '+6281234567890', lifecycleStage: 'customer' as const, companyIndex: 0 },
  { firstName: 'Sari', lastName: 'Dewi', email: 'sari@techventures.id', jobTitle: 'Product Manager', phone: '+6281234567891', lifecycleStage: 'customer' as const, companyIndex: 0 },
  { firstName: 'Ahmad', lastName: 'Rizki', email: 'ahmad@digitalnusantara.com', jobTitle: 'CEO', phone: '+6281234567892', lifecycleStage: 'prospect' as const, companyIndex: 1 },
  { firstName: 'Lisa', lastName: 'Tan', email: 'lisa@cloudfirst.io', jobTitle: 'VP Engineering', phone: '+6591234567', lifecycleStage: 'lead' as const, companyIndex: 2 },
  { firstName: 'Dian', lastName: 'Putri', email: 'dian@cloudfirst.io', jobTitle: 'Solutions Architect', phone: '+6591234568', lifecycleStage: 'lead' as const, companyIndex: 2 },
  { firstName: 'Reza', lastName: 'Firmansyah', email: 'reza@startupgarage.id', jobTitle: 'Managing Director', phone: '+6281234567893', lifecycleStage: 'prospect' as const, companyIndex: 3 },
  { firstName: 'Wei', lastName: 'Chen', email: 'wei@payeasy.asia', jobTitle: 'Head of Partnerships', phone: '+60123456789', lifecycleStage: 'lead' as const, companyIndex: 4 },
  { firstName: 'Ayu', lastName: 'Lestari', email: 'ayu@digitalnusantara.com', jobTitle: 'Marketing Lead', phone: '+6281234567894', lifecycleStage: 'prospect' as const, companyIndex: 1 },
  { firstName: 'Hendro', lastName: 'Wibowo', email: 'hendro@startupgarage.id', jobTitle: 'Investment Analyst', phone: '+6281234567895', lifecycleStage: 'prospect' as const, companyIndex: 3 },
  { firstName: 'Mei', lastName: 'Ling', email: 'mei@payeasy.asia', jobTitle: 'CTO', phone: '+60123456790', lifecycleStage: 'lead' as const, companyIndex: 4 },
];

const SAMPLE_DEALS = [
  { title: 'TechVentures - Platform Development', value: 150000000, currency: 'IDR', stage: 'proposal' as const, probability: 60, companyIndex: 0, contactIndex: 0, daysAgo: 14 },
  { title: 'TechVentures - Maintenance Contract', value: 50000000, currency: 'IDR', stage: 'new' as const, probability: 20, companyIndex: 0, contactIndex: 1, daysAgo: 3 },
  { title: 'Digital Nusantara - Website Revamp', value: 75000000, currency: 'IDR', stage: 'contacted' as const, probability: 40, companyIndex: 1, contactIndex: 2, daysAgo: 7 },
  { title: 'CloudFirst - API Integration', value: 5000, currency: 'IDR', stage: 'proposal' as const, probability: 70, companyIndex: 2, contactIndex: 3, daysAgo: 21 },
  { title: 'CloudFirst - Consulting Package', value: 12000, currency: 'IDR', stage: 'won' as const, probability: 100, companyIndex: 2, contactIndex: 4, daysAgo: 45 },
  { title: 'Startup Garage - Incubation Portal', value: 200000000, currency: 'IDR', stage: 'new' as const, probability: 10, companyIndex: 3, contactIndex: 5, daysAgo: 2 },
  { title: 'PayEasy - Payment Gateway Module', value: 8000, currency: 'IDR', stage: 'contacted' as const, probability: 30, companyIndex: 4, contactIndex: 6, daysAgo: 10 },
  { title: 'Digital Nusantara - SEO Campaign Tool', value: 30000000, currency: 'IDR', stage: 'lost' as const, probability: 0, companyIndex: 1, contactIndex: 7, daysAgo: 30, lostReason: 'Went with competitor - cheaper option' },
  { title: 'Startup Garage - MVP Build', value: 100000000, currency: 'IDR', stage: 'proposal' as const, probability: 50, companyIndex: 3, contactIndex: 8, daysAgo: 5 },
  { title: 'PayEasy - Dashboard Analytics', value: 15000, currency: 'IDR', stage: 'new' as const, probability: 15, companyIndex: 4, contactIndex: 9, daysAgo: 1 },
  { title: 'TechVentures - Mobile App', value: 250000000, currency: 'IDR', stage: 'contacted' as const, probability: 35, companyIndex: 0, contactIndex: 0, daysAgo: 6 },
  { title: 'CloudFirst - Training Workshop', value: 3000, currency: 'IDR', stage: 'won' as const, probability: 100, companyIndex: 2, contactIndex: 3, daysAgo: 60 },
  { title: 'Digital Nusantara - Social Media Bot', value: 45000000, currency: 'IDR', stage: 'new' as const, probability: 5, companyIndex: 1, contactIndex: 2, daysAgo: 1 },
  { title: 'PayEasy - Fraud Detection Module', value: 25000, currency: 'IDR', stage: 'lost' as const, probability: 0, companyIndex: 4, contactIndex: 9, daysAgo: 40, lostReason: 'Budget cut - postponed to next quarter' },
  { title: 'Startup Garage - Demo Day Platform', value: 80000000, currency: 'IDR', stage: 'contacted' as const, probability: 45, companyIndex: 3, contactIndex: 5, daysAgo: 4 },
];

const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note'] as const;

const SAMPLE_SALE_ORDERS = [
  {
    title: 'TechVentures - Platform Development SO',
    state: 'draft' as const,
    currency: 'IDR',
    companyIndex: 0,
    contactIndex: 0,
    dealIndex: 0,
    daysAgo: 10,
    lines: [
      { productName: 'Platform Development - Phase 1', quantity: 1, unitPrice: 125000000 },
      { productName: 'Project Management', quantity: 3, unitPrice: 8333333 },
    ],
  },
  {
    title: 'CloudFirst - Consulting Package SO',
    state: 'confirmed' as const,
    currency: 'IDR',
    companyIndex: 2,
    contactIndex: 4,
    dealIndex: 4,
    daysAgo: 40,
    lines: [
      { productName: 'Cloud Architecture Review', quantity: 1, unitPrice: 5000 },
      { productName: 'Migration Strategy', quantity: 1, unitPrice: 4000 },
      { productName: 'Team Training (2 days)', quantity: 2, unitPrice: 1500 },
    ],
  },
  {
    title: 'Digital Nusantara - Website Revamp SO',
    state: 'sent' as const,
    currency: 'IDR',
    companyIndex: 1,
    contactIndex: 2,
    dealIndex: 2,
    daysAgo: 5,
    lines: [
      { productName: 'Website Design', quantity: 1, unitPrice: 25000000 },
      { productName: 'Frontend Development', quantity: 1, unitPrice: 35000000 },
      { productName: 'CMS Integration', quantity: 1, unitPrice: 15000000 },
    ],
  },
  {
    title: 'Startup Garage - Demo Day Platform SO',
    state: 'draft' as const,
    currency: 'IDR',
    companyIndex: 3,
    contactIndex: 5,
    dealIndex: 13,
    daysAgo: 2,
    lines: [
      { productName: 'Platform Setup', quantity: 1, unitPrice: 30000000 },
      { productName: 'Live Streaming Module', quantity: 1, unitPrice: 25000000 },
      { productName: 'Voting System', quantity: 1, unitPrice: 20000000 },
      { productName: 'Analytics Dashboard', quantity: 1, unitPrice: 5000000 },
    ],
  },
  {
    title: 'PayEasy - Payment Gateway Module SO',
    state: 'invoiced' as const,
    currency: 'IDR',
    companyIndex: 4,
    contactIndex: 6,
    dealIndex: 6,
    daysAgo: 8,
    lines: [
      { productName: 'Payment Gateway Integration', quantity: 1, unitPrice: 6000 },
      { productName: 'Transaction Processing Module', quantity: 1, unitPrice: 1500 },
      { productName: 'Security Audit', quantity: 1, unitPrice: 500 },
    ],
  },
];

const SAMPLE_TAXES = [
  { name: 'PPN 11%', rate: 0.11, type: 'percentage' as const, scope: 'both' as const, active: true },
  { name: 'PPH 23 (2%)', rate: 0.02, type: 'percentage' as const, scope: 'purchase' as const, active: true },
  { name: 'PPN 0%', rate: 0, type: 'percentage' as const, scope: 'both' as const, active: true },
];

const SAMPLE_PAYMENT_TERMS = [
  { name: 'Immediate Payment', dueDays: 0, description: 'Payment due immediately' },
  { name: 'Net 15', dueDays: 15, description: 'Payment due within 15 days' },
  { name: 'Net 30', dueDays: 30, description: 'Payment due within 30 days' },
  { name: 'Net 60', dueDays: 60, description: 'Payment due within 60 days' },
  { name: '2/10 Net 30', dueDays: 30, discountDays: 10, discountPercent: 2, description: '2% discount if paid within 10 days, net 30' },
];

const SAMPLE_INVOICES = [
  {
    type: 'customer_invoice' as const,
    state: 'paid' as const,
    currency: 'IDR',
    companyIndex: 2,
    contactIndex: 4,
    daysAgo: 35,
    paymentStatus: 'paid' as const,
    source: 'sale_order' as const,
    saleOrderIndex: 1, // CloudFirst SO
    lines: [
      { productName: 'Cloud Architecture Review', quantity: 1, unitPrice: 5000 },
      { productName: 'Migration Strategy', quantity: 1, unitPrice: 4000 },
      { productName: 'Team Training (2 days)', quantity: 2, unitPrice: 1500 },
    ],
  },
  {
    type: 'customer_invoice' as const,
    state: 'posted' as const,
    currency: 'IDR',
    companyIndex: 4,
    contactIndex: 6,
    daysAgo: 5,
    paymentStatus: 'unpaid' as const,
    source: 'sale_order' as const,
    saleOrderIndex: 4, // PayEasy SO
    lines: [
      { productName: 'Payment Gateway Integration', quantity: 1, unitPrice: 6000 },
      { productName: 'Transaction Processing Module', quantity: 1, unitPrice: 1500 },
      { productName: 'Security Audit', quantity: 1, unitPrice: 500 },
    ],
  },
];

// Main seed function
export const seed = createInternalMutation()({
  args: {},
  returns: z.null(),
  handler: async (ctx) => {
    console.info('🌱 Starting CRM seeding...');

    try {
      await ctx.runMutation(internal.seed.cleanupSeedData, {});
      await ctx.runMutation(internal.seed.seedCrmData, {});
      console.info('✅ CRM seeding finished');
    } catch (error) {
      console.error('❌ Error while seeding:', error);
      throw error;
    }

    return null;
  },
});

// Clean up existing CRM seed data
export const cleanupSeedData = createInternalMutation()({
  args: {},
  returns: z.null(),
  handler: async (ctx) => {
    console.info('🧹 Cleaning up existing CRM data...');

    // Delete in reverse dependency order
    const activities = await ctx.table('activities').take(1000);
    for (const a of activities) await ctx.db.delete(a._id);

    const auditLogs = await ctx.table('auditLogs').take(1000);
    for (const a of auditLogs) await ctx.db.delete(a._id);

    // Delete sale orders and their lines first
    const saleOrderLines = await ctx.table('saleOrderLines').take(1000);
    for (const l of saleOrderLines) await ctx.db.delete(l._id);

    const saleOrders = await ctx.table('saleOrders').take(1000);
    for (const s of saleOrders) await ctx.db.delete(s._id);

    const paymentRecords = await ctx.table('payments').take(1000);
    for (const p of paymentRecords) await ctx.db.delete(p._id);

    const invoiceLines = await ctx.table('invoiceLines').take(1000);
    for (const l of invoiceLines) await ctx.db.delete(l._id);

    const invoices = await ctx.table('invoices').take(1000);
    for (const i of invoices) await ctx.db.delete(i._id);

    const taxes = await ctx.table('taxes').take(1000);
    for (const t of taxes) await ctx.db.delete(t._id);

    const paymentTerms = await ctx.table('paymentTerms').take(1000);
    for (const pt of paymentTerms) await ctx.db.delete(pt._id);

    const deals = await ctx.table('deals').take(1000);
    for (const d of deals) await ctx.db.delete(d._id);

    const contacts = await ctx.table('contacts').take(1000);
    for (const c of contacts) await ctx.db.delete(c._id);

    const companies = await ctx.table('companies').take(1000);
    for (const c of companies) await ctx.db.delete(c._id);

    console.info('🧹 Cleanup finished');
    return null;
  },
});

// Seed CRM data (companies, contacts, deals, activities)
export const seedCrmData = createInternalMutation()({
  args: {},
  returns: z.null(),
  handler: async (ctx) => {
    // Get admin user to use as owner
    const adminEmail = getAdminConfig().adminEmail;
    const adminUser = await ctx.table('user').get('email', adminEmail);
    if (!adminUser) {
      console.warn('⚠️ Admin user not found, skipping CRM seed');
      return null;
    }

    // Get first org for the admin user
    const membership = await ctx
      .table('member', 'organizationId_userId', (q) =>
        q.eq('organizationId', adminUser.lastActiveOrganizationId!)
      )
      .first();

    const orgId = membership?.organizationId ?? adminUser.lastActiveOrganizationId;
    if (!orgId) {
      console.warn('⚠️ No organization found, skipping CRM seed');
      return null;
    }

    const organization = await ctx.table('organization').get(orgId);
    if (organization) {
      await ctx.table('organization').getX(orgId).patch({
        settings: {
          ...(organization.settings ?? {}),
          currency: 'IDR',
        },
      });
    }

    // 1. Create companies
    console.info('🏢 Creating companies...');
    const companyIds: Id<'companies'>[] = [];
    for (const company of SAMPLE_COMPANIES) {
      const id = await ctx.table('companies').insert({
        ...company,
        organizationId: orgId,
        ownerId: adminUser._id,
      });
      companyIds.push(id);
    }
    console.info(`  ✅ Created ${companyIds.length} companies`);

    // 2. Create contacts
    console.info('👤 Creating contacts...');
    const contactIds: Id<'contacts'>[] = [];
    for (const contact of SAMPLE_CONTACTS) {
      const { companyIndex, ...contactData } = contact;
      const fullName = [contactData.firstName, contactData.lastName].filter(Boolean).join(' ');
      const id = await ctx.table('contacts').insert({
        ...contactData,
        fullName,
        companyId: companyIds[companyIndex],
        organizationId: orgId,
        ownerId: adminUser._id,
      });
      contactIds.push(id);
    }
    console.info(`  ✅ Created ${contactIds.length} contacts`);

    // 3. Create deals
    console.info('💰 Creating deals...');
    const dealIds: Id<'deals'>[] = [];
    for (const deal of SAMPLE_DEALS) {
      const { companyIndex, contactIndex, daysAgo, lostReason, ...dealData } = deal;
      const now = Date.now();
      const id = await ctx.table('deals').insert({
        ...dealData,
        companyId: companyIds[companyIndex],
        primaryContactId: contactIds[contactIndex],
        organizationId: orgId,
        ownerId: adminUser._id,
        stageEnteredAt: now - daysAgo * 24 * 60 * 60 * 1000,
        expectedCloseDate: now + (30 - daysAgo) * 24 * 60 * 60 * 1000,
        ...(dealData.stage === 'won' ? { wonAt: now - daysAgo * 24 * 60 * 60 * 1000 } : {}),
        ...(dealData.stage === 'lost' ? { lostAt: now - daysAgo * 24 * 60 * 60 * 1000, lostReason } : {}),
      });
      dealIds.push(id);
    }
    console.info(`  ✅ Created ${dealIds.length} deals`);

    // 4. Create sale orders
    console.info('📄 Creating sale orders...');
    const saleOrderIds: Id<'saleOrders'>[] = [];
    for (const so of SAMPLE_SALE_ORDERS) {
      const { companyIndex, contactIndex, dealIndex, daysAgo, lines, ...soData } = so;
      const now = Date.now();
      const orderDate = now - daysAgo * 24 * 60 * 60 * 1000;
      const validUntil = now + (14 - daysAgo) * 24 * 60 * 60 * 1000;
      const deliveryDate = now + (30 - daysAgo) * 24 * 60 * 60 * 1000;

      const number = await nextSequence(ctx, orgId, 'saleOrder', orderDate);

      // Calculate line subtotals
      const lineSubtotals = lines.map((l) => ({
        ...l,
        subtotal: l.quantity * l.unitPrice,
      }));

      const subtotal = lineSubtotals.reduce((sum, l) => sum + l.subtotal, 0);

      // Create sale order first
      const soId = await ctx.table('saleOrders').insert({
        number,
        state: soData.state,
        orderDate,
        validUntil,
        deliveryDate,
        companyId: companyIds[companyIndex],
        contactId: contactIds[contactIndex],
        dealId: dealIds[dealIndex],
        currency: soData.currency,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
        source: 'deal',
        invoiceStatus: 'to_invoice',
        deliveryStatus: 'to_deliver',
        organizationId: orgId,
        ownerId: adminUser._id,
      });

      // Create sale order lines
      for (const line of lineSubtotals) {
        await ctx.table('saleOrderLines').insert({
          ...line,
          saleOrderId: soId,
          organizationId: orgId,
        });
      }
      saleOrderIds.push(soId);
    }
    console.info(`  ✅ Created ${saleOrderIds.length} sale orders`);

    // 5. Create activities
    console.info('📋 Creating activities...');
    let activityCount = 0;
    for (let i = 0; i < dealIds.length; i++) {
      const numActivities = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numActivities; j++) {
        const type = ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
        const daysAgo = Math.floor(Math.random() * 30);
        await ctx.table('activities').insert({
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} with ${SAMPLE_CONTACTS[SAMPLE_DEALS[i].contactIndex]?.firstName || 'contact'}`,
          type,
          entityType: 'deal',
          entityId: dealIds[i] as string,
          organizationId: orgId,
          createdBy: adminUser._id,
          ...(type === 'meeting' ? { dueAt: Date.now() + (Math.random() > 0.5 ? 1 : -1) * daysAgo * 24 * 60 * 60 * 1000 } : {}),
          ...(Math.random() > 0.5 ? { completedAt: Date.now() - daysAgo * 24 * 60 * 60 * 1000 } : {}),
        });
        activityCount++;
      }
    }
    console.info(`  ✅ Created ${activityCount} activities`);

    // 6. Create taxes
    console.info('🧾 Creating taxes...');
    const taxIds: Id<'taxes'>[] = [];
    for (const tax of SAMPLE_TAXES) {
      const id = await ctx.table('taxes').insert({
        ...tax,
        organizationId: orgId,
      });
      taxIds.push(id);
    }
    console.info(`  ✅ Created ${taxIds.length} taxes`);

    // 7. Create payment terms
    console.info('📅 Creating payment terms...');
    const paymentTermIds: Id<'paymentTerms'>[] = [];
    for (const term of SAMPLE_PAYMENT_TERMS) {
      const id = await ctx.table('paymentTerms').insert({
        ...term,
        organizationId: orgId,
      });
      paymentTermIds.push(id);
    }
    console.info(`  ✅ Created ${paymentTermIds.length} payment terms`);

    // 8. Create invoices
    console.info('📄 Creating invoices...');
    const invoiceIds: Id<'invoices'>[] = [];
    for (const inv of SAMPLE_INVOICES) {
      const { companyIndex, contactIndex, saleOrderIndex, daysAgo, lines, ...invData } = inv;
      const now = Date.now();
      const invoiceDate = now - daysAgo * 24 * 60 * 60 * 1000;
      const dueDate = invoiceDate + 30 * 24 * 60 * 60 * 1000;

      const number = await nextSequence(ctx, orgId, 'invoice', invoiceDate);

      const lineSubtotals = lines.map((l) => ({
        ...l,
        subtotal: l.quantity * l.unitPrice,
      }));

      const subtotal = lineSubtotals.reduce((sum, l) => sum + l.subtotal, 0);

      const invId = await ctx.table('invoices').insert({
        ...invData,
        number,
        invoiceDate,
        dueDate,
        companyId: companyIds[companyIndex],
        contactId: contactIds[contactIndex],
        saleOrderId: saleOrderIds[saleOrderIndex],
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
        amountDue: invData.state === 'paid' ? 0 : subtotal,
        organizationId: orgId,
        ownerId: adminUser._id,
      });

      for (const line of lineSubtotals) {
        await ctx.table('invoiceLines').insert({
          ...line,
          invoiceId: invId,
          organizationId: orgId,
        });
      }

      // If paid, create a payment record
      if (invData.state === 'paid') {
        await ctx.table('payments').insert({
          amount: subtotal,
          paymentDate: invoiceDate + 2 * 24 * 60 * 60 * 1000,
          method: 'bank_transfer',
          state: 'confirmed',
          invoiceId: invId,
          companyId: companyIds[companyIndex],
          organizationId: orgId,
          ownerId: adminUser._id,
        });
      }

      invoiceIds.push(invId);
    }
    console.info(`  ✅ Created ${invoiceIds.length} invoices`);

    // -------------------------
    // Reminder Rules
    // -------------------------
    console.info('📧 Creating reminder rules...');

    const reminderRuleData = [
      {
        name: 'First Reminder',
        daysOverdue: 7,
        subject: 'Reminder: Invoice {invoice_number} is overdue',
        body: 'Dear {customer_name},\n\nThis is a friendly reminder that invoice {invoice_number} for {amount} was due on {due_date}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.',
        includeInvoicePdf: true,
        isActive: true,
      },
      {
        name: 'Second Notice',
        daysOverdue: 30,
        subject: 'Second Notice: Invoice {invoice_number} is {days_overdue} days overdue',
        body: 'Dear {customer_name},\n\nWe have not yet received payment for invoice {invoice_number} ({amount}), which was due on {due_date}.\n\nPlease process payment immediately or contact us.\n\nRegards.',
        includeInvoicePdf: true,
        isActive: true,
      },
      {
        name: 'Final Notice',
        daysOverdue: 60,
        subject: 'FINAL NOTICE: Invoice {invoice_number}',
        body: 'Dear {customer_name},\n\nThis is our final notice regarding invoice {invoice_number} for {amount}, due on {due_date}.\n\nThis invoice is now {days_overdue} days overdue. Please contact us immediately.',
        includeInvoicePdf: true,
        isActive: true,
      },
    ];

    for (const rule of reminderRuleData) {
      await ctx.table('reminderRules').insert({
        ...rule,
        organizationId: orgId,
      });
    }
    console.info(`  ✅ Created ${reminderRuleData.length} reminder rules`);

    return null;
  },
});

/**
 * Seed shop products and categories for testing the online store.
 * Run: npx convex run seed:seedShopData
 */
export const seedShopData = createInternalMutation()({
  args: {},
  returns: z.object({
    categories: z.number(),
    products: z.number(),
  }),
  handler: async (ctx) => {
    const adminEmail = getAdminConfig().adminEmail;
    const admin = await ctx.table('user').get('email', adminEmail);
    if (!admin) throw new Error('Admin user not found. Run seed first.');

    // Find org from admin's lastActiveOrganizationId
    const orgId = admin.lastActiveOrganizationId;
    if (!orgId) throw new Error('Admin has no active organization. Run seed first.');
    const org = await ctx.table('organization').get(orgId);
    if (!org) throw new Error('Organization not found.');

    // Set org slug to 'default' so the online shop can find it
    if (org.slug !== 'default') {
      await org.patch({ slug: 'default' });
      console.info(`  ✅ Updated org slug to 'default'`);
    }
    const userId = admin._id;

    // --- Categories ---
    const categoryData = [
      { name: 'Elektronik', description: 'Perangkat elektronik dan aksesoris' },
      { name: 'Pakaian', description: 'Baju, celana, dan aksesoris fashion' },
      { name: 'Makanan & Minuman', description: 'Produk F&B lokal' },
      { name: 'Peralatan Rumah', description: 'Peralatan dan perlengkapan rumah tangga' },
      { name: 'Olahraga', description: 'Peralatan dan apparel olahraga' },
    ];

    const categoryIds: Record<string, any> = {};
    for (const cat of categoryData) {
      const existing = await ctx
        .table('productCategories', 'organizationId_parentId', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .filter((q: any) => q.eq(q.field('name'), cat.name))
        .first();
      if (existing) {
        categoryIds[cat.name] = existing._id;
      } else {
        categoryIds[cat.name] = await ctx.table('productCategories').insert({
          name: cat.name,
          description: cat.description,
          active: true,
          organizationId: orgId,
        });
      }
    }
    console.info(`  ✅ Ensured ${categoryData.length} categories`);

    // --- Products ---
    const productsData = [
      {
        name: 'Earbuds Pro TWS',
        type: 'storable' as const,
        description: 'Earbuds wireless ANC, baterai 30 jam, IPX5',
        price: 450000,
        cost: 200000,
        sku: 'EB-PRO-001',
        unit: 'pcs',
        tags: ['bestseller', 'wireless'],
        category: 'Elektronik',
        imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=600&h=600&fit=crop',
      },
      {
        name: 'Kaos Polos Premium',
        type: 'storable' as const,
        description: 'Katun combed 30s, nyaman sehari-hari',
        price: 89000,
        cost: 35000,
        sku: 'KP-PLS-001',
        unit: 'pcs',
        tags: ['bestseller'],
        category: 'Pakaian',
        imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop',
      },
      {
        name: 'Kopi Arabika Gayo 250g',
        type: 'storable' as const,
        description: 'Single origin, medium roast, specialty grade',
        price: 75000,
        cost: 30000,
        sku: 'KF-GYO-250',
        unit: 'pcs',
        tags: ['lokal', 'bestseller'],
        category: 'Makanan & Minuman',
        imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&h=600&fit=crop',
      },
      {
        name: 'Tumbler Stainless 750ml',
        type: 'storable' as const,
        description: 'Vacuum insulated, keep cold 24h / hot 12h',
        price: 125000,
        cost: 50000,
        sku: 'TB-SS-750',
        unit: 'pcs',
        tags: ['bestseller'],
        category: 'Peralatan Rumah',
        imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop',
      },
      {
        name: 'Yoga Mat 8mm',
        type: 'storable' as const,
        description: 'TPE eco-friendly, anti-slip, 183x61cm',
        price: 199000,
        cost: 80000,
        sku: 'YM-TPE-008',
        unit: 'pcs',
        tags: ['wellness'],
        category: 'Olahraga',
        imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop',
      },
      {
        name: 'Charger USB-C 65W GaN',
        type: 'storable' as const,
        description: 'Fast charging, compact, universal compatibility',
        price: 185000,
        cost: 75000,
        sku: 'CH-GAN-065',
        unit: 'pcs',
        tags: ['fast-charging'],
        category: 'Elektronik',
        imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&h=600&fit=crop',
      },
      {
        name: 'Hoodie Oversize',
        type: 'storable' as const,
        description: 'Fleece premium, cocok untuk weather Indonesia',
        price: 159000,
        cost: 60000,
        sku: 'HD-OVS-001',
        unit: 'pcs',
        tags: ['fashion'],
        category: 'Pakaian',
        imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop',
      },
      {
        name: 'Sambal Bawang Crispy 200g',
        type: 'storable' as const,
        description: 'Homestyle, rendah sodium, tanpa pengawet',
        price: 45000,
        cost: 15000,
        sku: 'SM-BWG-200',
        unit: 'pcs',
        tags: ['lokal', 'bestseller'],
        category: 'Makanan & Minuman',
        imageUrl: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=600&fit=crop',
      },
      {
        name: 'Diffuser Aromatherapy 300ml',
        type: 'storable' as const,
        description: 'Ultrasonik, LED 7 warna, auto-off',
        price: 175000,
        cost: 65000,
        sku: 'DF-ATH-300',
        unit: 'pcs',
        tags: ['home', 'wellness'],
        category: 'Peralatan Rumah',
        imageUrl: 'https://images.unsplash.com/photo-1602928321679-560bb453f190?w=600&h=600&fit=crop',
      },
      {
        name: 'Resistance Band Set 5 Level',
        type: 'storable' as const,
        description: 'Latex, 5 level resistance, termasuk carry bag',
        price: 95000,
        cost: 30000,
        sku: 'RB-SET-005',
        unit: 'set',
        tags: ['home-workout'],
        category: 'Olahraga',
        imageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=600&h=600&fit=crop',
      },
    ];

    // Patch existing products to add visibleInShop if missing
    const existingProducts = await ctx
      .table('products', 'organizationId_visibleInShop', (q: any) =>
        q.eq('organizationId', orgId)
      )
      .take(1000);
    let patched = 0;
    for (const ep of existingProducts) {
      if ((ep as any).visibleInShop === undefined || (ep as any).visibleInShop === null) {
        await (ep as any).patch({ visibleInShop: true });
        patched++;
      }
    }
    if (patched > 0) console.info(`  ✅ Patched ${patched} existing products with visibleInShop: true`);

    let created = 0;
    for (const p of productsData) {
      // Skip if SKU already exists
      const existing = await ctx
        .table('products', 'organizationId_category', (q: any) =>
          q.eq('organizationId', orgId)
        )
        .filter((q: any) => q.eq(q.field('sku'), p.sku))
        .first();
      if (existing) {
        // Patch image if missing
        if (p.imageUrl && !(existing as any).imageUrl) {
          await (existing as any).patch({ imageUrl: p.imageUrl });
        }
        continue;
      }

      const categoryId = categoryIds[p.category];
      const productId = await ctx.table('products').insert({
        name: p.name,
        type: p.type,
        description: p.description,
        imageUrl: p.imageUrl,
        price: p.price,
        cost: p.cost,
        sku: p.sku,
        unit: p.unit,
        tags: p.tags,
        category: categoryId,
        active: true,
        visibleInShop: true,
        organizationId: orgId,
        ownerId: userId,
      });

      // Auto-create default variant
      await ctx.table('productVariants').insert({
        name: p.name,
        productId,
        organizationId: orgId,
      });

      created++;
    }
    console.info(`  ✅ Created ${created} products (${productsData.length - created} already existed)`);

    return { categories: categoryData.length, products: created };
  },
});
