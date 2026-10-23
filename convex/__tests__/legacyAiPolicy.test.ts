import { describe, expect, it, vi } from 'vitest';
import { executeTool } from '../aiTools/executor';
import { toOpenAITools } from '../aiTools/definitions';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

function context() {
  const runMutation = vi.fn();
  const runQuery = vi.fn().mockResolvedValue([]);
  return {
    runMutation,
    runQuery,
    exec: {
      ctx: { runMutation, runQuery } as unknown as ActionCtx,
      orgId: 'test-organization' as Id<'organization'>,
      userId: 'test-user' as Id<'user'>,
    },
  };
}

describe('legacy AI chat cannot bypass the approval ledger', () => {
  for (const name of [
    'createActivity',
    'updateDealStage',
    'approveCorrection',
  ]) {
    it(`blocks ${name} before invoking any business mutation`, async () => {
      const f = context();
      const result = await executeTool(name, {}, f.exec);
      expect(result).toMatchObject({
        error: expect.stringMatching(/approval/i),
      });
      expect(f.runMutation).not.toHaveBeenCalled();
    });
  }

  it('still lets the legacy assistant read the CRM', async () => {
    const f = context();
    expect(await executeTool('listDeals', {}, f.exec)).toEqual([]);
    expect(f.runQuery).toHaveBeenCalledOnce();
    expect(f.runMutation).not.toHaveBeenCalled();
  });

  it('does not advertise mutating tools to the legacy model', () => {
    const names = toOpenAITools().map((tool) =>
      'function' in tool ? tool.function.name : ''
    );
    expect(names).toContain('listDeals');
    expect(names).not.toContain('createActivity');
    expect(names).not.toContain('updateDealStage');
    expect(names).not.toContain('approveCorrection');
  });
});
