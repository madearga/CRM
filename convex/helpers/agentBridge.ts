// The signature of the agent service bridge.
//
// An outside service posts into a room through the bridge. The service signs
// the exact text it sends, and the bridge signs the same text again, so a
// changed body, a changed path or a replayed request is refused.
//
// The signed text is the timestamp, the path, and the raw body, each on its
// own line:
//   `${timestamp}\n${path}\n${rawBody}`
// The timestamp travels in the header "X-Ruang-Timestamp" as unix seconds.
// The signature travels in the header "X-Ruang-Signature" as "v1=<hex>".
//
// The check fails closed. A missing secret, a missing header, a broken
// header, a timestamp that is not a number, a timestamp outside the window,
// and a body that was changed after the signing all end in the same answer:
// the request is not trusted.
//
// The digest uses the Web Crypto API, because the runtime of an HTTP action
// has no Node.js builtins. The comparison of the digests takes the same time
// for every wrong signature, so a wrong signature does not tell how many
// characters were right.

export const AGENT_BRIDGE_SIGNATURE_HEADER = 'X-Ruang-Signature';
export const AGENT_BRIDGE_TIMESTAMP_HEADER = 'X-Ruang-Timestamp';
export const AGENT_BRIDGE_SIGNATURE_VERSION = 'v1';

/** The largest distance between the timestamp of a request and now. */
export const AGENT_BRIDGE_MAX_SKEW_SECONDS = 300;

export type AgentBridgeSignatureInput = {
  /** The shared secret of the service. */
  secret: string;
  /** The method of the request. */
  method: string;
  /** The path of the request, without the host. */
  path: string;
  /** The value of the timestamp header. */
  timestampHeader: string | null | undefined;
  /** The value of the signature header. */
  signatureHeader: string | null | undefined;
  /** The body of the request, as text and before any JSON parsing. */
  rawBody: string;
  /** The current time in milliseconds. Defaults to the system clock. */
  now?: number;
};

export type AgentBridgeSignatureResult = {
  /** True when the request is trusted. */
  ok: boolean;
  /** Why the request was refused. 'ok' when it was trusted. */
  reason: string;
};

/** The text that the service signs. */
export function agentBridgeSigningText(
  timestamp: string,
  path: string,
  rawBody: string
): string {
  return `${timestamp}\n${path}\n${rawBody}`;
}

/** The hex digest of the text, under the shared secret. */
async function hmacHex(secret: string, text: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** The bytes of a hex text. The text is checked before it is read. */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * True when the two byte lists are the same.
 *
 * The loop reads every byte, also when the lists differ early, so the time
 * of the answer does not tell where the difference was.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a[index] ^ b[index];
  }
  return mismatch === 0;
}

/**
 * The signature header for a request.
 *
 * The service uses this to sign a request. The bridge uses
 * `verifyAgentBridgeSignature` to check one.
 */
export async function signAgentBridgeRequest(
  secret: string,
  timestamp: string,
  path: string,
  rawBody: string
): Promise<string> {
  const digest = await hmacHex(
    secret,
    agentBridgeSigningText(timestamp, path, rawBody)
  );
  return `${AGENT_BRIDGE_SIGNATURE_VERSION}=${digest}`;
}

/**
 * True when the signature of a request is trusted.
 *
 * The request is trusted when the secret is set, the timestamp header holds
 * a number of seconds that lies within the window of now, the signature
 * header holds a digest of the signed text, and the digest is the one that
 * the secret produces.
 *
 * The method is checked for shape only. The signed text covers the
 * timestamp, the path and the body, so the method does not change the
 * digest.
 */
export async function verifyAgentBridgeSignature(
  input: AgentBridgeSignatureInput
): Promise<AgentBridgeSignatureResult> {
  const { secret, method, path, timestampHeader, signatureHeader, rawBody } =
    input;

  if (typeof secret !== 'string' || secret.length === 0) {
    return { ok: false, reason: 'missing_secret' };
  }
  if (typeof method !== 'string' || method.length === 0) {
    return { ok: false, reason: 'missing_method' };
  }
  if (typeof path !== 'string' || path.length === 0) {
    return { ok: false, reason: 'missing_path' };
  }
  if (typeof rawBody !== 'string') {
    return { ok: false, reason: 'missing_body' };
  }
  if (typeof timestampHeader !== 'string') {
    return { ok: false, reason: 'missing_timestamp' };
  }

  const timestamp = timestampHeader.trim();
  if (!/^\d{1,15}$/.test(timestamp)) {
    return { ok: false, reason: 'malformed_timestamp' };
  }
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds)) {
    return { ok: false, reason: 'malformed_timestamp' };
  }

  const now = typeof input.now === 'number' ? input.now : Date.now();
  if (!Number.isFinite(now)) {
    return { ok: false, reason: 'invalid_now' };
  }
  if (
    Math.abs(Math.floor(now / 1000) - seconds) > AGENT_BRIDGE_MAX_SKEW_SECONDS
  ) {
    return { ok: false, reason: 'timestamp_outside_window' };
  }

  if (typeof signatureHeader !== 'string') {
    return { ok: false, reason: 'missing_signature' };
  }
  const prefix = `${AGENT_BRIDGE_SIGNATURE_VERSION}=`;
  const trimmed = signatureHeader.trim();
  if (!trimmed.startsWith(prefix)) {
    return { ok: false, reason: 'malformed_signature' };
  }
  const provided = trimmed.slice(prefix.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    return { ok: false, reason: 'malformed_signature' };
  }

  const expected = await hmacHex(
    secret,
    agentBridgeSigningText(timestamp, path, rawBody)
  );
  if (!constantTimeEqual(hexToBytes(expected), hexToBytes(provided))) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  return { ok: true, reason: 'ok' };
}
