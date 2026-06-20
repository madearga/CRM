/**
 * Tests for the @crm/config client/server env split.
 *
 * These guard the P1 security fix: the mobile (client) schema must NOT
 * require or accept `BETTER_AUTH_SECRET`, so an `EXPO_PUBLIC_BETTER_AUTH_SECRET*`
 * variable can never inline the shared server secret into a client bundle.
 * The full server schema still requires it.
 */
import { describe, expect, it } from 'vitest';

import {
  clientEnvSchema,
  envSchema,
  parseClientEnv,
  parseEnv,
} from '@crm/config';

const validClient = {
  CONVEX_URL: 'https://happy-anvil-123.convex.cloud',
  CONVEX_SITE_URL: 'https://happy-anvil-123.convex.site',
  SITE_URL: 'https://crm.example.com',
};

describe('clientEnvSchema (client-safe)', () => {
  it('accepts the required client vars without BETTER_AUTH_SECRET', () => {
    const result = parseClientEnv(validClient);
    expect(result.CONVEX_URL).toBe(validClient.CONVEX_URL);
  });

  it('does NOT have a BETTER_AUTH_SECRET key in its shape', () => {
    expect(clientEnvSchema.shape).not.toHaveProperty('BETTER_AUTH_SECRET');
  });

  it('ignores a BETTER_AUTH_SECRET value if one is passed (no secret captured)', () => {
    const result = parseClientEnv({
      ...validClient,
      BETTER_AUTH_SECRET: 'top-secret-should-be-ignored',
    });
    expect((result as Record<string, unknown>).BETTER_AUTH_SECRET).toBeUndefined();
  });

  it('throws when CONVEX_URL is missing', () => {
    expect(() => parseClientEnv({ ...validClient, CONVEX_URL: undefined })).toThrow(
      /CONVEX_URL/,
    );
  });

  it('clientEnvSchema.safeParse returns success:false without throwing', () => {
    const result = clientEnvSchema.safeParse({ CONVEX_URL: undefined });
    expect(result.success).toBe(false);
  });
});

describe('envSchema (full / server)', () => {
  it('requires BETTER_AUTH_SECRET', () => {
    const result = envSchema.safeParse(validClient);
    expect(result.success).toBe(false);
  });

  it('accepts when BETTER_AUTH_SECRET is present', () => {
    const result = parseEnv({ ...validClient, BETTER_AUTH_SECRET: 'server-secret' });
    expect(result.BETTER_AUTH_SECRET).toBe('server-secret');
  });

  it('envSchema extends clientEnvSchema (has the BETTER_AUTH_SECRET key)', () => {
    expect(envSchema.shape).toHaveProperty('BETTER_AUTH_SECRET');
  });
});
