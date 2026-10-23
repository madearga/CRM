// The security rules of the rooms module.
//
// The tests call the real internal mutations in memory with convex-test. The
// rules that are checked here:
// - A message of a person needs the write access of that person.
// - A message of an agent needs a real agent of the organization, an active
//   agent, a membership in the room and the right to write there.
// - A message without an agent is only a system message of a real operation
//   of that room.
import { describe, it, expect } from 'vitest';

import { internal } from '../_generated/api';
import { requireOrganizationMember } from '../roomAccess';
import { createTest, refusal, seed, seedOperation } from './roomTestApp';

describe('the membership of a person in an organization', () => {
  it('accepts a person of the organization', async () => {
    const t = createTest();
    const data = await seed(t);

    await t.run(async (ctx: any) =>
      requireOrganizationMember(ctx, data.organizationId, data.memberUserId)
    );
  });

  it('refuses a person of another organization', async () => {
    const t = createTest();
    const data = await seed(t);

    const error = await refusal(
      t.run(async (ctx: any) =>
        requireOrganizationMember(ctx, data.organizationId, data.foreignUserId)
      )
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });
});

describe('postFromUser', () => {
  it('writes a message for a member of an open room', async () => {
    const t = createTest();
    const data = await seed(t);

    const result = await t.mutation(internal.rooms.postFromUser, {
      organizationId: data.organizationId,
      roomId: data.roomId,
      userId: data.memberUserId,
      text: 'The plan is ready',
    });

    expect(result.kind).toBe('message');
    expect(result.authorUserId).toBe(data.memberUserId);
  });

  it('writes a message for a person of the organization that is not a member of an open room', async () => {
    const t = createTest();
    const data = await seed(t, { userMember: false });

    const result = await t.mutation(internal.rooms.postFromUser, {
      organizationId: data.organizationId,
      roomId: data.roomId,
      userId: data.memberUserId,
      text: 'The plan is ready',
    });

    expect(result.id).toBeTruthy();
  });

  it('refuses a person of another organization', async () => {
    const t = createTest();
    const data = await seed(t);

    const error = await refusal(
      t.mutation(internal.rooms.postFromUser, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        userId: data.foreignUserId,
        text: 'A message from the outside',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a person that is not a member of a private room', async () => {
    const t = createTest();
    const data = await seed(t, { visibility: 'private', userMember: false });

    const error = await refusal(
      t.mutation(internal.rooms.postFromUser, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        userId: data.memberUserId,
        text: 'A message into a private room',
      })
    );

    expect(error.data.code).toBe('NOT_FOUND');
  });

  it('refuses an observer of a private room', async () => {
    const t = createTest();
    const data = await seed(t, { visibility: 'private', memberRole: 'observer' });

    const error = await refusal(
      t.mutation(internal.rooms.postFromUser, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        userId: data.memberUserId,
        text: 'A message of an observer',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a member whose scopes do not grant the write', async () => {
    const t = createTest();
    const data = await seed(t, { memberScopes: ['read'] });

    const error = await refusal(
      t.mutation(internal.rooms.postFromUser, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        userId: data.memberUserId,
        text: 'A message of a reader',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a message into an archived room', async () => {
    const t = createTest();
    const data = await seed(t, { archived: true });

    const error = await refusal(
      t.mutation(internal.rooms.postFromUser, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        userId: data.memberUserId,
        text: 'A message into history',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a room of another organization', async () => {
    const t = createTest();
    const data = await seed(t);

    const error = await refusal(
      t.mutation(internal.rooms.postFromUser, {
        organizationId: data.otherOrganizationId,
        roomId: data.roomId,
        userId: data.memberUserId,
        text: 'A message across the border',
      })
    );

    expect(error.data.code).toBe('NOT_FOUND');
  });
});

describe('postFromAgent', () => {
  it('writes a message for an agent that is a member of the room', async () => {
    const t = createTest();
    const data = await seed(t, { agentScopes: ['write'] });

    const result = await t.mutation(internal.rooms.postFromAgent, {
      organizationId: data.organizationId,
      roomId: data.roomId,
      agentId: data.agentKey,
      text: 'The work is done',
    });

    expect(result.authorType).toBe('agent');
    expect(result.authorAgentId).toBe(data.agentKey);
  });

  it('refuses an agent that is not a member of the room', async () => {
    const t = createTest();
    const data = await seed(t, { agentMember: false, agentScopes: ['write'] });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a disabled agent', async () => {
    const t = createTest();
    const data = await seed(t, { agentStatus: 'disabled', agentScopes: ['write'] });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses an agent that does not exist in the organization', async () => {
    const t = createTest();
    const data = await seed(t, { agentScopes: ['write'] });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: 'agent-from-another-organization',
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('NOT_FOUND');
  });

  it('refuses an agent whose membership narrows the write away', async () => {
    const t = createTest();
    const data = await seed(t, {
      agentScopes: ['write', 'read'],
      agentMemberScopes: ['read'],
    });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses an agent whose membership is an observer', async () => {
    const t = createTest();
    const data = await seed(t, {
      agentScopes: ['write'],
      agentMemberRole: 'observer',
    });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a membership that grants more than the agent has', async () => {
    const t = createTest();
    const data = await seed(t, {
      agentScopes: ['read'],
      agentMemberScopes: ['write'],
    });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses an agent that has no scope of its own', async () => {
    const t = createTest();
    const data = await seed(t, {
      agentScopes: [],
      agentMemberScopes: ['write'],
    });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses an agent whose scope names another resource', async () => {
    const t = createTest();
    const data = await seed(t, {
      agentScopes: ['inventory:write'],
    });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('writes for an agent whose scope names the room', async () => {
    const t = createTest();
    const data = await seed(t, {
      agentScopes: ['rooms:write'],
    });

    const result = await t.mutation(internal.rooms.postFromAgent, {
      organizationId: data.organizationId,
      roomId: data.roomId,
      agentId: data.agentKey,
      text: 'The work is done',
    });

    expect(result.id).toBeTruthy();
  });

  it('allows an agent whose membership keeps the write of the agent', async () => {
    const t = createTest();
    const data = await seed(t, {
      agentScopes: ['write', 'read'],
      agentMemberScopes: ['write'],
    });

    const result = await t.mutation(internal.rooms.postFromAgent, {
      organizationId: data.organizationId,
      roomId: data.roomId,
      agentId: data.agentKey,
      text: 'The work is done',
    });

    expect(result.id).toBeTruthy();
  });

  it('refuses a proposal without an agent', async () => {
    const t = createTest();
    const data = await seed(t);

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        kind: 'proposal',
        text: 'A proposal of a person',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a message without an agent and without an operation', async () => {
    const t = createTest();
    const data = await seed(t);

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        kind: 'system',
        text: 'A system note of nothing',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('writes a system message for an operation of the room', async () => {
    const t = createTest();
    const data = await seed(t);
    const operationId = await seedOperation(t, {
      organizationId: data.organizationId,
      roomId: data.roomId,
      requestedByUserId: data.memberUserId,
    });

    const result = await t.mutation(internal.rooms.postFromAgent, {
      organizationId: data.organizationId,
      roomId: data.roomId,
      kind: 'system',
      operationId,
      text: 'The operation moved on',
    });

    expect(result.authorType).toBe('system');
    expect(result.operationId).toBe(operationId);
  });

  it('refuses a system message for an operation of another room', async () => {
    const t = createTest();
    const data = await seed(t);
    const otherRoomId = await t.run(async (ctx: any) =>
      ctx.db.insert('rooms', {
        organizationId: data.organizationId,
        name: 'Other room',
        slug: 'other-room',
        kind: 'project',
        visibility: 'open',
        createdByUserId: data.memberUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    const operationId = await seedOperation(t, {
      organizationId: data.organizationId,
      roomId: otherRoomId,
      requestedByUserId: data.memberUserId,
    });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        kind: 'system',
        operationId,
        text: 'The operation moved on',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });

  it('refuses a message into an archived room', async () => {
    const t = createTest();
    const data = await seed(t, { archived: true, agentScopes: ['write'] });

    const error = await refusal(
      t.mutation(internal.rooms.postFromAgent, {
        organizationId: data.organizationId,
        roomId: data.roomId,
        agentId: data.agentKey,
        text: 'The work is done',
      })
    );

    expect(error.data.code).toBe('FORBIDDEN');
  });
});
