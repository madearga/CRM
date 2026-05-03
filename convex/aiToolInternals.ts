import { v } from 'convex/values';
import { internalQuery } from './_generated/server';

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
