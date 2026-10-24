import { fetchQuery } from 'convex/nextjs';

import { api } from '@convex/_generated/api';

/**
 * Read access to the CRM data for one agent turn.
 *
 * Every read runs with the session token of the person who typed in the
 * room, so the agent sees exactly what that person may see: an owner sees
 * everything, a member only their permitted slice. The reads are public
 * org-scoped queries, so the permission work stays in Convex.
 */

export type CrmReader = {
  /** A compact prompt block of the current CRM state. */
  buildContextPack: () => Promise<string>;
  /** Run one whitelisted read. The agent calls this through a tool. */
  query: (input: CrmQueryInput) => Promise<string>;
};

export type DealStageName = 'new' | 'contacted' | 'proposal' | 'won' | 'lost';

export type CrmQueryInput = {
  resource: 'deals' | 'contacts' | 'companies' | 'activities';
  search?: string;
  stage?: DealStageName;
  limit?: number;
};

const PAGE_SIZE = 10;

function shortDate(value: number | undefined): string {
  if (typeof value !== 'number') return '?';
  return new Date(value).toISOString().slice(0, 10);
}

function money(value: number | undefined): string {
  if (typeof value !== 'number') return '-';
  return `${Math.round(value).toLocaleString('id-ID')}`;
}

export function createCrmReader(token: string): CrmReader {
  async function buildContextPack(): Promise<string> {
    const parts: string[] = [];

    try {
      const overview = await fetchQuery(api.dashboard.overview, {}, { token });
      if (overview) {
        const stages = overview.dealsByStage
          .map((s) => `${s.stage}:${s.count} (${money(s.value)})`)
          .join(', ');
        parts.push(
          `Pipeline: ${overview.pipelineValue ? money(overview.pipelineValue) : '0'} across ${overview.totalDeals} deals. Companies: ${overview.totalCompanies}. Activities: ${overview.totalActivities}.${stages ? ` By stage: ${stages}.` : ''}`
        );
      }
    } catch {
      parts.push('Pipeline overview: not available.');
    }

    try {
      const result = await fetchQuery(
        api.deals.list,
        { paginationOpts: { numItems: 12, cursor: '' } },
        { token }
      );
      const rows = (result?.page ?? []).map(
        (deal: Record<string, unknown>) =>
          `- ${String(deal.title)} [${String(deal.stage)}] value ${money(deal.value as number)} (${shortDate(deal.createdAt as number)})`
      );
      parts.push(rows.length ? `Recent deals:\n${rows.join('\n')}` : 'No deals yet.');
    } catch {
      parts.push('Recent deals: not available.');
    }

    try {
      const result = await fetchQuery(
        api.contacts.list,
        { paginationOpts: { numItems: PAGE_SIZE, cursor: '' } },
        { token }
      );
      const rows = (result?.page ?? []).map((contact: Record<string, unknown>) => {
        const name = String(contact.fullName ?? contact.name ?? '?');
        const email = typeof contact.email === 'string' ? contact.email : '';
        return `- ${name}${email ? ` <${email}>` : ''}`;
      });
      parts.push(rows.length ? `Recent contacts:\n${rows.join('\n')}` : 'No contacts yet.');
    } catch {
      parts.push('Recent contacts: not available.');
    }

    try {
      const recent = await fetchQuery(api.activities.listRecent, {}, { token });
      const rows = (recent ?? []).slice(0, PAGE_SIZE).map(
        (activity) =>
          `- ${String(activity.type)}: ${String(activity.title)} (${shortDate(activity.createdAt)})`
      );
      parts.push(rows.length ? `Recent activities:\n${rows.join('\n')}` : 'No activities yet.');
    } catch {
      parts.push('Recent activities: not available.');
    }

    return parts.join('\n');
  }

  async function query(input: CrmQueryInput): Promise<string> {
    const limit = Math.min(Math.max(input.limit ?? PAGE_SIZE, 1), 25);

    if (input.resource === 'activities') {
      const recent = await fetchQuery(api.activities.listRecent, {}, { token });
      const rows = (recent ?? []).slice(0, limit).map(
        (activity) =>
          `- ${String(activity.type)}: ${String(activity.title)} (${shortDate(activity.createdAt)})`
      );
      return rows.length ? rows.join('\n') : 'No activities found.';
    }

    if (input.resource === 'deals') {
      const result = await fetchQuery(
        api.deals.list,
        {
          ...(input.stage !== undefined ? { stage: input.stage } : {}),
          paginationOpts: { numItems: limit, cursor: '' },
        },
        { token }
      );
      const rows = (result?.page ?? []).map(
        (deal: Record<string, unknown>) =>
          `- ${String(deal.title)} [${String(deal.stage)}] value ${money(deal.value as number)}`
      );
      return rows.length ? rows.join('\n') : 'No deals match.';
    }

    if (input.resource === 'contacts') {
      const result = await fetchQuery(
        api.contacts.list,
        {
          ...(input.search !== undefined && input.search !== ''
            ? { search: input.search }
            : {}),
          paginationOpts: { numItems: limit, cursor: '' },
        },
        { token }
      );
      const rows = (result?.page ?? []).map((contact: Record<string, unknown>) => {
        const name = String(contact.fullName ?? contact.name ?? '?');
        const email = typeof contact.email === 'string' ? ` <${contact.email}>` : '';
        return `- ${name}${email}`;
      });
      return rows.length ? rows.join('\n') : 'No contacts match.';
    }

    const result = await fetchQuery(
      api.companies.list,
      {
        ...(input.search !== undefined && input.search !== ''
          ? { search: input.search }
          : {}),
        paginationOpts: { numItems: limit, cursor: '' },
      },
      { token }
    );
    const rows = (result?.page ?? []).map((company: Record<string, unknown>) => {
      const name = String(company.name ?? '?');
      const industry = typeof company.industry === 'string' ? ` (${company.industry})` : '';
      return `- ${name}${industry}`;
    });
    return rows.length ? rows.join('\n') : 'No companies match.';
  }

  return { buildContextPack, query };
}
