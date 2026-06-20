/**
 * Standalone Convex React client for the mobile app.
 *
 * Created from `convex/react` (RN-safe — no `convex/browser`, `window`, or
 * `localStorage`). Lives *outside* React so any provider remount reuses the
 * same underlying WebSocket connection; the companion `ConvexProvider`
 * (`convex-provider.tsx`) installs the Better Auth token fetcher on it and
 * wraps children in `<ConvexProvider>`.
 *
 * The `CONVEX_URL` is validated up-front by `@crm/config`'s `parseEnv`, so a
 * missing deployment URL fails fast at first access rather than mid-handshake.
 *
 * @see docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md U3
 */
import { ConvexReactClient } from 'convex/react';

import { mobileEnv } from './config';

/**
 * Shared client instance. Import this directly in non-React code (e.g. an
 * imperative sign-out that needs to call `clearAuth()`); inside the tree use
 * `useConvex()` from `@/hooks/use-convex`.
 */
export const convexClient = new ConvexReactClient(mobileEnv().CONVEX_URL, {
  verbose: false,
});
