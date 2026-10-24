import type { FunctionReturnType } from 'convex/server';

import type { api } from '@convex/_generated/api';

/** A message as the room list shows it. */
export type RoomMessage = FunctionReturnType<
  typeof api.rooms.listMessages
>[number];

/** A proposal the agent asked for. */
export type RoomProposal = {
  operationId: string;
  kind: string;
  summary: string;
  status: string;
  duplicate?: boolean;
  /** What the operation would change. Shown before a person decides. */
  payload?: Record<string, unknown>;
};

/** The answer of the room agent endpoint. */
export type RoomAgentResponse = {
  ok: boolean;
  agentReply: string;
  proposals: RoomProposal[];
};

/** A message in the thread, either stored or still on its way. */
export type RoomListMessage = {
  id: string;
  authorType: string;
  authorName: string;
  kind: string;
  text: string;
  createdAt: number;
  operationId?: string;
  pending?: boolean;
};
