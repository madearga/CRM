'use client';

import React, { type ReactNode } from 'react';

import type { api } from '@convex/_generated/api';

import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { type Preloaded, ConvexReactClient } from 'convex/react';

import { env } from '@/env';
import { authClient, useSession } from '@/lib/convex/auth-client';
import { AuthErrorBoundary } from '@/lib/convex/components/auth-error-boundary';
import { QueryClientProvider } from '@/lib/react-query/query-client-provider';

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL, {
  verbose: false,
});

type AuthState = {
  preloadedUser: Preloaded<typeof api.user.getCurrentUser> | null;
  token: string | null;
};

type AuthStore = {
  set: <K extends keyof AuthState>(key: K, value: AuthState[K]) => void;
  state: AuthState;
};

const AuthContext = React.createContext<AuthStore | null>(null);

export function AuthProvider({
  children,
  preloadedUser,
  token,
}: {
  children: ReactNode;
  preloadedUser?: Preloaded<typeof api.user.getCurrentUser>;
  token?: string | null;
}) {
  const [state, setState] = React.useState<AuthState>({
    preloadedUser: preloadedUser ?? null,
    token: token ?? null,
  });

  const set = React.useCallback(<K extends keyof AuthState>(key: K, value: AuthState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = React.useMemo<AuthStore>(() => ({ set, state }), [set, state]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthEffect />
    </AuthContext.Provider>
  );
}

export function useAuthStore() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthStore must be used within AuthProvider');
  }
  return context;
}

export function useAuthValue<K extends keyof AuthState>(key: K): AuthState[K] {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthValue must be used within AuthProvider');
  }
  return context.state[key];
}

export function ConvexProvider({
  children,
  preloadedUser,
  token,
}: {
  children: ReactNode;
  preloadedUser?: Preloaded<typeof api.user.getCurrentUser>;
  token?: string;
}) {
  return (
    <ConvexBetterAuthProvider authClient={authClient} client={convex}>
      <QueryClientProvider convex={convex}>
        <ConvexProviderInner preloadedUser={preloadedUser} token={token}>
          {children}
        </ConvexProviderInner>
      </QueryClientProvider>
    </ConvexBetterAuthProvider>
  );
}

function ConvexProviderInner({
  children,
  preloadedUser,
  token,
}: {
  children: ReactNode;
  preloadedUser?: Preloaded<typeof api.user.getCurrentUser>;
  token?: string;
}) {
  return (
    <AuthProvider preloadedUser={preloadedUser} token={token ?? null}>
      <AuthErrorBoundary>{children}</AuthErrorBoundary>
    </AuthProvider>
  );
}

function AuthEffect() {
  const { data, isPending } = useSession();
  const { set } = useAuthStore();

  React.useEffect(() => {
    if (!isPending) {
      set('token', data?.session.token ?? null);
    }
  }, [data, set, isPending]);

  return null;
}
