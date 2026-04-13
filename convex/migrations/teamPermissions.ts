import { z } from 'zod';

import type { Id } from '../_generated/dataModel';
import { createInternalMutation } from '../functions';
import { seedDefaultTemplates } from '../permissionHelpers';

export const backfillPermissionTemplates = createInternalMutation()({
  args: {},
  returns: z.object({
    orgsProcessed: z.number(),
    membersUpdated: z.number(),
  }),
  handler: async (ctx) => {
    // 1. Get all organizations
    const orgs = await ctx.table('organization').take(1000);

    let orgsProcessed = 0;
    let membersUpdated = 0;

    for (const org of orgs) {
      // 2. Check if org already has templates (idempotent)
      const existingTemplates = await ctx
        .table('permissionTemplates', 'organizationId_name', (q) =>
          q.eq('organizationId', org._id),
        )
        .take(1);

      if (existingTemplates.length === 0) {
        // 3. Find an owner member to use as ownerId
        const ownerMembers = await ctx
          .table('member', 'organizationId_role', (q) =>
            q.eq('organizationId', org._id).eq('role', 'owner'),
          )
          .take(1);

        const ownerId = ownerMembers[0]?.userId;
        if (!ownerId) continue; // Skip orgs without an owner

        // 4. Seed default templates
        // seedDefaultTemplates expects AuthMutationCtx but only uses ctx.table
        await seedDefaultTemplates(
          ctx as any,
          org._id as Id<'organization'>,
          ownerId as Id<'user'>,
        );
        orgsProcessed++;
      }

      // 5. Find the default Member template for this org
      const memberTemplates = await ctx
        .table('permissionTemplates', 'organizationId_name', (q) =>
          q.eq('organizationId', org._id).eq('name', 'Member'),
        )
        .take(1);

      const memberTemplateId = memberTemplates[0]?._id;
      if (!memberTemplateId) continue;

      // 6. Find members without permissionTemplateId (skip owners)
      const members = await ctx
        .table('member', 'organizationId_role', (q) =>
          q.eq('organizationId', org._id),
        )
        .take(500);

      for (const member of members) {
        if (!member.permissionTemplateId && member.role !== 'owner') {
          await ctx.table('member').getX(member._id).patch({
            permissionTemplateId: memberTemplateId,
          });
          membersUpdated++;
        }
      }
    }

    return { orgsProcessed, membersUpdated };
  },
});
