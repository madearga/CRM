/**
 * One agent turn of a room.
 *
 * A turn is one run of the agent: the model reads the transcript, it may
 * call the `propose_operation` tool, and it answers with a text. The answer
 * is the reply of the agent.
 *
 * The runtime is a MemoryStorage MVP: the session state of the agent is the
 * Convex room transcript, and the in-memory harness state is disposable. It
 * is thrown away at the end of the turn, so the room transcript stays the
 * only state that survives.
 *
 * The turn is guarded. The model call is aborted after 55 seconds, and the
 * turn never waits longer than that.
 */
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { AssistantEntry } from '@earendil-works/pi-durable';
import type { Message } from '@earendil-works/pi-ai';

import { MemoryStorage, openPiHarness } from './pi-harness';
import { PI_MODEL_REF } from './pi-model';
import type { ProposeOperationHandler } from './propose-operation';

/** The longest a turn may take. The model call is aborted after this. */
export const AGENT_TURN_TIMEOUT_MS = 55_000;

/** The input of one turn. */
export interface AgentTurnInput {
  /** The name of the agent. It is in the instructions of the agent. */
  readonly agentName: string;
  /** The name of the room. It is in the instructions of the agent. */
  readonly roomName: string;
  /** The text of the person. It is the input of the run. */
  readonly userText: string;
  /** The transcript of the room, oldest first. */
  readonly transcript: string;
  /** The implementation of the `propose_operation` tool. */
  readonly proposeOperation?: ProposeOperationHandler;
  /** The longest the turn may take. It defaults to 55 seconds. */
  readonly timeoutMs?: number;
}

/** The result of one turn. */
export interface AgentTurnResult {
  /** The text of the agent. It is empty when the agent said nothing. */
  readonly reply: string;
}

/** The error of a turn that took too long. */
export class AgentTurnTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The agent turn took more than ${timeoutMs} milliseconds`);
    this.name = 'AgentTurnTimeoutError';
  }
}

/**
 * The instructions of the agent.
 *
 * The instructions name the agent and the room, they tell the agent how to
 * propose a change, and they hold the transcript of the room.
 */
export function buildAgentInstructions(input: AgentTurnInput): string {
  const lines = [
    `You are "${input.agentName}", an agent of the CRM of "${input.roomName}".`,
    'You answer the last message of the person in short, clear sentences.',
    'You never change data yourself. When the CRM must change data, you call the tool propose_operation with one operation name and a JSON payload. The tool only records the proposal. A person approves it.',
    'The operation names are create_activity and update_deal_stage.',
  ];

  if (input.transcript.trim() === '') {
    lines.push('The room has no earlier message.');
  } else {
    lines.push('The transcript of the room, oldest first:');
    lines.push(input.transcript);
  }

  return lines.join('\n');
}

/**
 * The text of the answer of the agent.
 *
 * The answer holds text blocks and thinking blocks. Only the text blocks
 * are the reply of the agent.
 */
export function extractReplyText(
  messages: readonly Message[] | undefined
): string {
  if (!messages) return '';
  const parts: string[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const content = message.content;
    if (typeof content === 'string') {
      parts.push(content);
      continue;
    }
    for (const block of content) {
      if (block.type === 'text') parts.push(block.text);
    }
  }
  return parts.join('\n').trim();
}

/**
 * Run one agent turn.
 *
 * The call opens a harness on a fresh in-memory storage, submits the text of
 * the person to the root conversation of that harness, waits for the answer,
 * and closes the harness.
 *
 * It throws when the turn does not finish in time, and when the model
 * answers nothing at all.
 */
export async function runAgentTurn(
  input: AgentTurnInput
): Promise<AgentTurnResult> {
  const timeoutMs = input.timeoutMs ?? AGENT_TURN_TIMEOUT_MS;
  const context = BACKGROUND_CONTEXT;
  const storage = new MemoryStorage();

  const harness = await openPiHarness({
    storage,
    context,
    settings: { stream: { timeoutMs } },
    ...(input.proposeOperation === undefined
      ? {}
      : { proposeOperation: input.proposeOperation }),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const root = await harness.root(context, {
      agent: {
        model: {
          provider: PI_MODEL_REF.provider,
          modelId: PI_MODEL_REF.modelId,
        },
        instructions: buildAgentInstructions(input),
      },
    });

    const submission = await root.submit(
      { type: 'input', content: input.userText },
      context
    );

    const guard = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new AgentTurnTimeoutError(timeoutMs));
      }, timeoutMs);
    });

    const settled = await Promise.race([submission.wait(context), guard]);

    if (settled.status !== 'done' || settled.type !== 'input') {
      const reason =
        settled.status === 'unanswered' ? settled.reason : settled.status;
      throw new Error(`The agent turn did not finish: ${reason}`);
    }

    const answer = await root.commit(
      (tx) => tx.entry(AssistantEntry, settled.answer),
      context
    );

    return { reply: extractReplyText(answer?.model) };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    await harness.close(context).catch(() => undefined);
  }
}
