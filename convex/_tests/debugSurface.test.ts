/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { internal } from '../_generated/api';
import { getDebugEnv } from '../debug';
import { createSession } from '../createTestSession';

const modules = import.meta.glob([
  '../**/*.{ts,js}',
  '!../__tests__/**',
  '!../convex/**',
]);
beforeEach(() => {
  // A negative test against the old implementation must never print ambient credentials.
  for (const name of Object.keys(process.env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTHORIZATION/.test(name))
      vi.stubEnv(name, undefined);
  }
  vi.stubEnv('BETTER_AUTH_SECRET', 'fake-auth-secret-for-regression-only');
  vi.stubEnv('ADMIN', 'admin@example.test');
});
afterEach(() => vi.unstubAllEnvs());

describe('debug endpoints never expose auth material', () => {
  it('does not register debug environment lookup as a public query', () => {
    expect('isInternal' in getDebugEnv && getDebugEnv.isInternal).toBe(true);
  });

  it('does not register a test session generator as a public mutation', () => {
    expect('isInternal' in createSession && createSession.isInternal).toBe(
      true
    );
  });

  it('returns only configuration status, never actual secrets', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'fake-auth-secret-for-regression-only');
    vi.stubEnv(
      'GOOGLE_CLIENT_SECRET',
      'fake-google-secret-for-regression-only'
    );
    vi.stubEnv('GOOGLE_CLIENT_ID', 'fake-client-id');
    vi.stubEnv('ADMIN', 'admin@example.test');
    const t = convexTest(schema, modules);
    const result = await t.query(internal.debug.getDebugEnv, {});
    expect(result).toMatchObject({
      authConfigured: true,
      googleConfigured: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /fake-auth-secret|fake-google-secret/
    );
  });

  it('refuses test session creation even through an internal call', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.createTestSession.createSession, {
        userId: 'some-user',
        orgId: 'some-organization',
      })
    ).rejects.toThrow(/disabled/i);
  });
});
