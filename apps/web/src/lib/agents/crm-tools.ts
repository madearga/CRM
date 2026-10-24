import { Type } from '@earendil-works/pi-ai';
import {
  defineTool,
  type JsonObject,
  type ToolRegistration,
} from '@earendil-works/pi-durable';

import type { CrmQueryInput, CrmReader } from './crm-access';

/**
 * The `query_crm` tool: a read-only lookup into the CRM of the person who
 * typed in the room.
 *
 * The tool only runs whitelisted public queries, and every query runs with
 * that person's session, so the agent never reads more than the person may.
 * There is no write path here: changes go through `propose_operation` and
 * the human approval.
 */

const QUERY_PARAMETERS = Type.Object({
  resource: Type.Union([
    Type.Literal('deals'),
    Type.Literal('contacts'),
    Type.Literal('companies'),
    Type.Literal('activities'),
  ]),
  search: Type.Optional(Type.String()),
  stage: Type.Optional(
    Type.Union([
      Type.Literal('new'),
      Type.Literal('contacted'),
      Type.Literal('proposal'),
      Type.Literal('won'),
      Type.Literal('lost'),
    ])
  ),
  limit: Type.Optional(Type.Number()),
});

export type QueryCrmTool = ToolRegistration<
  typeof QUERY_PARAMETERS,
  JsonObject
>;

export function createQueryCrmTool(reader: CrmReader): QueryCrmTool {
  return defineTool<typeof QUERY_PARAMETERS, JsonObject>({
    name: 'query_crm',
    description:
      'Look up CRM data for the person: deals, contacts, companies, or recent activities. Read-only.',
    parameters: QUERY_PARAMETERS,
    async execute(args) {
      const input: CrmQueryInput = {
        resource: args.resource,
        ...(args.search === undefined ? {} : { search: args.search }),
        ...(args.stage === undefined ? {} : { stage: args.stage }),
        ...(args.limit === undefined ? {} : { limit: args.limit }),
      };

      try {
        const text = await reader.query(input);
        return {
          output: [{ type: 'text', text: text.slice(0, 4000) }],
          details: { resource: args.resource } as JsonObject,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'The lookup failed';
        return {
          output: [
            { type: 'text', text: `The lookup failed: ${message.slice(0, 200)}` },
          ],
          details: { resource: args.resource, failed: true } as JsonObject,
        };
      }
    },
  });
}
