import { v } from 'convex/values';
import { internalQuery, internalMutation } from './_generated/server';

export const getAttendanceDailySummary = internalQuery({
  args: {
    organizationId: v.id('organization'),
    date: v.string(),
    branchId: v.optional(v.id('branches')),
  },
  returns: v.array(
    v.object({
      branchId: v.id('branches'),
      total: v.number(),
      present: v.number(),
      late: v.number(),
      absent: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const employees = await ctx.db
      .query('employees')
      .withIndex('organizationId_status', (q) =>
        q.eq('organizationId', args.organizationId).eq('status', 'active')
      )
      .take(500);

    const records = args.branchId
      ? await ctx.db
          .query('attendanceRecords')
          .withIndex('organizationId_branchId_date', (q) =>
            q
              .eq('organizationId', args.organizationId)
              .eq('branchId', args.branchId!)
              .eq('date', args.date)
          )
          .take(500)
      : await ctx.db
          .query('attendanceRecords')
          .withIndex('organizationId_date', (q) =>
            q.eq('organizationId', args.organizationId).eq('date', args.date)
          )
          .take(500);

    const byBranch = new Map<
      string,
      { branchId: any; total: number; present: number; late: number; absent: number }
    >();

    for (const employee of employees) {
      if (args.branchId && employee.branchId !== args.branchId) continue;
      const key = String(employee.branchId);
      const row = byBranch.get(key) ?? {
        branchId: employee.branchId,
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
      };
      row.total += 1;
      const record = records.find((r) => r.employeeId === employee._id);
      if (record) {
        row.present += 1;
        if (record.label === 'late') row.late += 1;
      } else {
        row.absent += 1;
      }
      byBranch.set(key, row);
    }

    return Array.from(byBranch.values());
  },
});

export const getDashboardStats = internalQuery({
  args: {
    organizationId: v.id('organization'),
    userId: v.id('user'),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const [companies, deals, recentActivities, upcomingActivities, allActivitiesCount] = await Promise.all([
      ctx.db
        .query('companies')
        .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
        .take(500),
      ctx.db
        .query('deals')
        .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
        .take(500),
      ctx.db
        .query('activities')
        .withIndex('organizationId_createdAt', (q) => q.eq('organizationId', args.organizationId))
        .order('desc')
        .take(10),
      ctx.db
        .query('activities')
        .withIndex('assigneeId_organizationId_dueAt', (q) =>
          q.eq('assigneeId', args.userId).eq('organizationId', args.organizationId).gt('dueAt', Date.now())
        )
        .take(10),
      ctx.db
        .query('activities')
        .withIndex('organizationId_createdAt', (q) => q.eq('organizationId', args.organizationId))
        .collect(),
    ]);

    const activeCompanies = companies.filter((company) => !company.archivedAt);
    const activeDeals = deals.filter((deal) => !deal.archivedAt);
    const stages = ['new', 'contacted', 'proposal', 'won', 'lost'];
    const dealsByStage = stages.map((stage) => {
      const stageDeals = activeDeals.filter((deal) => deal.stage === stage);
      return {
        stage,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0),
      };
    });

    return {
      pipelineValue: activeDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0),
      totalDeals: activeDeals.length,
      totalCompanies: activeCompanies.length,
      totalActivities: allActivitiesCount.length,
      dealsByStage,
      recentActivities: recentActivities.map((activity) => ({
        id: activity._id,
        title: activity.title,
        type: activity.type,
        entityType: activity.entityType,
        entityId: activity.entityId,
        createdAt: activity.createdAt ?? activity._creationTime,
      })),
      upcomingActivities: upcomingActivities
        .filter((activity) => !activity.completedAt)
        .map((activity) => ({
          id: activity._id,
          title: activity.title,
          type: activity.type,
          entityType: activity.entityType,
          entityId: activity.entityId,
          dueAt: activity.dueAt!,
        })),
      agingDeals: [],
    };
  },
});

