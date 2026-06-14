/**
 * U0: Mobile auth proof-of-concept spike screen.
 *
 * Throwaway screen that proves the full loop:
 *
 *   Email + password sign-in
 *   -> Better Auth session persisted in expo-secure-store
 *   -> Convex JWT minted via `authClient.convex.token()`
 *   -> Authenticated Convex query returns data
 *   -> Sign-out clears session + keystore
 *
 * This file is intentionally self-contained and is NOT production code.
 * Delete after U0 go/no-go is recorded.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from 'convex/react';

import { fetchConvexToken } from '@crm/auth';

import { api } from '@/lib/api';
import { authClient, signIn, signOut } from '@/lib/auth-client';
import { convexClient } from '@/lib/convex-auth';
import { clearSecureAuthStorage } from '@/lib/secure-storage';

export default function AuthSpikeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  // `useSession` from better-auth/react drives UI loading / signed-in state.
  const {
    data: session,
    isPending: isSessionPending,
    error: sessionError,
  } = authClient.useSession();

  // This query is *authenticated*: Convex sends the JWT returned by
  // ConvexReactClient.setAuth(). If the loop works, we get the current user;
  // if not, the query errors or returns null.
  const currentUser = useQuery(api.user.getCurrentUser);

  const handleSignIn = useCallback(async () => {
    setError(null);
    setLastFetch(null);
    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'Sign-in failed');
        return;
      }

      // After sign-in, immediately exercise the token endpoint. This is the
      // mobile equivalent of `ConvexBetterAuthProvider`'s fetchAccessToken.
      const token = await fetchConvexToken(authClient);
      setLastToken(token ? `${token.slice(0, 12)}…` : 'null');

      if (!token) {
        setError('Sign-in succeeded but Convex token was empty');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [email, password]);

  const handleSignOut = useCallback(async () => {
    setError(null);
    setLastToken(null);
    try {
      await signOut();
      // Also scrub the keystore so a restart doesn't reuse the session.
      clearSecureAuthStorage();
      // Tell Convex to drop the authenticated socket.
      convexClient.clearAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleProbeToken = useCallback(async () => {
    setLastFetch(new Date().toISOString());
    try {
      const token = await fetchConvexToken(authClient);
      setLastToken(token ? `${token.slice(0, 12)}…` : 'null');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Surface async Better Auth errors (e.g. expired session after restart).
  useEffect(() => {
    if (sessionError) {
      setError(sessionError.message ?? 'Session error');
    }
  }, [sessionError]);

  const isAuthenticated = !!session?.session;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        paddingTop: 80,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>
        U0 Auth Spike
      </Text>

      <Text style={{ color: '#666' }}>
        This screen proves Better Auth + Convex token exchange works in a
        React Native bundle. Enter existing CRM credentials to test.
      </Text>

      {isSessionPending ? (
        <Text>Restoring session…</Text>
      ) : isAuthenticated ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: 'green', fontWeight: '600' }}>
            Authenticated ✓
          </Text>
          <Text>User: {session.user?.email ?? '—'}</Text>
          <Text>Session ID: {session.session?.id?.slice(0, 12) ?? '—'}…</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={inputStyle}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={inputStyle}
            value={password}
          />
          <Button onPress={handleSignIn} title="Sign in with email" />
        </View>
      )}

      {error ? (
        <Text style={{ color: 'red' }}>Error: {error}</Text>
      ) : null}

      <View style={{ marginTop: 16, gap: 8 }}>
        <Button
          disabled={!isAuthenticated}
          onPress={handleProbeToken}
          title="Probe Convex token"
        />
        {lastToken ? <Text>Last token: {lastToken}</Text> : null}
        {lastFetch ? <Text>Last fetch: {lastFetch}</Text> : null}
      </View>

      <View style={{ marginTop: 16, gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>
          Authenticated Convex query result:
        </Text>
        <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {currentUser === undefined
            ? 'Loading…'
            : currentUser === null
              ? 'null (unauthenticated or no user)'
              : JSON.stringify(currentUser, null, 2)}
        </Text>
      </View>

      {isAuthenticated ? (
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            marginTop: 24,
            padding: 12,
            backgroundColor: '#ef4444',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            Sign out + clear secure storage
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const inputStyle = {
  borderColor: '#d1d5db',
  borderWidth: 1,
  borderRadius: 8,
  padding: 12,
};
