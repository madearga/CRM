/**
 * Mobile AuthProvider — the bridge between Better Auth's reactive session atom
 * and the pure {@link authStateReducer}.
 *
 * Responsibilities:
 *  1. Launch: subscribe to `authClient.useSession()`. While it revalidates the
 *     stored cookie, the machine stays `initializing` (splash/spinner). Once
 *     resolved it dispatches `SESSION_RESOLVED` → `authenticated` (auto-login)
 *     or `unauthenticated` (login screen).
 *  2. Sign-in: dispatch `SIGN_IN_REQUEST`, call `signIn.email`, and on error
 *     dispatch `SIGN_IN_FAILURE` (surfaced inline on the login screen). On
 *     success the `useSession` subscription drives `SESSION_RESOLVED`.
 *  3. Sign-out: server sign-out (best-effort) → clear secure storage → reset
 *     Convex auth → `SIGN_OUT_COMPLETE`.
 *  4. Revoked token (app resumed with a dead/expired session): `useSession`
 *     returns an error → dispatch `TOKEN_REVOKED` + scrub secure storage so
 *     the next launch doesn't retry a poisoned cookie.
 *
 * Navigation is driven by `useAuth().status` in the root layout's
 * `<Redirect>` logic — this provider deliberately stays free of Expo Router
 * imports so the reducer remains the single source of truth.
 *
 * @see docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md U3
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import type { SessionUser } from '@crm/auth';

import { authClient, signOut as authSignOut, useSession } from '@/lib/auth-client';
import { convexClient } from '@/lib/convex-client';
import { clearSecureAuthStorage } from '@/lib/secure-storage';

import {
  authStateReducer,
  initialAuthState,
  type AuthMachineState,
  type AuthSession,
  type AuthStatus,
} from './auth-machine';

export interface SignInResult {
  ok: boolean;
  error?: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  error: string | null;
  user: SessionUser | null;
  session: AuthSession | null;
  /** True only while the launch-time session check is in flight. */
  isInitializing: boolean;
  /** Sign in with email + password. Returns a normalized result. */
  signInEmail: (email: string, password: string) => Promise<SignInResult>;
  /** Server sign-out → clear storage → reset Convex auth. */
  signOut: () => Promise<void>;
  /** Dismiss the inline login error. */
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthSession(data: unknown): AuthSession | null {
  if (!data || typeof data !== 'object') return null;
  const v = data as { session?: unknown; user?: unknown };
  if (!v.session || !v.user) return null;
  const s = v.session as Record<string, unknown>;
  const u = v.user as Record<string, unknown>;
  if (typeof s.id !== 'string' || typeof u.id !== 'string' || typeof u.email !== 'string') {
    return null;
  }
  return {
    session: { ...s, id: s.id } as AuthSession['session'],
    user: { ...u, id: u.id, email: u.email } as SessionUser,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authStateReducer, initialAuthState);

  // Better Auth's reactive session atom. `{ data, isPending, error }`.
  const sessionSignal = useSession();

  // Drive the machine from the authoritative server signal. Exactly one event
  // per change: error → revoked; otherwise resolved (with or without session).
  const { data, isPending, error } = sessionSignal;
  useEffect(() => {
    if (isPending) return; // still revalidating — hold `initializing`.
    if (error) {
      // Expired/invalid session cookie surfaced as a fetch error. Scrub local
      // state so the next cold start doesn't reuse a poisoned session.
      clearSecureAuthStorage();
      dispatch({ type: 'TOKEN_REVOKED' });
      return;
    }
    dispatch({ type: 'SESSION_RESOLVED', session: toAuthSession(data) });
  }, [data, isPending, error]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SIGN_IN_REQUEST' });
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        const message = result.error.message ?? 'Sign-in failed';
        dispatch({ type: 'SIGN_IN_FAILURE', error: message });
        return { ok: false, error: message };
      }
      // Success: the useSession subscription will dispatch SESSION_RESOLVED.
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      dispatch({ type: 'SIGN_IN_FAILURE', error: message });
      return { ok: false, error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    dispatch({ type: 'SIGN_OUT_REQUEST' });
    try {
      // Best-effort server sign-out; a network failure must not strand local
      // state, so we always clear storage + Convex auth below.
      await authSignOut();
    } catch {
      /* ignore — local cleanup is mandatory regardless */
    } finally {
      clearSecureAuthStorage();
      convexClient.clearAuth();
      dispatch({ type: 'SIGN_OUT_COMPLETE' });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const session = toAuthSession(data);
    return {
      status: state.status,
      error: state.error,
      user: session?.user ?? null,
      session,
      isInitializing: state.status === 'initializing',
      signInEmail,
      signOut,
      clearError,
    };
  }, [state.status, state.error, data, signInEmail, signOut, clearError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the mobile auth state machine. Throws if used outside the provider. */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within <AuthProvider>');
  }
  return ctx;
}

/** Re-export the machine state type for consumers that need it. */
export type { AuthMachineState };
