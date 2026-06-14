/**
 * Auth route group layout.
 *
 * No bottom tab bar here — the (auth) group is pre-authentication chrome only
 * (login, and later sign-up / forgot-password). Screens render full-bleed with
 * the header hidden; safe-area insets are handled per-screen.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
