/**
 * Tests of the minimal Pi Durable harness factory.
 *
 * The tests need no credential and no network. They open a harness over the
 * in-memory storage of pi-durable. They never submit an input, so no model
 * call happens.
 */
import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_CONTEXT,
  MemoryStorage,
  PI_AGENT,
  createPiRegistry,
  openPiHarness,
} from '../../apps/web/src/lib/agents/pi-harness';
import {
  PROPOSE_OPERATION_TOOL_NAME,
  createProposeOperationTool,
  type ProposeOperationProposal,
} from '../../apps/web/src/lib/agents/propose-operation';
import { resumePiHarness } from '../../apps/web/src/lib/agents/pi-harness-resume';

describe('Pi harness factory', () => {
  it('opens a harness with no tools by default', async () => {
    const registry = createPiRegistry();
    expect(registry.snapshot().tools()).toHaveLength(0);

    const harness = await openPiHarness({ storage: new MemoryStorage() });
    const conversation = await harness.root(BACKGROUND_CONTEXT, {
      agent: PI_AGENT,
    });
    const agent = await conversation.agent(BACKGROUND_CONTEXT);

    expect(agent.model).toEqual({ provider: 'zai', modelId: 'glm-5.3-flash' });
    expect(agent.tools).toHaveLength(0);

    const inspection = await harness.inspect(BACKGROUND_CONTEXT);
    expect(inspection.submissions).toHaveLength(0);
    expect(inspection.tasks).toHaveLength(0);

    await harness.close(BACKGROUND_CONTEXT);
  });

  it('installs only the supplied propose_operation tool', () => {
    const registry = createPiRegistry(() => ({
      accepted: true,
      summary: 'recorded',
    }));
    const tools = registry.snapshot().tools();

    expect(tools).toHaveLength(1);
    expect(tools[0]?.tool.name).toBe(PROPOSE_OPERATION_TOOL_NAME);
  });

  it('forwards a proposal to the supplied implementation', async () => {
    const seen: ProposeOperationProposal[] = [];
    const tool = createProposeOperationTool((proposal) => {
      seen.push(proposal);
      return { accepted: true, summary: 'recorded', operationId: 'op_1' };
    });

    const result = await tool.execute(
      {
        operation: 'create_deal',
        reason: 'from the call',
        payload: { title: 'Q1' },
      },
      {} as never,
      BACKGROUND_CONTEXT
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.operation).toBe('create_deal');
    expect(seen[0]?.reason).toBe('from the call');
    expect(seen[0]?.payload).toEqual({ title: 'Q1' });
    expect(result.output).toEqual([{ type: 'text', text: 'recorded' }]);
    expect(result.details).toEqual({
      accepted: true,
      operation: 'create_deal',
      operationId: 'op_1',
    });
  });

  it('keeps the resume opener usable with a local storage', async () => {
    const opener = resumePiHarness({});
    const harness = await opener(new MemoryStorage());

    expect(harness).toBeDefined();

    await harness.close(BACKGROUND_CONTEXT);
  });
});
