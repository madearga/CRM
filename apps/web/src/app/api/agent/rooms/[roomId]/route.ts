/**
 * The route of one agent turn of a room.
 *
 * The route receives the text of a person. It saves that text in the room,
 * it runs one agent turn, it writes the reply of the agent into the room,
 * and it records the proposals of the agent in the ledger of the CRM.
 *
 * Every call of the Convex deployment is made with the session of the
 * person, so the rules of the organization and of the room decide what the
 * person may do. The calls of the bridge are signed with the service
 * secret, and the secret never leaves the server.
 *
 * The body of the request:
 * - `text`: the text of the person. It holds 1 to 2000 characters.
 * - `agentId`: the key of the agent. It is optional. Without it, the first
 *   active agent of the room answers.
 */
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { NextResponse } from 'next/server';
import { AGENT_OPERATION_KINDS } from '@crm/domain';

import {
  fetchAuthMutation,
  fetchAuthQuery,
  getSessionToken,
} from '@/lib/convex/server';
import { randomUUID } from 'node:crypto';

import { runAgentTurn, AgentTurnTimeoutError } from '@/lib/agents/agent-turn';
import { createCrmReader } from '@/lib/agents/crm-access';
import { createQueryCrmTool } from '@/lib/agents/crm-tools';
import {
  bridgeCall,
  BRIDGE_MESSAGE_PATH,
  BRIDGE_PROPOSAL_PATH,
} from '@/lib/agents/bridge';
import {
  buildProposalSummary,
  formatTranscript,
  toOperationKind,
  type TranscriptMessage,
} from '@/lib/agents/transcript';
import type { ProposeOperationHandler } from '@/lib/agents/propose-operation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The longest a text of a person may be. */
const MAX_TEXT_LENGTH = 2000;

/** The number of messages of the room that the agent reads. */
const TRANSCRIPT_LIMIT = 40;

/** One proposal of the agent, as the route answers with it. */
type ProposalResult = {
  operationId: string;
  kind: string;
  summary: string;
  status: string;
  duplicate: boolean;
  payload: Record<string, unknown>;
};

/** The answer of the bridge for a proposal. */
type ProposalEnvelope = {
  ok: boolean;
  operationId?: string;
  status?: string;
  duplicate?: boolean;
  error?: string;
};

/** The answer of the bridge for a message. */
type MessageEnvelope = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * The status of a refused Convex call.
 *
 * The Convex error carries the code of the rule that refused the call. A
 * call without a known code is a fault of the server.
 */
function convexErrorStatus(error: unknown): number {
  const data = (error as { data?: { code?: string } } | null)?.data;
  const code = data?.code;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'FORBIDDEN') return 403;
  if (code === 'BAD_REQUEST') return 400;
  if (code === 'TOO_MANY_REQUESTS') return 429;

  const message = error instanceof Error ? error.message : '';
  if (message.includes('NOT_FOUND')) return 404;
  if (message.includes('FORBIDDEN')) return 403;
  if (message.includes('BAD_REQUEST')) return 400;
  if (message.includes('TOO_MANY_REQUESTS')) return 429;
  return 500;
}

/** The text of an error, without the stack. */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The call failed';
}

/**
 * The text of the request.
 *
 * It must hold 1 to 2000 characters. A body that is not JSON is refused.
 */
function readText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const text = (body as { text?: unknown }).text;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_TEXT_LENGTH) return null;
  return trimmed;
}

/** The key of the agent of the request. It is optional. */
function readAgentId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const agentId = (body as { agentId?: unknown }).agentId;
  if (typeof agentId !== 'string') return undefined;
  const trimmed = agentId.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * The agent that answers.
 *
 * The agent of the request must be an active agent of the room. Without a
 * key in the request, the first active agent of the room answers. A room
 * without an active agent has no answer, so the call is refused.
 */
function resolveAgent(
  agents: readonly {
    agentId: string;
    name: string;
    status: string;
  }[],
  members: readonly {
    memberType: string;
    agentId?: string;
    displayName: string;
  }[],
  requestedAgentId: string | undefined
): { agentId: string; name: string } | null {
  const memberKeys = new Set(
    members
      .filter((member) => member.memberType === 'agent')
      .map((member) => member.agentId)
      .filter((key): key is string => typeof key === 'string')
  );

  const active = agents.filter(
    (agent) => agent.status === 'active' && memberKeys.has(agent.agentId)
  );

  if (requestedAgentId !== undefined) {
    const found = active.find((agent) => agent.agentId === requestedAgentId);
    return found ? { agentId: found.agentId, name: found.name } : null;
  }

  const first = active[0];
  return first ? { agentId: first.agentId, name: first.name } : null;
}

/**
 * The transcript of the room.
 *
 * The messages of the room are the source of truth. The newest message of
 * the person is not in the transcript, because it is the input of the turn.
 */
