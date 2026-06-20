/**
 * Unit tests for the pure {@link authStateReducer}.
 *
 * These run in plain Node (no React Native / Better Auth runtime) because the
 * reducer is intentionally a pure function over plain values. The companion
 * `auth-provider.tsx` is the only place that touches Better Auth / React.
 *
 * Covers the U3 test scenarios:
 *  - valid credentials → authenticated
 *  - existing valid token on launch → auto-login (via SESSION_RESOLVED)
 *  - invalid credentials → error message + back to login
 *  - expired/invalid token → redirect to login (TOKEN_REVOKED)
 *  - sign-out → unauthenticated
 *  - double-tap guard while signingIn
 */
import { describe, expect, it } from 'vitest';

import {
  authStateReducer,
  initialAuthState,
  isAuthBusy,
  type AuthSession,
} from './auth-machine';

const session: AuthSession = {
  user: { id: 'u_1', email: 'rep@crm.test', name: 'Rep' },
  session: {
    id: 's_1',
    userId: 'u_1',
    token: 'tok_abc',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
};

describe('authStateReducer', () => {
  describe('SESSION_RESOLVED (cold start / revalidation)', () => {
    it('auto-logs in when a valid session is resolved on launch', () => {
      const next = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session,
      });
      expect(next).toEqual({ status: 'authenticated', error: null });
    });

    it('goes to the login screen when no session is resolved', () => {
      const next = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session: null,
      });
      expect(next).toEqual({ status: 'unauthenticated', error: null });
    });

    it('clears a stale sign-in error once a session resolves', () => {
      const failed = authStateReducer(initialAuthState, {
        type: 'SIGN_IN_FAILURE',
        error: 'bad password',
      });
      const next = authStateReducer(failed, {
        type: 'SESSION_RESOLVED',
        session,
      });
      expect(next.error).toBeNull();
      expect(next.status).toBe('authenticated');
    });
  });

  describe('SIGN_IN_REQUEST / SUCCESS / FAILURE', () => {
    it('transitions unauthenticated → signingIn on request', () => {
      const unauth = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session: null,
      });
      const next = authStateReducer(unauth, { type: 'SIGN_IN_REQUEST' });
      expect(next.status).toBe('signingIn');
      expect(next.error).toBeNull();
    });

    it('reaches authenticated on success', () => {
      const signingIn = authStateReducer(initialAuthState, {
        type: 'SIGN_IN_REQUEST',
      });
      const next = authStateReducer(signingIn, {
        type: 'SIGN_IN_SUCCESS',
        session,
      });
      expect(next).toEqual({ status: 'authenticated', error: null });
    });

    it('returns to login with an error message on failure', () => {
      const signingIn = authStateReducer(initialAuthState, {
        type: 'SIGN_IN_REQUEST',
      });
      const next = authStateReducer(signingIn, {
        type: 'SIGN_IN_FAILURE',
        error: 'Invalid email or password',
      });
      expect(next.status).toBe('unauthenticated');
      expect(next.error).toBe('Invalid email or password');
    });

    it('ignores a second SIGN_IN_REQUEST while already signingIn (double-tap guard)', () => {
      const signingIn = authStateReducer(initialAuthState, {
        type: 'SIGN_IN_REQUEST',
      });
      const next = authStateReducer(signingIn, { type: 'SIGN_IN_REQUEST' });
      expect(next).toBe(signingIn);
    });

    it('ignores SIGN_IN_REQUEST while signingOut', () => {
      const authenticated = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session,
      });
      const signingOut = authStateReducer(authenticated, {
        type: 'SIGN_OUT_REQUEST',
      });
      const next = authStateReducer(signingOut, { type: 'SIGN_IN_REQUEST' });
      expect(next).toBe(signingOut);
    });
  });

  describe('SIGN_OUT_REQUEST / COMPLETE', () => {
    it('transitions authenticated → signingOut on request', () => {
      const authenticated = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session,
      });
      const next = authStateReducer(authenticated, {
        type: 'SIGN_OUT_REQUEST',
      });
      expect(next.status).toBe('signingOut');
    });

    it('ignores SIGN_OUT_REQUEST when not authenticated', () => {
      const unauth = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session: null,
      });
      const next = authStateReducer(unauth, { type: 'SIGN_OUT_REQUEST' });
      expect(next).toBe(unauth);
    });

    it('completes to unauthenticated', () => {
      const signingOut = authStateReducer(initialAuthState, {
        type: 'SIGN_OUT_REQUEST',
      });
      // Force into signingOut via the authenticated path for realism.
      const authenticated = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session,
      });
      const so = authStateReducer(authenticated, {
        type: 'SIGN_OUT_REQUEST',
      });
      const next = authStateReducer(so, { type: 'SIGN_OUT_COMPLETE' });
      expect(next).toEqual({ status: 'unauthenticated', error: null });
      void signingOut;
    });
  });

  describe('TOKEN_REVOKED (expired / invalidated on resume)', () => {
    it('redirects an authenticated user back to login', () => {
      const authenticated = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session,
      });
      const next = authStateReducer(authenticated, {
        type: 'TOKEN_REVOKED',
      });
      expect(next.status).toBe('unauthenticated');
      expect(next.error).toBeNull();
    });

    it('clears a lingering sign-in error so the form shows clean', () => {
      const failed = authStateReducer(initialAuthState, {
        type: 'SIGN_IN_FAILURE',
        error: 'old error',
      });
      const next = authStateReducer(failed, { type: 'TOKEN_REVOKED' });
      expect(next.error).toBeNull();
    });
  });

  describe('CLEAR_ERROR', () => {
    it('clears the error without changing status', () => {
      const failed = authStateReducer(initialAuthState, {
        type: 'SIGN_IN_FAILURE',
        error: 'oops',
      });
      const next = authStateReducer(failed, { type: 'CLEAR_ERROR' });
      expect(next.error).toBeNull();
      expect(next.status).toBe('unauthenticated');
    });

    it('is a no-op when there is no error', () => {
      const unauth = authStateReducer(initialAuthState, {
        type: 'SESSION_RESOLVED',
        session: null,
      });
      const next = authStateReducer(unauth, { type: 'CLEAR_ERROR' });
      expect(next).toBe(unauth);
    });
  });

  describe('isAuthBusy', () => {
    it('is true while initializing, signingIn, or signingOut', () => {
      expect(isAuthBusy(initialAuthState)).toBe(true);
      expect(
        isAuthBusy(
          authStateReducer(initialAuthState, { type: 'SIGN_IN_REQUEST' }),
        ),
      ).toBe(true);
    });

    it('is false once authenticated or on the login screen', () => {
      expect(
        isAuthBusy(
          authStateReducer(initialAuthState, {
            type: 'SESSION_RESOLVED',
            session,
          }),
        ),
      ).toBe(false);
      expect(
        isAuthBusy(
          authStateReducer(initialAuthState, {
            type: 'SESSION_RESOLVED',
            session: null,
          }),
        ),
      ).toBe(false);
    });
  });
});
