// The scope rules of a room member.
//
// The scopes of a membership can only narrow the scopes of an agent, never
// widen them. These tests cover that rule on its own.
import { describe, it, expect } from 'vitest';

import {
  agentCanPerform,
  agentCanPerformFor,
  narrowAgentScopes,
  scopeAction,
  scopeFits,
  scopeResource,
  scopesGrantRoomWrite,
} from '@crm/domain';

describe('scopeAction', () => {
  it('reads the action of a plain scope', () => {
    expect(scopeAction('write')).toBe('write');
  });

  it('reads the action of a scope with a resource', () => {
    expect(scopeAction('inventory:write')).toBe('write');
  });

  it('has no action for an empty scope', () => {
    expect(scopeAction('')).toBeNull();
  });

  it('has no action for a bare resource name', () => {
    expect(scopeAction('inventory')).toBeNull();
  });
});

describe('scopeResource', () => {
  it('has no resource for a plain scope', () => {
    expect(scopeResource('write')).toBeNull();
  });

  it('reads the resource of a scope with a resource', () => {
    expect(scopeResource('inventory:write')).toBe('inventory');
  });
});

describe('scopeFits', () => {
  it('lets a plain scope fit a plain scope of the same action', () => {
    expect(scopeFits(['write'], 'write')).toBe(true);
  });

  it('lets a scope with a resource fit a plain scope of the same action', () => {
    expect(scopeFits(['write'], 'inventory:write')).toBe(true);
  });

  it('refuses a scope with a resource for a scope with another resource', () => {
    expect(scopeFits(['inventory:write'], 'invoice:write')).toBe(false);
  });

  it('refuses a plain scope for a scope with a resource', () => {
    expect(scopeFits(['inventory:write'], 'write')).toBe(false);
  });

  it('refuses a scope of another action', () => {
    expect(scopeFits(['read'], 'write')).toBe(false);
  });
});

describe('narrowAgentScopes', () => {
  it('keeps the scopes of the agent when the membership has none', () => {
    expect(narrowAgentScopes(['write', 'read'], [])).toEqual(['write', 'read']);
  });

  it('gives no right at all when the agent has no scopes', () => {
    expect(narrowAgentScopes([], ['write'])).toEqual([]);
  });

  it('keeps only the scopes that the agent also holds', () => {
    expect(narrowAgentScopes(['write', 'read'], ['write'])).toEqual(['write']);
  });

  it('drops a scope that the agent does not hold', () => {
    expect(narrowAgentScopes(['read'], ['write'])).toEqual([]);
  });

  it('drops a scope of another resource', () => {
    expect(narrowAgentScopes(['inventory:write'], ['invoice:write'])).toEqual([]);
  });

  it('keeps a scope with a resource under a plain scope of the agent', () => {
    expect(narrowAgentScopes(['write'], ['inventory:write'])).toEqual([
      'inventory:write',
    ]);
  });
});

describe('agentCanPerform', () => {
  it('gives the action of a plain scope', () => {
    expect(agentCanPerform(['write'], 'write')).toBe(true);
  });

  it('refuses the action of a scope with a resource', () => {
    expect(agentCanPerform(['inventory:write'], 'write')).toBe(false);
  });

  it('refuses the action of a bare resource name', () => {
    expect(agentCanPerform(['inventory'], 'write')).toBe(false);
  });
});

describe('agentCanPerformFor', () => {
  it('gives the action of a plain scope for every resource', () => {
    expect(agentCanPerformFor(['write'], 'write', 'rooms')).toBe(true);
  });

  it('gives the action of a scope with the same resource', () => {
    expect(agentCanPerformFor(['rooms:write'], 'write', 'rooms')).toBe(true);
  });

  it('refuses the action of a scope with another resource', () => {
    expect(agentCanPerformFor(['inventory:write'], 'write', 'rooms')).toBe(
      false
    );
  });
});

describe('scopesGrantRoomWrite', () => {
  it('gives the write for the plain scope', () => {
    expect(scopesGrantRoomWrite(['write'])).toBe(true);
  });

  it('gives the write for the scope of the room', () => {
    expect(scopesGrantRoomWrite(['rooms:write'])).toBe(true);
  });

  it('refuses the write for a scope of another resource', () => {
    expect(scopesGrantRoomWrite(['inventory:write'])).toBe(false);
  });

  it('refuses the write for a scope of reading', () => {
    expect(scopesGrantRoomWrite(['read'])).toBe(false);
  });
});

describe('the narrowed scopes grant the write', () => {
  it('gives the write when the agent and the membership both hold it', () => {
    const scopes = narrowAgentScopes(['write', 'read'], ['write']);
    expect(agentCanPerform(scopes, 'write')).toBe(true);
  });

  it('takes the write away when the membership narrows it away', () => {
    const scopes = narrowAgentScopes(['write', 'read'], ['read']);
    expect(agentCanPerform(scopes, 'write')).toBe(false);
  });

  it('takes the write away when the agent never had it', () => {
    const scopes = narrowAgentScopes(['read'], ['write']);
    expect(agentCanPerform(scopes, 'write')).toBe(false);
  });
});
