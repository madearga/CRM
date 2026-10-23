/**
 * The narrow `propose_operation` tool of the Pi agent.
 *
 * The tool records a proposal. It does not change data. The caller supplies
 * the implementation, so the app decides what a proposal means and what
 * happens with it.
 *
 * Safety rules of this module:
 * - The tool name is fixed. The extension name is fixed.
 * - No shell or file tool is installed. The supplied handler is trusted
 *   application code, not sandboxed code.
 * - The tool is not replay safe. An interrupted call is not run again.
 * - The schema takes an operation name, an optional reason, and an optional
 *   JSON payload.
 */
import { Type } from '@earendil-works/pi-ai';
import {
  defineTool,
  type JsonObject,
  type ToolRegistration,
} from '@earendil-works/pi-durable';

/** The tool name the model sees. */
export const PROPOSE_OPERATION_TOOL_NAME = 'propose_operation';

/** The extension name that holds the tool in a registry. */
export const PROPOSE_OPERATION_EXTENSION_NAME = 'ruang.propose_operation';

/** One proposal, as the model sends it. */
export type ProposeOperationProposal = {
  readonly operation: string;
  readonly reason?: string;
  readonly payload?: JsonObject;
};

/** The answer of the supplied implementation. */
export type ProposeOperationOutcome = {
  readonly accepted: boolean;
  readonly summary: string;
  readonly operationId?: string;
};

/**
 * The implementation the app supplies.
 *
 * It receives the proposal and returns the outcome. It may record a proposal
 * and its approval request, but it must not execute a business effect.
 */
export type ProposeOperationHandler = (
  proposal: ProposeOperationProposal
) => Promise<ProposeOperationOutcome> | ProposeOperationOutcome;

const PROPOSE_OPERATION_PARAMETERS = Type.Object({
  operation: Type.String({ minLength: 1 }),
  reason: Type.Optional(Type.String()),
  payload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

/** The typed tool of this module. */
export type ProposeOperationTool = ToolRegistration<
  typeof PROPOSE_OPERATION_PARAMETERS,
  JsonObject
>;

/**
 * Build the `propose_operation` tool around a supplied implementation.
 *
 * The tool forwards the proposal to the handler. It runs nothing else.
 */
export function createProposeOperationTool(
  handler: ProposeOperationHandler
): ProposeOperationTool {
  return defineTool<typeof PROPOSE_OPERATION_PARAMETERS, JsonObject>({
    name: PROPOSE_OPERATION_TOOL_NAME,
    description:
      'Propose one CRM operation for approval. The tool only records the proposal. It changes no data and runs no command.',
    parameters: PROPOSE_OPERATION_PARAMETERS,
    async execute(args) {
      const proposal: ProposeOperationProposal = {
        operation: args.operation,
        ...(args.reason === undefined ? {} : { reason: args.reason }),
        ...(args.payload === undefined
          ? {}
          : { payload: toJsonObject(args.payload) }),
      };
      const outcome = await handler(proposal);
      const details: JsonObject = {
        accepted: outcome.accepted,
        operation: proposal.operation,
        operationId: outcome.operationId ?? null,
      };
      return { output: [{ type: 'text', text: outcome.summary }], details };
    },
  });
}

/**
 * Turn a plain record into a JSON object.
 *
 * The value comes from the model, so it is JSON already. The round trip
 * removes any value that JSON cannot carry.
 */
function toJsonObject(value: Record<string, unknown>): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}
