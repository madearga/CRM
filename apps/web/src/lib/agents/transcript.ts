/**
 * The transcript of a room, as the agent reads it.
 *
 * The transcript is plain text. It is built from the messages of the Convex
 * room, so the agent sees what the people of the room saw.
 *
 * Rules of this module:
 * - The messages are the source of truth. The order is the order of the
 *   room, oldest first.
 * - Every line names the author. An author of type `agent` is an agent, an
 *   author of type `user` is a person, and an author of type `system` is the
 *   system of the room.
 * - A proposal and a decision carry their kind, so the agent does not read a
 *   decision as a plain message.
 */
import { AGENT_OPERATION_KINDS } from '@crm/domain';

/** The kinds of message of a room. */
export const ROOM_MESSAGE_KINDS = [
  'message',
  'proposal',
  'decision',
  'system',
] as const;

/** One message of a room, as the transcript needs it. */
export type TranscriptMessage = {
  readonly authorType: string;
  readonly authorName: string;
  readonly kind: string;
  readonly text: string;
};

/**
 * The label of an author.
 *
 * A person is `person`, an agent is `agent`, and everything else is
 * `system`.
 */
export function authorLabel(authorType: string): string {
  if (authorType === 'agent') return 'agent';
  if (authorType === 'system') return 'system';
  return 'person';
}

/**
 * One line of the transcript.
 *
 * The kind follows the label when it is not a plain message, so a proposal
 * and a decision stay visible.
 */
export function formatTranscriptMessage(message: TranscriptMessage): string {
  const label = authorLabel(message.authorType);
  const kind =
    message.kind && message.kind !== 'message' ? ` (${message.kind})` : '';
  const name = message.authorName.trim() === '' ? label : message.authorName;
  return `[${label}]${kind} ${name}: ${message.text}`;
}

/**
 * The whole transcript, one line per message.
 *
 * The order of the messages is kept. The caller sends the messages in the
 * order of the room.
 */
export function formatTranscript(
  messages: readonly TranscriptMessage[]
): string {
  return messages.map(formatTranscriptMessage).join('\n');
}

/**
 * The kind of operation of a proposal.
 *
 * The model names the operation. The name must be one of the kinds of the
 * domain. A name that is not one of them has no kind, so the proposal is
 * refused instead of guessed.
 */
export function toOperationKind(
  operation: string
): (typeof AGENT_OPERATION_KINDS)[number] | null {
  const name = operation.trim().toLowerCase();
  const found = AGENT_OPERATION_KINDS.find((kind) => kind === name);
  return found ?? null;
}

/**
 * The summary of a proposal.
 *
 * The summary is what a person reads before deciding. It is at most 500
 * characters, because the bridge accepts at most 500 characters.
 */
export function buildProposalSummary(
  reason: string | undefined,
  kind: string
): string {
  const text = (reason ?? '').trim();
  const summary = text === '' ? `Proposed ${kind}` : text;
  return summary.length > 500 ? summary.slice(0, 500) : summary;
}
