/**
 * The tests of the signed bridge client.
 *
 * The tests only cover the pure parts of the signature: the signed text,
 * the hex of the HMAC, the shape of the header, and the path of the
 * signature. No test calls the Convex deployment and no test reads the
 * service secret of the environment.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  BRIDGE_MESSAGE_PATH,
  BRIDGE_SIGNATURE_HEADER,
  BRIDGE_TIMESTAMP_HEADER,
  bridgeCall,
  buildBridgeHeaders,
  buildSignature,
  buildSignatureHeader,
  buildSigningText,
  toSignaturePath,
} from '../bridge';

const SECRET = 'test-secret';
const TIMESTAMP = 1_700_000_000;
const RAW_BODY = '{"a":1}';
const EXPECTED_HEX =
  'f188f9742eb97696158e50d0d8716b018278c10fe7588a85fa374a5178f41f44';

describe('the signed text of the bridge', () => {
  it('holds the timestamp, the path, and the raw body', () => {
    expect(buildSigningText(TIMESTAMP, BRIDGE_MESSAGE_PATH, RAW_BODY)).toBe(
      `${TIMESTAMP}\n${BRIDGE_MESSAGE_PATH}\n${RAW_BODY}`
    );
  });

  it('is the HMAC-SHA256 of the signed text, in lower case hex', () => {
    const hex = buildSignature(
      SECRET,
      TIMESTAMP,
      BRIDGE_MESSAGE_PATH,
      RAW_BODY
    );

    expect(hex).toBe(EXPECTED_HEX);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the body changes', () => {
    const first = buildSignature(
      SECRET,
      TIMESTAMP,
      BRIDGE_MESSAGE_PATH,
      RAW_BODY
    );
    const second = buildSignature(
      SECRET,
      TIMESTAMP,
      BRIDGE_MESSAGE_PATH,
      '{"a":2}'
    );

    expect(first).not.toBe(second);
  });
});

describe('the header of the bridge', () => {
  it('holds the version and the hex', () => {
    expect(
      buildSignatureHeader(SECRET, TIMESTAMP, BRIDGE_MESSAGE_PATH, RAW_BODY)
    ).toBe(`v1=${EXPECTED_HEX}`);
  });

  it('holds the timestamp and the signature', () => {
    const headers = buildBridgeHeaders({
      secret: SECRET,
      timestamp: TIMESTAMP,
      path: BRIDGE_MESSAGE_PATH,
      rawBody: RAW_BODY,
    });

    expect(headers[BRIDGE_TIMESTAMP_HEADER]).toBe(String(TIMESTAMP));
    expect(headers[BRIDGE_SIGNATURE_HEADER]).toBe(`v1=${EXPECTED_HEX}`);
    expect(headers['content-type']).toBe('application/json');
  });

  it('never holds the secret', () => {
    const headers = buildBridgeHeaders({
      secret: SECRET,
      timestamp: TIMESTAMP,
      path: BRIDGE_MESSAGE_PATH,
      rawBody: RAW_BODY,
    });

    expect(Object.values(headers).join(' ')).not.toContain(SECRET);
  });
});

describe('the path of the signature', () => {
  it('is the pathname of the URL only', () => {
    const url = new URL('https://example.convex.site/api/agent/bridge/message');

    expect(toSignaturePath(url)).toBe('/api/agent/bridge/message');
  });

  it('drops the query string', () => {
    const url = new URL('https://example.convex.site/api/agent/bridge/message?x=1');

    expect(toSignaturePath(url)).toBe('/api/agent/bridge/message');
  });
});

describe('the bridge call', () => {
  const siteUrl = 'https://example.convex.site';

  it('sends the signed body with the two headers', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ok: true, operationId: 'op_1' })
    );

    const envelope = await bridgeCall(
      BRIDGE_MESSAGE_PATH,
      { a: 1 },
      {
        secret: SECRET,
        siteUrl,
        now: () => TIMESTAMP * 1000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }
    );

    expect(envelope.operationId).toBe('op_1');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${siteUrl}${BRIDGE_MESSAGE_PATH}`);
    expect(init.body).toBe(RAW_BODY);

    const headers = init.headers as Record<string, string>;
    expect(headers[BRIDGE_TIMESTAMP_HEADER]).toBe(String(TIMESTAMP));
    expect(headers[BRIDGE_SIGNATURE_HEADER]).toBe(`v1=${EXPECTED_HEX}`);
  });

  it('throws when the bridge answers with a status that is not a 2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 500 }));

    await expect(
      bridgeCall(BRIDGE_MESSAGE_PATH, { a: 1 }, {
        secret: SECRET,
        siteUrl,
        now: () => TIMESTAMP * 1000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow(/500/);
  });

  it('throws when the envelope does not carry ok', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: false, error: 'no' }));

    await expect(
      bridgeCall(BRIDGE_MESSAGE_PATH, { a: 1 }, {
        secret: SECRET,
        siteUrl,
        now: () => TIMESTAMP * 1000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow(/refused/);
  });

  it('throws when the secret is missing', async () => {
    await expect(
      bridgeCall(BRIDGE_MESSAGE_PATH, { a: 1 }, {
        secret: '',
        siteUrl,
        fetchImpl: (async () => Response.json({ ok: true })) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/AGENT_SERVICE_SECRET/);
  });
});
