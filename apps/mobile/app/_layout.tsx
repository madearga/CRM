import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/**
 * Root layout for the mobile app.
 *
 * U1 only ships a hello-world screen. Auth gating, providers, and safe-area
 * scaffolding arrive in later units (U3/U4).
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
