import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebMCPTools } from '@/components/webmcp-tools';
import spec from '../../../../docs/webmcp/schema.json';
import { inputs } from '@/lib/webmcp/inputs';
import { resolveDate } from '../../../../packages/domain/src/webmcp-date';

const state = vi.hoisted(() => ({
  authenticated: true,
  query: vi.fn(),
  mutation: vi.fn(),
  push: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useConvex: () => state,
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
const register = vi.fn();
function captured(name: string) {
  const call = register.mock.calls.find(([tool]) => tool.name === name);
  if (!call) throw new Error(`Tool not registered: ${name}`);
  return call[0];
}
const run = (
  name: string,
  args: unknown,
  signal = new AbortController().signal
) => captured(name).execute(args, { signal });

beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated = true;
  state.query.mockResolvedValue({ items: [] });
  state.mutation.mockResolvedValue({
    id: 'operation1',
    status: 'awaiting_approval',
  });
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: { registerTool: register },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'modelContext');
});

describe('WebMCP registration and execution', () => {
  it('registers the ten documented tools and unregisters on unmount', () => {
    const view = render(<WebMCPTools />);
    expect(register).toHaveBeenCalledTimes(10);
    for (const tool of spec.tools)
      expect(captured(tool.name).inputSchema).toEqual(tool.inputSchema);
    const signals = register.mock.calls.map(([, options]) => options.signal);
    view.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
  it('exposes no tools to signed-out sessions or unsupported browsers', () => {
    state.authenticated = false;
    const view = render(<WebMCPTools />);
    expect(register).not.toHaveBeenCalled();
    view.unmount();
    Reflect.deleteProperty(document, 'modelContext');
    state.authenticated = true;
    expect(() => render(<WebMCPTools />)).not.toThrow();
  });
  it('calls the read adapter with validated arguments', async () => {
    render(<WebMCPTools />);
    const result = await run('search_records', {
      entity: 'company',
      query: 'Nusantara',
    });
    expect(result.isError).not.toBe(true);
    expect(state.query).toHaveBeenCalledWith(expect.anything(), {
      entity: 'company',
      query: 'Nusantara',
    });
  });
  it('rejects identity injection and invalid limits before any query', async () => {
    render(<WebMCPTools />);
    for (const args of [
      { entity: 'company', query: 'x', userId: 'other' },
      { entity: 'company', query: 'x', limit: 100 },
    ]) {
      expect((await run('search_records', args)).isError).toBe(true);
    }
    expect(state.query).not.toHaveBeenCalled();
  });
  it('maps activity fields and only records an approval proposal', async () => {
    render(<WebMCPTools />);
    const result = await run('propose_activity', {
      entity: 'company',
      entity_id: 'c1',
      type: 'call',
      title: 'Pricing',
      note: 'Call completed',
      scheduled_at: 'Friday',
    });
    expect(result.isError).not.toBe(true);
    expect(state.mutation).toHaveBeenCalledTimes(1);
    expect(state.mutation.mock.calls[0][1]).toMatchObject({
      kind: 'create_activity',
      requiresApproval: true,
      payload: {
        entityType: 'company',
        entityId: 'c1',
        description: 'Call completed',
        dueAt: expect.any(Number),
      },
    });
    expect(result.content[0].text).toContain('awaiting_approval');
  });
  it('maps company and deal creation without caller identity', async () => {
    render(<WebMCPTools />);
    await run('propose_company', {
      name: 'Sinar',
      domain: 'sinar.id',
      location: 'Jakarta',
    });
    expect(state.mutation.mock.calls[0][1]).toMatchObject({
      kind: 'create_company',
      payload: {
        name: 'Sinar',
        website: 'https://sinar.id',
        address: 'Jakarta',
      },
    });
    await run('propose_deal', {
      title: 'Audit',
      company_id: 'c1',
      value: 40000000,
      currency: 'IDR',
    });
    expect(state.mutation.mock.calls[1][1]).toMatchObject({
      kind: 'create_deal',
      payload: {
        title: 'Audit',
        companyId: 'c1',
        value: 40000000,
        currency: 'IDR',
      },
    });
  });
  it('reuses the same proposal key after an ambiguous network failure', async () => {
    render(<WebMCPTools />);
    state.mutation.mockRejectedValueOnce(
      new Error('Connection lost after dispatch.')
    );
    expect((await run('propose_company', { name: 'Sinar' })).isError).toBe(
      true
    );
    await run('propose_company', { name: 'Sinar' });
    expect(state.mutation.mock.calls[0][1].idempotencyKey).toBe(
      state.mutation.mock.calls[1][1].idempotencyKey
    );
  });
  it('checks a stage change and asks for a loss reason before proposing', async () => {
    render(<WebMCPTools />);
    expect(
      (await run('propose_deal_stage', { deal_id: 'd1', stage: 'lost' }))
        .isError
    ).toBe(true);
    state.query.mockResolvedValueOnce({ stage: 'won' });
    expect(
      (await run('propose_deal_stage', { deal_id: 'd1', stage: 'proposal' }))
        .isError
    ).toBe(true);
    expect(state.mutation).not.toHaveBeenCalled();
    state.query.mockResolvedValueOnce({ stage: 'contacted' });
    expect(
      (await run('propose_deal_stage', { deal_id: 'd1', stage: 'proposal' }))
        .isError
    ).not.toBe(true);
    expect(state.mutation.mock.calls[0][1]).toMatchObject({
      kind: 'update_deal_stage',
      payload: { id: 'd1', stage: 'proposal' },
    });
  });
  it('rejects malformed website domains', async () => {
    render(<WebMCPTools />);
    expect(
      (await run('propose_company', { name: 'Sinar', domain: '..example.com' }))
        .isError
    ).toBe(true);
    expect(state.mutation).not.toHaveBeenCalled();
  });
  it('blocks cancelled calls and expired sessions before dispatch', async () => {
    const view = render(<WebMCPTools />);
    const controller = new AbortController();
    controller.abort();
    expect(
      (await run('get_record', { entity: 'deal', id: 'd1' }, controller.signal))
        .isError
    ).toBe(true);
    const oldTool = captured('propose_company');
    state.authenticated = false;
    view.rerender(<WebMCPTools />);
    expect(
      (
        await oldTool.execute(
          { name: 'Sinar' },
          { signal: new AbortController().signal }
        )
      ).isError
    ).toBe(true);
    expect(state.query).not.toHaveBeenCalled();
    expect(state.mutation).not.toHaveBeenCalled();
  });
  it('reports backend failures and oversize output as errors without truncation', async () => {
    render(<WebMCPTools />);
    state.query.mockRejectedValueOnce(new Error('Permission denied.'));
    expect(
      (await run('get_record', { entity: 'deal', id: 'd1' })).isError
    ).toBe(true);
    state.query.mockResolvedValueOnce({ title: 'x'.repeat(1501) });
    expect(
      (await run('get_record', { entity: 'deal', id: 'd1' })).isError
    ).toBe(true);
  });
  it('preserves unsaved forms instead of navigating', async () => {
    render(
      <>
        <textarea aria-label="Draft" defaultValue="Original" />
        <WebMCPTools />
      </>
    );
    document.querySelector('textarea')!.value = 'Unsaved';
    const result = await run('open_record', { entity: 'company', id: 'c1' });
    expect(result.isError).toBe(true);
    expect(state.push).not.toHaveBeenCalled();
  });
  it('keeps schema names and argument budgets valid', () => {
    expect(spec.tools.map((tool) => tool.name).sort()).toEqual(
      Object.keys(inputs).sort()
    );
    for (const tool of spec.tools) {
      expect(tool.name.length).toBeLessThanOrEqual(30);
      expect(tool.description.length).toBeLessThanOrEqual(500);
      for (const [name, parameter] of Object.entries(
        tool.inputSchema.properties
      )) {
        expect(name.length).toBeLessThanOrEqual(30);
        expect(parameter.description.length).toBeLessThanOrEqual(150);
      }
    }
  });
});

describe('raw date phrases', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  it('resolves quarter, weekdays and ISO dates without model arithmetic', () => {
    expect(resolveDate('this quarter', now)).toBe(
      Date.parse('2026-10-01T00:00:00Z')
    );
    expect(resolveDate('Friday', now)).toBe(Date.parse('2026-10-30T00:00:00Z'));
    expect(resolveDate('2026-12-31', now)).toBe(
      Date.parse('2026-12-31T00:00:00Z')
    );
  });
  it('rejects invalid dates and unsupported phrases instead of guessing', () => {
    expect(() => resolveDate('2026-02-30', now)).toThrow();
    expect(() => resolveDate('sometime next month', now)).toThrow();
  });
});
