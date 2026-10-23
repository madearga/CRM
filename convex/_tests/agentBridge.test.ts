import { describe, expect, it } from 'vitest';

import {
  AGENT_BRIDGE_MAX_SKEW_SECONDS,
  agentBridgeSigningText,
  signAgentBridgeRequest,
  verifyAgentBridgeSignature,
} from '../helpers/agentBridge';

const secret = 'test-secret';
const path = '/api/agent/bridge/message';
const body = JSON.stringify({ text: 'hello from the service' });

function nowInSeconds(offsetSeconds = 0): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

async function signedHeaders(
  options: {
    secret?: string;
    timestamp?: string;
    path?: string;
    body?: string;
  } = {}
) {
  const timestamp = options.timestamp ?? String(nowInSeconds());
  const signature = await signAgentBridgeRequest(
    options.secret ?? secret,
    timestamp,
    options.path ?? path,
    options.body ?? body
  );
  return { timestamp, signature };
}

describe('the signature of the agent service bridge', () => {
  it('signs the timestamp, the path and the raw body', () => {
    expect(agentBridgeSigningText('1700000000', path, body)).toBe(
      `1700000000\n${path}\n${body}`
    );
  });

  it('trusts a request that carries the right signature', async () => {
    const headers = await signedHeaders();
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
    });
    expect(verdict).toEqual({ ok: true, reason: 'ok' });
  });

  it('refuses a request that was signed with another secret', async () => {
    const headers = await signedHeaders({ secret: 'another-secret' });
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('signature_mismatch');
  });

  it('refuses a request whose body was changed after the signing', async () => {
    const headers = await signedHeaders();
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: `${body} `,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('signature_mismatch');
  });

  it('refuses a request whose path was changed after the signing', async () => {
    const headers = await signedHeaders();
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path: '/api/agent/bridge/proposal',
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('signature_mismatch');
  });

  it('refuses a request whose timestamp is too old', async () => {
    const headers = await signedHeaders({
      timestamp: String(nowInSeconds(-(AGENT_BRIDGE_MAX_SKEW_SECONDS + 30))),
    });
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('timestamp_outside_window');
  });

  it('refuses a request whose timestamp is too far in the future', async () => {
    const headers = await signedHeaders({
      timestamp: String(nowInSeconds(AGENT_BRIDGE_MAX_SKEW_SECONDS + 30)),
    });
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('timestamp_outside_window');
  });

  it('trusts a request at the edge of the window', async () => {
    const now = Date.now();
    const headers = await signedHeaders({
      timestamp: String(Math.floor(now / 1000) - AGENT_BRIDGE_MAX_SKEW_SECONDS),
    });
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
      now,
    });
    expect(verdict.ok).toBe(true);
  });

  it('refuses a replay of the same request after the window', async () => {
    const headers = await signedHeaders({
      timestamp: String(nowInSeconds(-(AGENT_BRIDGE_MAX_SKEW_SECONDS + 1))),
    });
    const verdict = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('timestamp_outside_window');
  });

  it('refuses a broken signature header', async () => {
    const headers = await signedHeaders();
    for (const signatureHeader of [
      '',
      'v2=' + headers.signature.slice(3),
      'v1=',
      'v1=zzzz',
      headers.signature.slice(0, -1),
      headers.signature + '00',
    ]) {
      const verdict = await verifyAgentBridgeSignature({
        secret,
        method: 'POST',
        path,
        timestampHeader: headers.timestamp,
        signatureHeader,
        rawBody: body,
      });
      expect(verdict.ok).toBe(false);
    }
  });

  it('refuses a broken timestamp header', async () => {
    const headers = await signedHeaders();
    for (const timestampHeader of ['', 'not-a-number', '12.5', '-1']) {
      const verdict = await verifyAgentBridgeSignature({
        secret,
        method: 'POST',
        path,
        timestampHeader,
        signatureHeader: headers.signature,
        rawBody: body,
      });
      expect(verdict.ok).toBe(false);
    }
  });

  it('refuses a request without headers or without a secret', async () => {
    const headers = await signedHeaders();
    const withoutSignature = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: null,
      rawBody: body,
    });
    const withoutTimestamp = await verifyAgentBridgeSignature({
      secret,
      method: 'POST',
      path,
      timestampHeader: null,
      signatureHeader: headers.signature,
      rawBody: body,
    });
    const withoutSecret = await verifyAgentBridgeSignature({
      secret: '',
      method: 'POST',
      path,
      timestampHeader: headers.timestamp,
      signatureHeader: headers.signature,
      rawBody: body,
    });

    expect(withoutSignature.ok).toBe(false);
    expect(withoutTimestamp.ok).toBe(false);
    expect(withoutSecret).toEqual({ ok: false, reason: 'missing_secret' });
  });
});
