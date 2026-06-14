/**
 * Pure, framework-agnostic auth state machine.
 *
 * This module contains ZERO React / React Native / Better Auth runtime
 * imports — only the shared {@link Session}/{@link SessionUser} *types* from
 * `@crm/auth`. That makes the reducer unit-testable in plain Node (vitest)
 * without a JSOM / RN polyfill environment.
 *
 * The {@link AuthProvider} subscribes to Better Auth's reactive `useSession`
 * atom and dispatches {@link AuthEvent}s into {@link authStateReducer}. The
 * resulting {@link AuthMachineState.status} drives Expo Router navigation:
 *
 *   initializing   → splash / spinner
 *   authenticated  → (app) group
 *   unauthenticated→ (auth)/login
 *   signingIn      → login screen w/ spinner (button disabled)
 *   signingOut     → dashboard w/ spinner
 *
 * @see docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md U3
 */

import type { Session, SessionUser } from '@crm/auth';

/** Coarse-grained lifecycle phase the app is currently in. */
export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'signingIn'
  | 'signingOut';

/** A validated Better Auth `{ session, user }` payload. */
export interface AuthSession {
  user: SessionUser;
  session: Session;
}

/** Full machine state. `error` carries the last sign-in failure message. */
export interface AuthMachineState {
  status: AuthStatus;
  error: string | null;
}

/**
 * Discrete events the provider dispatches. Mapping from Better Auth signals:
 *
 *  - `SESSION_RESOLVED`  — `useSession` finished its (re)validation pass.
 *  - `SIGN_IN_REQUEST`   — user tapped "Sign in".
 *  - `SIGN_IN_SUCCESS`   — `signIn.email` resolved with a session.
 *  - `SIGN_IN_FAILURE`   — `signIn.email` rejected / returned an error.
 *  - `SIGN_OUT_REQUEST`  — user tapped "Sign out".
 *  - `SIGN_OUT_COMPLETE` — secure storage cleared + Convex auth reset.
 *  - `TOKEN_REVOKED`     — session invalidated out-of-band (expired/revoked,
 *                          e.g. app resumed from background with a dead token).
 *  - `CLEAR_ERROR`       — dismiss the inline login error.
 */
export type AuthEvent =
  | { type: 'SESSION_RESOLVED'; session: AuthSession | null }
  | { type: 'SIGN_IN_REQUEST' }
  | { type: 'SIGN_IN_SUCCESS'; session: AuthSession }
  | { type: 'SIGN_IN_FAILURE'; error: string }
  | { type: 'SIGN_OUT_REQUEST' }
  | { type: 'SIGN_OUT_COMPLETE' }
  | { type: 'TOKEN_REVOKED' }
  | { type: 'CLEAR_ERROR' };

/** Entry state: assume a session *might* exist until the first resolution. */
export const initialAuthState: AuthMachineState = {
  status: 'initializing',
  error: null,
};

/**
 * Reduce one auth event into the next state.
 *
 * Transitions are deliberately permissive for re-entrancy safety: a late
 * `SESSION_RESOLVED` always wins (the server is the source of truth), and
 * `TOKEN_REVOKED` forces back to the login screen from any authenticated-ish
 * state. `SIGN_IN_REQUEST` is ignored while already `signingIn`/`signingOut`
 * to guard against double-taps.
 */
export function authStateReducer(
  state: AuthMachineState,
  event: AuthEvent,
): AuthMachineState {
  switch (event.type) {
    case 'SESSION_RESOLVED': {
      // The server has spoken. This is the authoritative state on cold start
      // and after every foreground revalidation.
      return {
        status: event.session ? 'authenticated' : 'unauthenticated',
        error: null,
      };
    }

    case 'SIGN_IN_REQUEST': {
      // Only allow starting a sign-in from a screen the user can act on.
      // Ignore if a request is already in flight (double-tap guard).
      if (state.status === 'signingIn' || state.status === 'signingOut') {
        return state;
      }
      return { status: 'signingIn', error: null };
    }

    case 'SIGN_IN_SUCCESS': {
      return { status: 'authenticated', error: null };
    }

    case 'SIGN_IN_FAILURE': {
      // Return the user to the login screen with the failure surfaced.
      return { status: 'unauthenticated', error: event.error };
    }

    case 'SIGN_OUT_REQUEST': {
      // Only meaningful once authenticated; ignore otherwise.
      if (state.status !== 'authenticated') {
        return state;
      }
      return { status: 'signingOut', error: null };
    }

    case 'SIGN_OUT_COMPLETE': {
      return { status: 'unauthenticated', error: null };
    }

    case 'TOKEN_REVOKED': {
      // An external invalidation (expired/revoked token on resume) always
      // returns the user to the login screen and clears any stale error so
      // the UI shows a clean login form rather than a phantom failure.
      return { status: 'unauthenticated', error: null };
    }

    case 'CLEAR_ERROR': {
      if (state.error === null) return state;
      return { ...state, error: null };
    }

    default: {
      // Exhaustiveness guard: a new event type was added without a case.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}

/** Convenience selector: is the app waiting on any async auth work? */
export function isAuthBusy(state: AuthMachineState): boolean {
  return (
    state.status === 'initializing' ||
    state.status === 'signingIn' ||
    state.status === 'signingOut'
  );
}
