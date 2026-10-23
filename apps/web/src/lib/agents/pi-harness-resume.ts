/**
 * The resume path of the Pi agent.
 *
 * `durable-harness` reopens a session after a crash. It calls an opener with
 * the session storage. This module builds that opener from the harness
 * factory of `pi-harness.ts`.
 *
 * Compatibility notes, verified against the installed versions:
 * - `durable-harness@0.0.1` is built against `@earendil-works/pi-durable`
 *   1.0.4. The opener below is typed with the `Storage` of pi-durable 1.4.0.
 *   The type check passes with `strictFunctionTypes`, so the two match.
 * - `durable-harness/pi-durable` loads no Zod. The Zod peer of
 *   `durable-harness` belongs to the `durable-harness/claude-code` path
 *   only. The Pi path needs no Zod 4.
 *
 * This module is not part of `index.ts`. A route that uses it must exist
 * first. Today no such route exists: Convex deployment isolation keeps the
 * deployment key inside one deployment, so no public runtime endpoint can be
 * enabled yet.
 */
import { resumeWith } from 'durable-harness/pi-durable';
import type { Storage } from '@earendil-works/pi-durable';
import { openPiHarness, type PiHarnessOptions } from './pi-harness';
import type { Harness as PiHarness } from '@earendil-works/pi-durable';

/**
 * An opener for a session storage.
 *
 * The shape is the one `resumeWith` accepts. The storage is the session
 * storage of the world.
 */
export type PiHarnessOpener = (storage: Storage) => Promise<PiHarness>;

/** The options of an opener. The storage comes from the caller. */
export type PiHarnessOpenerOptions = Omit<PiHarnessOptions, 'storage'>;

/**
 * Build the opener of the Pi agent.
 *
 * The opener opens a harness on the storage it receives. It uses the fixed
 * model and the optional `propose_operation` tool.
 */
export function createPiHarnessOpener(
  options: PiHarnessOpenerOptions
): PiHarnessOpener {
  return (storage: Storage) => openPiHarness({ ...options, storage });
}

/**
 * Register the opener of the Pi agent with `durable-harness`.
 *
 * The call must run once, at module scope, in the module that owns the
 * agent. A wake of a crashed session calls the registered opener and the
 * harness resumes the turn.
 */
export function resumePiHarness(
  options: PiHarnessOpenerOptions
): PiHarnessOpener {
  return resumeWith(createPiHarnessOpener(options));
}