function toTranscript(messages: readonly {
  authorType: string;
  authorName: string;
  kind: string;
  text: string;
}[]): TranscriptMessage[] {
  return messages.map((message) => ({
    authorType: message.authorType,
    authorName: message.authorName,
    kind: message.kind,
    text: message.text,
  }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'The person is not signed in' },
        { status: 401 }
      );
    }

    const { roomId: roomIdParam } = await params;
    const roomId = roomIdParam as Id<'rooms'>;

    const body = await request.json().catch(() => null);
    const text = readText(body);
    if (text === null) {
      return NextResponse.json(
        {
          ok: false,
          error: `The text must hold 1 to ${MAX_TEXT_LENGTH} characters`,
        },
        { status: 400 }
      );
    }
    const requestedAgentId = readAgentId(body);

    // One turn spends model tokens. The limit is enforced in Convex, so it
    // holds across web instances; a refused call costs nothing.
    try {
      await fetchAuthMutation(api.agentTurns.consume, {});
    } catch (error) {
      if (convexErrorStatus(error) === 429) {
        return NextResponse.json(
          { ok: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
          { status: 429 }
        );
      }
      throw error;
    }

    const room = await fetchAuthQuery(api.rooms.get, { roomId });
    if (!room) {
      return NextResponse.json(
        { ok: false, error: 'The room does not exist' },
        { status: 404 }
      );
    }

    const session = await fetchAuthQuery(api.user.getSessionUser, {});
    const organizationId =
      session?.activeOrganization?.id ?? session?.personalOrganizationId;
    const requestingUserId = session?.id;
    if (!organizationId || !requestingUserId) {
      return NextResponse.json(
        { ok: false, error: 'The session has no organization' },
        { status: 400 }
      );
    }

    const [agents, members, messages] = await Promise.all([
      fetchAuthQuery(api.agents.list, {}),
      fetchAuthQuery(api.rooms.listMembers, { roomId }),
      fetchAuthQuery(api.rooms.listMessages, {
        roomId,
        limit: TRANSCRIPT_LIMIT,
      }),
    ]);

    const agent = resolveAgent(
      agents ?? [],
      members ?? [],
      requestedAgentId
    );
    if (!agent) {
      return NextResponse.json(
        { ok: false, error: 'The room has no active agent to answer' },
        { status: 400 }
      );
    }

    const transcript = formatTranscript(toTranscript(messages ?? []));

    await fetchAuthMutation(api.rooms.postMessage, { roomId, text });

    const proposals: ProposalResult[] = [];
    // The turn is guarded at 55 s; this abort fires just before it, so a
    // proposal never lands after the person saw a timeout.
    const turnAbort = new AbortController();
    const turnAbortTimer = setTimeout(() => turnAbort.abort(), 50_000);

    const proposeOperation: ProposeOperationHandler = async (proposal) => {
      const kind = toOperationKind(proposal.operation);
      if (kind === null) {
        return {
          accepted: false,
          summary: `The operation "${proposal.operation}" is not known. Use ${AGENT_OPERATION_KINDS.join(", ")}.`,
        };
      }

      const summary = buildProposalSummary(proposal.reason, kind);

      try {
        const envelope = await bridgeCall<ProposalEnvelope>(
          BRIDGE_PROPOSAL_PATH,
          {
            organizationId,
            roomId,
            agentId: agent.agentId,
            // The operation belongs to the person who asked, so the ledger
            // names a human and the permission check runs on that person.
            requestingUserId,
            operationKind: kind,
            payload: proposal.payload ?? {},
            summary,
          },
          { signal: turnAbort.signal }
        );

        const result: ProposalResult = {
          operationId: envelope.operationId ?? '',
          kind,
          summary,
          status: envelope.status ?? 'pending',
          duplicate: envelope.duplicate === true,
          payload: proposal.payload ?? {},
        };
        proposals.push(result);

        return {
          accepted: true,
          summary,
          operationId: result.operationId,
        };
      } catch (error) {
        console.error(
          'The proposal of the agent was not recorded:',
          errorText(error)
        );
        return {
          accepted: false,
          summary: 'The proposal could not be recorded. Do not try again.',
        };
      }
    };

    // The CRM reads of this turn run with the session of the person, so the
    // agent sees what that person may see, and writes still need approval.
    const crmReader = createCrmReader(token);
    const crmContext = await crmReader.buildContextPack().catch(() => undefined);
    const extraTools = [createQueryCrmTool(crmReader)];

    let turn;
    try {
      turn = await runAgentTurn({
        agentName: agent.name,
        roomName: room.name,
        userText: text,
        transcript,
        proposeOperation,
        crmContext,
        extraTools,
      });
    } finally {
      clearTimeout(turnAbortTimer);
    }

    if (turn.reply !== '') {
      try {
        await bridgeCall<MessageEnvelope>(BRIDGE_MESSAGE_PATH, {
          organizationId,
          roomId,
          agentId: agent.agentId,
          text: turn.reply,
          // A fresh nonce makes a repeated delivery a refusal, not a copy.
          nonce: randomUUID(),
        });
      } catch (error) {
        console.error(
          'The reply of the agent was not written into the room:',
          errorText(error)
        );
        return NextResponse.json(
          {
            ok: false,
            error: 'The reply of the agent was not written into the room',
            agentReply: turn.reply,
            proposals,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      agentReply: turn.reply,
      proposals,
    });
  } catch (error) {
    if (error instanceof AgentTurnTimeoutError) {
      return NextResponse.json(
        { ok: false, error: 'The agent did not answer in time' },
        { status: 504 }
      );
    }

    const status = convexErrorStatus(error);
    console.error('The agent turn of the room failed:', errorText(error));

    return NextResponse.json(
      { ok: false, error: 'The agent turn of the room failed' },
      { status }
    );
  }
}
