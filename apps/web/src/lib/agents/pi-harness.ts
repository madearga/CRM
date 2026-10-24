/**
 * A typed, minimal Pi Durable harness factory for Ruang.
 *
 * Scope of this factory:
 * - It opens a pi-durable `Harness` on a storage that the caller supplies.
 * - It uses the fixed Pi model of `pi-model.ts`.
 * - It installs one optional tool: `propose_operation`, and only when the
 *   caller supplies its implementation.
 *
 * It installs nothing else. There is no coding tool set, no shell tool, no
 * file system tool, no gateway model, and no tool that runs by itself. The
 * harness is opened without a coding environment. The supplied callback is
 * trusted server code; this tool registry is not an operating-system sandbox.
 *
 * This is a foundation. It is not a durable room runtime. A room runtime also
 * needs a storage that survives a restart, a queue, and a route. The route
 * is blocked: Convex deployment isolation keeps a deployment key inside one
 * deployment, so no public runtime endpoint can be enabled yet.
 */
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Context } from '@earendil-works/chord';
import {
  createRegistry,
  Harness,
  type AgentChange,
  type Harness as PiHarness,
  type HarnessSettings,
  type Registry,
  type Storage,
} from '@earendil-works/pi-durable';
import { createPiModels, PI_MODEL_REF } from './pi-model';
import {
  createProposeOperationTool,
  PROPOSE_OPERATION_EXTENSION_NAME,
  type ProposeOperationHandler,
} from './propose-operation';

/** The extension name of the extra read-only tools. */
export const EXTRA_TOOLS_EXTENSION_NAME = 'ruang.crm';

/** Any tool registration of the harness, independent of its parameter type. */
type RuangTool = NonNullable<
  Parameters<Registry['install']>[0]['tools']
>[number];

/**
 * The in-memory storage of pi-durable.
 *
 * It is re-exported for local smoke tests. It keeps nothing after the
 * process ends.
 */
export { MemoryStorage } from '@earendil-works/pi-durable';

/** The storage interface of pi-durable. */
export type { Storage } from '@earendil-works/pi-durable';

/** The context that never cancels. */
export { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';

/** The context type of chord. */
export type { Context } from '@earendil-works/chord';

/** The options of the harness factory. */
export interface PiHarnessOptions {
  /** The storage the harness commits to. The caller owns it. */
  readonly storage: Storage;
  /**
   * The implementation of `propose_operation`. Without it, the harness has
   * no tools at all.
   */
  readonly proposeOperation?: ProposeOperationHandler;
  /** Extra read-only tools, for example the CRM lookup tool. */
  readonly extraTools?: readonly RuangTool[];
  /** The clock of the harness. Every process on one storage must use it. */
  readonly now?: () => number;
  /**
   * The settings of the harness. They hold the timeout of the model call,
   * so a call that hangs is aborted.
   */
  readonly settings?: HarnessSettings;
  /** The context of the calls. The default never cancels. */
  readonly context?: Context;
}

/**
 * The agent choices of the Pi agent.
 *
 * The model is fixed. The tools are not named here, so the registry decides
 * which tools the conversation gets.
 */
export const PI_AGENT: AgentChange = {
  model: { provider: PI_MODEL_REF.provider, modelId: PI_MODEL_REF.modelId },
};

/**
 * Build the registry of the Pi agent.
 *
 * The registry holds the built-in tasks only. It holds the
 * `propose_operation` tool when an implementation is supplied.
 */
export function createPiRegistry(
  proposeOperation?: ProposeOperationHandler,
  extraTools?: readonly RuangTool[]
): Registry {
  const registry = createRegistry();
  if (proposeOperation !== undefined) {
    registry.install({
      name: PROPOSE_OPERATION_EXTENSION_NAME,
      tools: [createProposeOperationTool(proposeOperation)],
    });
  }
  if (extraTools !== undefined && extraTools.length > 0) {
    registry.install({ name: EXTRA_TOOLS_EXTENSION_NAME, tools: [...extraTools] });
  }
  return registry;
}

/**
 * Open a Pi Durable harness.
 *
 * The call needs no credential. It calls no model. It runs no tool.
 */
export async function openPiHarness(
  options: PiHarnessOptions
): Promise<PiHarness> {
  const context = options.context ?? BACKGROUND_CONTEXT;
  const registry = createPiRegistry(options.proposeOperation, options.extraTools);
  const models = createPiModels();
  return Harness.open(
    options.storage,
    {
      models,
      registry,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.settings === undefined ? {} : { settings: options.settings }),
    },
    context
  );
}
