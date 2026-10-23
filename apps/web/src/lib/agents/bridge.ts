/**
 * The signed client of the agent bridge.
 *
 * The bridge is the only way from this Next.js runtime into the Convex
 * deployment. Every call carries two headers:
 * - `X-Ruang-Timestamp`: the Unix time in seconds of the call.
 * - `X-Ruang-Signature`: `v1=<hex>`, where the hex is the HMAC-SHA256 of
 *   `<timestamp>\n<path>\n<rawBody>` with the service secret as the key.
 *
 * The path in the signature is the URL pathname only. The query string and
 * the site URL are not part of the signature.
 *
 * Safety rules of this module:
 * - The secret is read from the environment. It is never logged, never put
 *   in an error message, and never returned to a caller.
 * - The signature is fresh for every call. A new timestamp is made for every
 *   request, so a captured signature cannot be replayed later.
 * - A response that is not a 2xx throws. An envelope that does not carry
 *   `ok: true` throws too.
 */
import { createHmac } from 'node:crypto';

/** The path of the bridge call that posts a message of an agent. */
export const BRIDGE_MESSAGE_PATH = '/api/agent/bridge/message';

/** The path of the bridge call that records a proposal of an agent. */
export const BRIDGE_PROPOSAL_PATH = '/api/agent/bridge/proposal';

/** The version of the signature. It is part of the header value. */
export const BRIDGE_SIGNATURE_VERSION = 'v1';

/** The header that carries the Unix time in seconds. */
export const BRIDGE_TIMESTAMP_HEADER = 'X-Ruang-Timestamp';

/** The header that carries the signature. */
export const BRIDGE_SIGNATURE_HEADER = 'X-Ruang-Signature';

/** The envelope every bridge call answers with. */
export type BridgeEnvelope = {
  readonly ok: boolean;
  readonly error?: string;
  readonly [key: string]: unknown;
};

/** The options of one bridge call. The environment supplies the defaults. */
export interface BridgeCallOptions {
  /** The service secret. It is used for the signature only. */
  readonly secret?: string;
  /** The base URL of the Convex deployment. */
  readonly siteUrl?: string;
  /** The clock of the call. It returns the Unix time in milliseconds. */
  readonly now?: () => number;
  /** The fetch of the call. It exists for tests. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * The text that is signed.
 *
 * The order is fixed: the timestamp, the path, and the raw body. Each part
 * is separated by a newline, so no part can be moved into another one.
 */
export function buildSigningText(
  timestamp: number,
  path: string,
  rawBody: string
): string {
  return `${timestamp}\n${path}\n${rawBody}`;
}

/**
 * The HMAC-SHA256 of the signed text, in lower case hex.
 *
 * The secret is only the key of the HMAC. It never leaves this function.
 */
export function buildSignature(
  secret: string,
  timestamp: number,
  path: string,
  rawBody: string
): string {
  return createHmac('sha256', secret)
    .update(buildSigningText(timestamp, path, rawBody), 'utf8')
    .digest('hex');
}

/**
 * The value of the signature header.
 *
 * The value is `v1=<hex>`.
 */
export function buildSignatureHeader(
  secret: string,
  timestamp: number,
  path: string,
  rawBody: string
): string {
  const hex = buildSignature(secret, timestamp, path, rawBody);
  return `${BRIDGE_SIGNATURE_VERSION}=${hex}`;
}

/**
 * The headers of one bridge call.
 *
 * The body is signed as the exact string that is sent, so the caller must
 * not change the body after this call.
 */
export function buildBridgeHeaders(options: {
  readonly secret: string;
  readonly timestamp: number;
  readonly path: string;
  readonly rawBody: string;
}): Record<string, string> {
  return {
    'content-type': 'application/json',
    [BRIDGE_TIMESTAMP_HEADER]: String(options.timestamp),
    [BRIDGE_SIGNATURE_HEADER]: buildSignatureHeader(
      options.secret,
      options.timestamp,
      options.path,
      options.rawBody
    ),
  };
}

/**
 * The path of a call, as the signature sees it.
 *
 * It is the pathname of the URL only. A path without a leading slash gets
 * one, so the pathname is never empty.
 */
export function toSignaturePath(url: URL): string {
  const pathname = url.pathname === '' ? '/' : url.pathname;
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

/**
 * The error message of a refused envelope.
 *
 * It never holds the secret. It holds the path and the message of the
 * envelope, when the envelope holds one.
 */
function refusedMessage(path: string, envelope: BridgeEnvelope | null): string {
  const detail =
    envelope && typeof envelope.error === 'string' && envelope.error !== ''
      ? `: ${envelope.error}`
      : '';
  return `The agent bridge refused ${path}${detail}`;
}

/**
 * Call the agent bridge with a signed request.
 *
 * The call reads the secret and the site URL from the environment, signs the
 * raw body, and posts it. It returns the envelope of the bridge.
 *
 * It throws when the secret or the site URL is missing, when the answer is
 * not a 2xx, or when the envelope does not carry `ok: true`.
 */
export async function bridgeCall<T = BridgeEnvelope>(
  path: string,
  body: unknown,
  options?: BridgeCallOptions
): Promise<T> {
  const secret = options?.secret ?? process.env.AGENT_SERVICE_SECRET;
  if (!secret) {
    throw new Error('AGENT_SERVICE_SECRET is not set');
  }

  const siteUrl = options?.siteUrl ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_SITE_URL is not set');
  }

  const now = options?.now ?? Date.now;
  const fetchImpl = options?.fetchImpl ?? fetch;

  const rawBody = JSON.stringify(body ?? {});
  const timestamp = Math.floor(now() / 1000);
  const url = new URL(path.startsWith('/') ? path : `/${path}`, siteUrl);
  const signaturePath = toSignaturePath(url);

  const response = await fetchImpl(url.toString(), {
    method: 'POST',
    headers: buildBridgeHeaders({
      secret,
      timestamp,
      path: signaturePath,
      rawBody,
    }),
    body: rawBody,
  });

  if (!response.ok) {
    throw new Error(
      `The agent bridge refused ${signaturePath} with status ${response.status}`
    );
  }

  const envelope = (await response.json().catch(() => null)) as
    | BridgeEnvelope
    | null;

  if (!envelope || typeof envelope !== 'object' || envelope.ok !== true) {
    throw new Error(refusedMessage(signaturePath, envelope));
  }

  return envelope as T;
}
