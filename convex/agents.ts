// The agents of an organization.
//
// An agent is a worker of the organization, not a user: it never signs in and
// it never owns an organization. It carries its own key (the agentId), its own
// scopes and its own status, and it can be a member of a room.
//
// Rules that hold for every function in this file:
// - The organization always comes from the session context, so an agent can
//   never cross an organization border.
// - The key of an agent is unique inside one organization only, so the same
//   key may exist in two organizations without a conflict.

import { AGENT_STATUSES } from '@crm/domain';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import type { Doc } from './_generated/dataModel';
import type { DatabaseReader } from './_generated/server';
import { createOrgMutation, createOrgQuery } from './functions';

/** A key is a lower case word of letters, digits and dashes. */
const AGENT_KEY_PATTERN = /^[a-z0-9-]+$/;

type AgentDoc = Doc<'agents'>;

/** Plain view of an agent. Absent optional fields stay absent. */
function toAgentView(agent: AgentDoc) {
  return {
    id: agent._id,
    agentId: agent.agentId,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    model: agent.model,
    scopes: agent.scopes,
    createdAt: agent.createdAt,
  };
}

/** The agent of the organization with this key, or null. */
async function findAgentByKey(
  ctx: { db: DatabaseReader },
  organizationId: AgentDoc['organizationId'],
  agentId: string
): Promise<AgentDoc | null> {
  return ctx.db
    .query('agents')
    .withIndex('organizationId_agentId', (q) =>
      q.eq('organizationId', organizationId).eq('agentId', agentId)
    )
    .first();
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export const list = createOrgQuery({
  permission: { feature: 'agents', action: 'view' },
})({
  handler: async (ctx) => {
    const agents = await ctx.db
      .query('agents')
      .withIndex('organizationId_agentId', (q) => q.eq('organizationId', ctx.orgId))
      .collect();

    return agents.map(toAgentView);
  },
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

export const get = createOrgQuery({
  permission: { feature: 'agents', action: 'view' },
})({
  args: {
    agentId: z.string().min(1).max(60),
  },
  handler: async (ctx, args) => {
    const agent = await findAgentByKey(ctx, ctx.orgId, args.agentId);

    if (!agent) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The agent does not exist in this organization',
      });
    }

    return toAgentView(agent);
  },
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export const create = createOrgMutation({
  permission: { feature: 'agents', action: 'create' },
})({
  args: {
    agentId: z
      .string()
      .min(1)
      .max(60)
      .regex(AGENT_KEY_PATTERN, 'The key holds lower case letters, digits and dashes'),
    name: z.string().min(1).max(80),
    description: z.string().max(1000).optional(),
    model: z.string().max(100).optional(),
    scopes: z.array(z.string().min(1).max(100)).max(50).optional(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await findAgentByKey(ctx, ctx.orgId, args.agentId);
    if (existing) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'An agent with this key already exists in this organization',
      });
    }

    const agentId = await ctx.db.insert('agents', {
      organizationId: ctx.orgId,
      agentId: args.agentId,
      name: args.name,
      description: args.description,
      status: 'active',
      model: args.model,
      scopes: args.scopes ?? [],
      createdByUserId: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    const agent = await ctx.db.get(agentId);
    return toAgentView(agent!);
  },
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export const update = createOrgMutation({
  permission: { feature: 'agents', action: 'manage' },
})({
  args: {
    agentId: z.string().min(1).max(60),
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(1000).optional(),
    model: z.string().max(100).optional(),
    scopes: z.array(z.string().min(1).max(100)).max(50).optional(),
  },
  handler: async (ctx, args) => {
    const agent = await findAgentByKey(ctx, ctx.orgId, args.agentId);
    if (!agent) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The agent does not exist in this organization',
      });
    }

    // Only the given fields change, so a caller cannot clear a field by
    // leaving it out.
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.model !== undefined) patch.model = args.model;
    if (args.scopes !== undefined) patch.scopes = args.scopes;

    await ctx.db.patch(agent._id, patch);

    const updated = await ctx.db.get(agent._id);
    return toAgentView(updated!);
  },
});

// ---------------------------------------------------------------------------
// setStatus
// ---------------------------------------------------------------------------

export const setStatus = createOrgMutation({
  permission: { feature: 'agents', action: 'manage' },
})({
  args: {
    agentId: z.string().min(1).max(60),
    status: z.enum(AGENT_STATUSES),
  },
  handler: async (ctx, args) => {
    const agent = await findAgentByKey(ctx, ctx.orgId, args.agentId);
    if (!agent) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The agent does not exist in this organization',
      });
    }

    await ctx.db.patch(agent._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(agent._id);
    return toAgentView(updated!);
  },
});