export const listCompanies = internalQuery({
  args: {
    organizationId: v.id('organization'),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let companies = await ctx.db
      .query('companies')
      .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
      .take(args.limit ?? 50);

    if (!args.includeArchived) {
      companies = companies.filter((c) => !c.archivedAt);
    }
    if (args.search) {
      const needle = args.search.toLowerCase();
      companies = companies.filter((c) =>
        [c.name, c.industry, c.country].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    return companies.map((c) => ({
      id: c._id,
      name: c.name,
      industry: c.industry,
      size: c.size,
      country: c.country,
      website: c.website,
      archivedAt: c.archivedAt,
    }));
  },
});

export const getCompanyById = internalQuery({
  args: {
    organizationId: v.id('organization'),
    id: v.id('companies'),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.id);
    if (!company || company.organizationId !== args.organizationId) return null;
    return {
      id: company._id,
      name: company.name,
      industry: company.industry,
      size: company.size,
      country: company.country,
      website: company.website,
      address: company.address,
    };
  },
});

export const listContacts = internalQuery({
  args: {
    organizationId: v.id('organization'),
    companyId: v.optional(v.id('companies')),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let contacts = await ctx.db
      .query('contacts')
      .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
      .take(args.limit ?? 50);

    if (args.companyId) {
      contacts = contacts.filter((c) => c.companyId === args.companyId);
    }
    if (args.search) {
      const needle = args.search.toLowerCase();
      contacts = contacts.filter((c) =>
        [c.fullName, c.email, c.phone, c.jobTitle].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    return contacts.map((c) => ({
      id: c._id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      jobTitle: c.jobTitle,
      companyId: c.companyId,
    }));
  },
});

export const getContactById = internalQuery({
  args: {
    organizationId: v.id('organization'),
    id: v.id('contacts'),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.id);
    if (!contact || contact.organizationId !== args.organizationId) return null;
    return {
      id: contact._id,
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      jobTitle: contact.jobTitle,
      companyId: contact.companyId,
    };
  },
});

export const listDeals = internalQuery({
  args: {
    organizationId: v.id('organization'),
    stage: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let deals = args.stage
      ? await ctx.db
          .query('deals')
          .withIndex('organizationId_stage', (q) =>
            q.eq('organizationId', args.organizationId).eq('stage', args.stage as any)
          )
          .take(args.limit ?? 50)
      : await ctx.db
          .query('deals')
          .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
          .take(args.limit ?? 50);

    deals = deals.filter((d) => !d.archivedAt);

    return deals.map((d) => ({
      id: d._id,
      title: d.title,
      stage: d.stage,
      value: d.value,
      companyId: d.companyId,
      probability: d.probability,
      expectedCloseDate: d.expectedCloseDate,
    }));
  },
});

export const getDealById = internalQuery({
  args: {
    organizationId: v.id('organization'),
    id: v.id('deals'),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const deal = await ctx.db.get(args.id);
    if (!deal || deal.organizationId !== args.organizationId) return null;
    return {
      id: deal._id,
      title: deal.title,
      stage: deal.stage,
      value: deal.value,
      companyId: deal.companyId,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      lostReason: deal.lostReason,
    };
  },
});

export const createActivityForHttp = internalMutation({
  args: {
    organizationId: v.id('organization'),
    userId: v.id('user'),
    type: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  returns: v.id('activities'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('activities', {
      organizationId: args.organizationId,
      type: args.type as any,
      entityType: args.entityType as any,
      entityId: args.entityId,
      title: args.title,
      description: args.description,
      dueAt: args.dueAt,
      createdBy: args.userId,
      createdAt: Date.now(),
    } as any);
  },
});

export const updateDealStageForHttp = internalMutation({
  args: {
    organizationId: v.id('organization'),
    id: v.id('deals'),
    stage: v.string(),
    lostReason: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const deal = await ctx.db.get(args.id);
    if (!deal || deal.organizationId !== args.organizationId) return false;
    await ctx.db.patch(args.id, {
      stage: args.stage as any,
      lostReason: args.lostReason,
      stageEnteredAt: Date.now(),
    } as any);
    return true;
  },
});

export const listShifts = internalQuery({
  args: {
    organizationId: v.id('organization'),
    branchId: v.optional(v.id('branches')),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let shifts = await ctx.db
      .query('shifts')
      .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
      .take(200);

    if (args.branchId) {
      shifts = shifts.filter((s) => s.branchId === args.branchId);
    }

    return shifts.map((s) => ({
      id: s._id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      branchId: s.branchId,
      daysOfWeek: s.daysOfWeek,
    }));
  },
});

export const listHolidays = internalQuery({
  args: {
    organizationId: v.id('organization'),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const holidays = await ctx.db
      .query('holidays')
      .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
      .take(100);

    return holidays.map((h) => ({
      id: h._id,
      date: h.date,
      name: h.name,
      isRecurring: h.isRecurring,
    }));
  },
});

export const listInvoices = internalQuery({
  args: {
    organizationId: v.id('organization'),
    state: v.optional(v.string()),
    companyId: v.optional(v.id('companies')),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let invoices = args.state
      ? await ctx.db
          .query('invoices')
          .withIndex('organizationId_state', (q) =>
            q.eq('organizationId', args.organizationId).eq('state', args.state as any)
          )
          .take(args.limit ?? 50)
      : await ctx.db
          .query('invoices')
          .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
          .take(args.limit ?? 50);

    if (args.companyId) {
      invoices = invoices.filter((i) => i.companyId === args.companyId);
    }
    if (args.search) {
      const needle = args.search.toLowerCase();
      invoices = invoices.filter((i) =>
        [i.number].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    return invoices.map((i) => ({
      id: i._id,
      number: i.number,
      type: i.type,
      state: i.state,
      totalAmount: i.totalAmount,
      companyId: i.companyId,
      dueDate: i.dueDate,
    }));
  },
});

export const getInvoiceById = internalQuery({
  args: {
    organizationId: v.id('organization'),
    id: v.id('invoices'),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.organizationId !== args.organizationId) return null;
    return {
      id: invoice._id,
      number: invoice.number,
      type: invoice.type,
      state: invoice.state,
      totalAmount: invoice.totalAmount,
      companyId: invoice.companyId,
      dueDate: invoice.dueDate,
    };
  },
});

export const listProducts = internalQuery({
  args: {
    organizationId: v.id('organization'),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let products = await ctx.db
      .query('products')
      .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
      .take(args.limit ?? 50);

    if (args.search) {
      const needle = args.search.toLowerCase();
      products = products.filter((p) =>
        [p.name, p.sku, p.barcode].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    return products.map((p) => ({
      id: p._id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      type: p.type,
      active: p.active,
    }));
  },
});

export const listSaleOrders = internalQuery({
  args: {
    organizationId: v.id('organization'),
    state: v.optional(v.string()),
    companyId: v.optional(v.id('companies')),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let orders = args.state
      ? await ctx.db
          .query('saleOrders')
          .withIndex('organizationId_state', (q) =>
            q.eq('organizationId', args.organizationId).eq('state', args.state as any)
          )
          .take(args.limit ?? 50)
      : await ctx.db
          .query('saleOrders')
          .withIndex('organizationId', (q) => q.eq('organizationId', args.organizationId))
          .take(args.limit ?? 50);

    if (args.companyId) {
      orders = orders.filter((o) => o.companyId === args.companyId);
    }
    if (args.search) {
      const needle = args.search.toLowerCase();
      orders = orders.filter((o) =>
        [o.number].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    return orders.map((o) => ({
      id: o._id,
      number: o.number,
      state: o.state,
      totalAmount: o.totalAmount,
      companyId: o.companyId,
      orderDate: o.orderDate,
    }));
  },
});

export const listEmployees = internalQuery({
  args: {
    organizationId: v.id('organization'),
    status: v.optional(v.string()),
    department: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const status = args.status ?? 'active';
    let employees = await ctx.db
      .query('employees')
      .withIndex('organizationId_status', (q) =>
        q.eq('organizationId', args.organizationId).eq('status', status)
      )
      .take(args.limit ?? 100);

    if (args.department) {
      employees = employees.filter((employee) => employee.department === args.department);
    }
    if (args.search) {
      const needle = args.search.toLowerCase();
      employees = employees.filter((employee) =>
        [employee.name, employee.nik, employee.position, employee.department]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }

    return employees.map((employee) => ({
      id: employee._id,
      name: employee.name,
      nik: employee.nik,
      position: employee.position,
      department: employee.department,
      status: employee.status,
      branchId: employee.branchId,
    }));
  },
});
