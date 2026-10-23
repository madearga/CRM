import type { RoomAgentResponse, RoomProposal } from './types';

/**
 * The room agent answers over one endpoint. The call can take almost a minute,
 * so the caller keeps the thread usable while it waits.
 */
export async function requestRoomAgent(
  roomId: string,
  text: string,
  token: string | null
): Promise<RoomAgentResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/agent/rooms/${roomId}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as Partial<RoomAgentResponse> | null;

  return {
    ok: Boolean(body?.ok),
    agentReply: typeof body?.agentReply === 'string' ? body.agentReply : '',
    proposals: Array.isArray(body?.proposals)
      ? body.proposals.map(normalizeProposal)
      : [],
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  let detail = '';
  try {
    const body = await response.json();
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const message = record.message ?? record.error;
      if (typeof message === 'string') detail = message;
    }
  } catch {
    detail = '';
  }

  if (response.status === 401) {
    return detail || 'Sesi Anda berakhir. Silakan masuk lagi.';
  }
  if (response.status === 400) {
    return detail || 'Pesan tidak valid.';
  }
  return detail || 'Gagal menghubungi agen. Coba lagi.';
}

function normalizeProposal(value: unknown): RoomProposal {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    operationId: String(record.operationId ?? ''),
    kind: String(record.kind ?? ''),
    summary: String(record.summary ?? ''),
    status: String(record.status ?? 'unknown'),
    duplicate: Boolean(record.duplicate),
  };
}
