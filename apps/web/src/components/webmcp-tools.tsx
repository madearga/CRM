'use client';

import { useConvex, useConvexAuth } from 'convex/react';
import { useWebMCP } from 'use-webmcp-tool';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { isValidTransition, stableStringify } from '@crm/domain';
import { api } from '@convex/_generated/api';
import { inputs, type ToolName } from '@/lib/webmcp/inputs';
import { resolveDate } from '../../../../packages/domain/src/webmcp-date';
import spec from '../../../../docs/webmcp/schema.json';

const paths = {
  company: 'companies',
  contact: 'contacts',
  deal: 'deals',
  invoices: 'invoices',
};

function assertSafeNavigation() {
  const editing = [
    ...document.querySelectorAll('input, textarea, select'),
  ].some((element) => {
    if (element instanceof HTMLInputElement)
      return element.type === 'checkbox' || element.type === 'radio'
        ? element.checked !== element.defaultChecked
        : element.value !== element.defaultValue;
    if (element instanceof HTMLTextAreaElement)
      return element.value !== element.defaultValue;
    if (element instanceof HTMLSelectElement)
      return [...element.options].some(
        (option) => option.selected !== option.defaultSelected
      );
    return false;
  });
  if (
    editing ||
    document.querySelector(
      '[role="dialog"], [contenteditable="true"], [data-unsaved-changes="true"]'
    )
  ) {
    throw new Error('Save or close the open form before navigating.');
  }
}

export function WebMCPTools() {
  const { isAuthenticated } = useConvexAuth();
  return spec.tools.map((tool) => (
    <RegisteredTool key={tool.name} tool={tool} enabled={isAuthenticated} />
  ));
}

function RegisteredTool({
  tool,
  enabled,
}: {
  tool: (typeof spec.tools)[number];
  enabled: boolean;
}) {
  const convex = useConvex();
  const router = useRouter();
  const auth = useConvexAuth();
  const proposalKeys = useRef(new Map<string, string>());
  const name = tool.name as ToolName;
  useWebMCP<unknown, unknown>({
    ...tool,
    enabled,
    async execute(raw, { signal }) {
      if (!auth.isAuthenticated)
        throw new Error('Sign in to Ruang before using CRM tools.');
      signal.throwIfAborted();
      const args = inputs[name].safeParse(raw);
      if (!args.success)
        throw new Error(
          `Invalid input: ${args.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`
        );
      const result = await execute(name, raw, signal);
      if (JSON.stringify(result).length > 1500)
        throw new Error(
          'Result exceeds the tool budget. Use a smaller page or open the record in the app.'
        );
      return result;
    },
  });

  async function execute(
    name: ToolName,
    raw: unknown,
    signal: AbortSignal
  ): Promise<unknown> {
    // Convex calls are not abortable; check before dispatch. Never replay a cancelled proposal.
    switch (name) {
      case 'search_records':
        return convex.query(
          api.webmcp.searchRecords,
          inputs.search_records.parse(raw)
        );
      case 'get_record':
        return convex.query(api.webmcp.getRecord, inputs.get_record.parse(raw));
      case 'pipeline_overview':
        return convex.query(
          api.webmcp.pipelineOverview,
          inputs.pipeline_overview.parse(raw)
        );
      case 'list_activities':
        return convex.query(
          api.webmcp.listActivities,
          inputs.list_activities.parse(raw)
        );
      case 'list_invoices':
        return convex.query(
          api.webmcp.listInvoices,
          inputs.list_invoices.parse(raw)
        );
      case 'open_record': {
        const args = inputs.open_record.parse(raw);
        assertSafeNavigation();
        const url = `/${paths[args.entity]}${args.id ? `/${encodeURIComponent(args.id)}` : ''}`;
        signal.throwIfAborted();
        router.push(url);
        await new Promise<void>((resolve, reject) => {
          const started = Date.now();
          const check = () => {
            if (signal.aborted)
              return reject(
                new Error(
                  'Navigation wait cancelled. Check the current page before retrying.'
                )
              );
            if (Date.now() - started > 10000)
              return reject(
                new Error(
                  'Navigation did not finish. Check the current page before retrying.'
                )
              );
            if (
              window.location.pathname === url &&
              !document.querySelector('[aria-busy="true"]')
            ) {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve())
              );
            } else setTimeout(check, 50);
          };
          check();
        });
        return { status: 'opened', path: url };
      }
      case 'propose_activity': {
        const args = inputs.propose_activity.parse(raw);
        return propose('create_activity', {
          type: args.type,
          title: args.title,
          entityType: args.entity,
          entityId: args.entity_id,
          ...(args.note !== undefined ? { description: args.note } : {}),
          ...(args.scheduled_at
            ? { dueAt: resolveDate(args.scheduled_at) }
            : {}),
        });
      }
      case 'propose_deal_stage': {
        const args = inputs.propose_deal_stage.parse(raw);
        if (args.stage === 'lost' && !args.lost_reason?.trim())
          throw new Error('Ask for the reason before marking a deal lost.');
        const deal = await convex.query(api.webmcp.getRecord, {
          entity: 'deal',
          id: args.deal_id,
        });
        if (
          !isValidTransition(
            inputs.propose_deal_stage.shape.stage.parse(deal.stage),
            args.stage
          )
        )
          throw new Error(
            'This stage transition is not allowed. Read the current deal and ask for a valid target stage.'
          );
        signal.throwIfAborted();
        return propose('update_deal_stage', {
          id: args.deal_id,
          stage: args.stage,
          ...(args.lost_reason ? { lostReason: args.lost_reason } : {}),
        });
      }
      case 'propose_company': {
        const args = inputs.propose_company.parse(raw);
        return propose('create_company', {
          name: args.name,
          ...(args.domain ? { website: `https://${args.domain}` } : {}),
          ...(args.industry ? { industry: args.industry } : {}),
          ...(args.location ? { address: args.location } : {}),
        });
      }
      case 'propose_widget': {
        const args = inputs.propose_widget.parse(raw);
        return propose('create_widget', {
          type: args.type,
          title: args.title,
          source: args.source,
        });
      }
      case 'propose_deal': {
        const args = inputs.propose_deal.parse(raw);
        return propose('create_deal', {
          title: args.title,
          ...(args.company_id ? { companyId: args.company_id } : {}),
          ...(args.value !== undefined ? { value: args.value } : {}),
          ...(args.currency ? { currency: args.currency } : {}),
          ...(args.close_date
            ? { expectedCloseDate: resolveDate(args.close_date) }
            : {}),
        });
      }
    }
  }

  async function propose(
    kind:
      | 'create_activity'
      | 'update_deal_stage'
      | 'create_company'
      | 'create_deal'
      | 'create_widget',
    payload: Record<string, unknown>
  ) {
    // shortcut: identical proposals reuse one operation for this mounted tab; reload for a deliberate repeat.
    const fingerprint = stableStringify({ kind, payload });
    const key =
      proposalKeys.current.get(fingerprint) ?? `webmcp:${crypto.randomUUID()}`;
    proposalKeys.current.set(fingerprint, key);
    const result = await convex.mutation(api.agentOperations.propose, {
      kind,
      payload,
      idempotencyKey: key,
      requiresApproval: true,
    });
    return {
      status: result.status,
      operation_id: result.id,
      approval_path: '/approvals',
      hint: 'Review this operation in the app. Only a person can approve and execute it. An identical request in this tab reuses the same operation.',
    };
  }
  return null;
}
