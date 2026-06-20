/**
 * Auth route group layout.
 *
 * No bottom tab bar here — the (auth) group is pre-authentication chrome only
 * (login, and later sign-up / forgot-password). Screens render full-bleed with
 * the header hidden; safe-area insets are handled per-screen.
 */
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
