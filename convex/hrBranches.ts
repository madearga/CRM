import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgMutation, createOrgQuery } from './functions';
import { branchOutputSchema } from './hrTypes';
import { makeBranchQrCode } from './hrUtils';

function toBranchOutput(branch: any) {
  return {
    id: branch._id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    latitude: branch.latitude,
    longitude: branch.longitude,
    qrCode: branch.qrCode,
    isActive: branch.isActive,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

async function getOwnedBranch(ctx: any, branchId: any) {
  const branch = await ctx.table('branches').get(branchId);
  if (!branch || branch.organizationId !== ctx.orgId) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Branch not found' });
  }
  return branch;
}

export const list = createOrgQuery({
  permission: { feature: 'hr_branches', action: 'view' },
})({
  args: { includeInactive: z.boolean().optional() },
  returns: z.array(branchOutputSchema),
  handler: async (ctx, args) => {
    const branches = args.includeInactive
      ? await ctx
          .table('branches', 'organizationId', (q: any) => q.eq('organizationId', ctx.orgId))
          .take(200)
      : await ctx
          .table('branches', 'organizationId_isActive', (q: any) =>
            q.eq('organizationId', ctx.orgId).eq('isActive', true)
          )
          .take(200);
    return branches.map(toBranchOutput);
  },
});

export const getById = createOrgQuery({
  permission: { feature: 'hr_branches', action: 'view' },
})({
  args: { id: zid('branches') },
  returns: branchOutputSchema.nullable(),
  handler: async (ctx, args) => {
    const branch = await ctx.table('branches').get(args.id);
    if (!branch || branch.organizationId !== ctx.orgId) return null;
    return toBranchOutput(branch);
  },
});

export const create = createOrgMutation({
  permission: { feature: 'hr_branches', action: 'create' },
})({
  args: {
    name: z.string().min(1),
    address: z.string().optional(),
    phone: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  },
  returns: zid('branches'),
  handler: async (ctx, args) => {
    const existing = await ctx
      .table('branches', 'organizationId_name', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('name', args.name)
      )
      .take(1);
    if (existing.length > 0) {
      throw new ConvexError({ code: 'CONFLICT', message: 'Branch name already exists' });
    }

    const now = Date.now();
    return ctx.table('branches').insert({
      name: args.name,
      address: args.address ?? null,
      phone: args.phone ?? null,
      latitude: args.latitude ?? null,
      longitude: args.longitude ?? null,
      qrCode: makeBranchQrCode(ctx.orgId, args.name),
      isActive: true,
      organizationId: ctx.orgId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = createOrgMutation({
  permission: { feature: 'hr_branches', action: 'edit' },
})({
  args: {
    id: zid('branches'),
    name: z.string().min(1).optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    isActive: z.boolean().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const branch = await getOwnedBranch(ctx, args.id);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.address !== undefined) patch.address = args.address;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.latitude !== undefined) patch.latitude = args.latitude;
    if (args.longitude !== undefined) patch.longitude = args.longitude;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await branch.patch(patch);
    return null;
  },
});

export const regenerateQr = createOrgMutation({
  permission: { feature: 'hr_branches', action: 'edit' },
})({
  args: { id: zid('branches') },
  returns: z.string(),
  handler: async (ctx, args) => {
    const branch = await getOwnedBranch(ctx, args.id);
    const qrCode = makeBranchQrCode(ctx.orgId, branch.name);
    await branch.patch({ qrCode, updatedAt: Date.now() });
    return qrCode;
  },
});
