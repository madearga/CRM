import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgMutation, createOrgQuery } from './functions';
import { employeeOutputSchema, employeeStatusSchema } from './hrTypes';
import { assertBranchAccess } from './hrUtils';

function toEmployeeOutput(employee: any) {
  return {
    id: employee._id,
    name: employee.name,
    nik: employee.nik,
    email: employee.email,
    phone: employee.phone,
    position: employee.position,
    department: employee.department,
    whatsappNumber: employee.whatsappNumber,
    status: employee.status,
    branchId: employee.branchId,
    userId: employee.userId,
    hireDate: employee.hireDate,
    resignDate: employee.resignDate,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

async function getOwnedEmployee(ctx: any, employeeId: any) {
  const employee = await ctx.table('employees').get(employeeId);
  if (!employee || employee.organizationId !== ctx.orgId) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Employee not found' });
  }
  await assertBranchAccess(ctx, employee.branchId);
  return employee;
}

async function assertBranchExists(ctx: any, branchId: any) {
  const branch = await ctx.table('branches').get(branchId);
  if (!branch || branch.organizationId !== ctx.orgId || !branch.isActive) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Branch not found' });
  }
}

export const list = createOrgQuery({
  permission: { feature: 'hr_employees', action: 'view' },
})({
  args: {
    branchId: zid('branches').optional(),
    department: z.string().optional(),
    status: employeeStatusSchema.optional(),
    search: z.string().optional(),
    limit: z.number().min(1).max(200).optional(),
  },
  returns: z.array(employeeOutputSchema),
  handler: async (ctx, args) => {
    let employees = await ctx
      .table('employees', 'organizationId_status', (q: any) =>
        args.status ? q.eq('organizationId', ctx.orgId).eq('status', args.status) : q.eq('organizationId', ctx.orgId)
      )
      .take(args.limit ?? 100);

    if (args.branchId) employees = employees.filter((employee: any) => employee.branchId === args.branchId);
    if (args.department) employees = employees.filter((employee: any) => employee.department === args.department);
    if (args.search) {
      const search = args.search.toLowerCase();
      employees = employees.filter((employee: any) =>
        employee.name.toLowerCase().includes(search) || employee.nik.toLowerCase().includes(search)
      );
    }

    const scoped: any[] = [];
    for (const employee of employees) {
      try {
        await assertBranchAccess(ctx, employee.branchId);
        scoped.push(employee);
      } catch {
        continue;
      }
    }
    return scoped.map(toEmployeeOutput);
  },
});

export const getById = createOrgQuery({
  permission: { feature: 'hr_employees', action: 'view' },
})({
  args: { id: zid('employees') },
  returns: employeeOutputSchema.nullable(),
  handler: async (ctx, args) => {
    const employee = await ctx.table('employees').get(args.id);
    if (!employee || employee.organizationId !== ctx.orgId) return null;
    await assertBranchAccess(ctx, employee.branchId);
    return toEmployeeOutput(employee);
  },
});

export const create = createOrgMutation({
  permission: { feature: 'hr_employees', action: 'create' },
})({
  args: {
    name: z.string().min(1),
    nik: z.string().min(1),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    birthDate: z.number().nullable().optional(),
    gender: z.string().nullable().optional(),
    position: z.string().min(1),
    department: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    whatsappNumber: z.string().nullable().optional(),
    branchId: zid('branches'),
    userId: zid('user').nullable().optional(),
    hireDate: z.number().nullable().optional(),
  },
  returns: zid('employees'),
  handler: async (ctx, args) => {
    await assertBranchExists(ctx, args.branchId);
    await assertBranchAccess(ctx, args.branchId);
    const existing = await ctx
      .table('employees', 'organizationId_nik', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('nik', args.nik)
      )
      .take(1);
    if (existing.length > 0) {
      throw new ConvexError({ code: 'CONFLICT', message: 'NIK already exists' });
    }
    const now = Date.now();
    return ctx.table('employees').insert({
      ...args,
      status: 'active',
      hireDate: args.hireDate ?? now,
      organizationId: ctx.orgId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = createOrgMutation({
  permission: { feature: 'hr_employees', action: 'edit' },
})({
  args: {
    id: zid('employees'),
    name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    birthDate: z.number().nullable().optional(),
    gender: z.string().nullable().optional(),
    position: z.string().min(1).optional(),
    department: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    whatsappNumber: z.string().nullable().optional(),
    branchId: zid('branches').optional(),
    userId: zid('user').nullable().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const employee = await getOwnedEmployee(ctx, args.id);
    if (args.branchId) {
      await assertBranchExists(ctx, args.branchId);
      await assertBranchAccess(ctx, args.branchId);
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const key of ['name', 'email', 'phone', 'address', 'birthDate', 'gender', 'position', 'department', 'photoUrl', 'whatsappNumber', 'branchId', 'userId']) {
      if ((args as any)[key] !== undefined) patch[key] = (args as any)[key];
    }
    await employee.patch(patch);
    return null;
  },
});

export const updateStatus = createOrgMutation({
  permission: { feature: 'hr_employees', action: 'edit' },
})({
  args: {
    id: zid('employees'),
    status: employeeStatusSchema,
    resignDate: z.number().nullable().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const employee = await getOwnedEmployee(ctx, args.id);
    const patch: Record<string, unknown> = { status: args.status, updatedAt: Date.now() };
    if (args.status === 'resigned') patch.resignDate = args.resignDate ?? Date.now();
    if (args.status !== 'resigned') patch.resignDate = null;
    await employee.patch(patch);
    return null;
  },
});
