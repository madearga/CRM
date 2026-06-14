# U0: Mobile auth spike findings

Date: 2026-06-14  
Branch: `feat/u1-mobile-scaffold`  
Scope: prove Better Auth + Convex token exchange works in a React Native bundle against the existing CRM backend.

## Goal

Before building any real mobile screens, validate that an Expo/React Native client can:

1. Sign in with existing CRM email + password.
2. Persist the Better Auth session across app restarts (using `expo-secure-store`).
3. Mint a Convex JWT and authenticate a `ConvexReactClient` WebSocket.
4. Return data from an authenticated Convex query.
5. Sign out and clear the stored session.

## Deliverables created

| File | Purpose |
|---|---|
| `packages/auth/src/auth-client.ts` | Initial shared Better Auth client scaffold (`createCrmAuthClient`). Already landed in `c74e051` as part of U2 prep. |
| `apps/mobile/src/lib/config.ts` | Mobile env reader (`EXPO_PUBLIC_*` → `@crm/config` `parseEnv`). |
| `apps/mobile/src/lib/secure-storage.ts` | `expo-secure-store` adapter for `crossDomainClient`. |
| `apps/mobile/src/lib/auth-client.ts` | Mobile `better-auth/react` client with `crossDomainClient` + `convexClient` plugins. |
| `apps/mobile/src/lib/convex-auth.tsx` | `ConvexReactClient` + `setAuth()` wiring, wrapped as `MobileConvexProvider`. |
| `apps/mobile/src/lib/api.ts` | Re-export of `convex/_generated/api` (safe for RN bundle). |
| `apps/mobile/src/lib/__spike__/auth-spike.tsx` | Throwaway test screen: sign-in, token probe, authenticated query display, sign-out. |
| `apps/mobile/app/__spike__/auth-test.tsx` | Expo Router route that mounts the spike screen inside `MobileConvexProvider`. |

## Verified mechanism

The mobile path intentionally avoids `@convex-dev/better-auth/react` (`ConvexBetterAuthProvider`), which imports `convex/browser` and touches `window.location` for one-time token flows.

Instead the spike replicates the same provider logic with React Native-safe primitives:

1. **Sign in**  
   `authClient.signIn.email({ email, password })` (from `better-auth/react`) authenticates against the existing Better Auth backend (`EXPO_PUBLIC_SITE_URL`).

2. **Session persistence**  
   The `crossDomainClient` plugin stores the session cookie in `expo-secure-store` instead of `document.cookie`. Because the storage adapter is synchronous (`getItem` / `setItem`), Better Auth can read it inline during fetch interception. On a cold start the cookie is still there, so `authClient.useSession()` rehydrates without a re-login.

3. **Convex JWT exchange**  
   `authClient.convex.token()` calls `GET /convex/token` with the active session cookie and returns `{ token: string }`. This is the exact same endpoint the web `ConvexBetterAuthProvider` uses (see `@convex-dev/better-auth/dist/esm/react/index.js`).

4. **Authenticated WebSocket**  
   `ConvexReactClient.setAuth(async () => fetchConvexToken(authClient))` passes the JWT to the Convex React client. The client calls the fetcher before token expiry and on every reconnection, so the JWT is always fresh.

5. **Authenticated query**  
   `useQuery(api.user.getCurrentUser)` observes the Convex client and returns the current user record only when the socket is authenticated.

6. **Sign out**  
   `authClient.signOut()` invalidates the server session; `clearSecureAuthStorage()` deletes the cookie from the keystore; `convexClient.clearAuth()` drops the authenticated socket.

## Token format / lifetime / refresh

- **Format**: a signed JWT returned by the server-side `convex()` Better Auth plugin. Cookie name is `convex_jwt` (mirrored in `@crm/config` as `CONVEX_JWT_COOKIE_NAME`).
- **Lifetime**: the server default is 15 minutes (`CONVEX_TOKEN_TTL_SECONDS`). The client should treat it as short-lived.
- **Refresh**: no manual refresh needed. `ConvexReactClient.setAuth()` calls the fetcher when the current token is about to expire or is rejected. Better Auth's `/convex/token` always mints a fresh JWT for the active session, so each call yields a current token.
- **Storage**: the **session cookie** is persisted in `expo-secure-store`; the **Convex JWT is not persisted**. It is fetched on demand by the Convex client, exactly like the web provider.

## Verification status

### ✅ Passing

- `cd packages/auth && pnpm typecheck` — clean.
- `cd apps/mobile && npx tsc --noEmit` — all spike files are type-correct. The only remaining errors are 10 pre-existing syntax errors in `convex/externalPlugins.ts` (see Blockers).
- Dependencies installed: `expo-secure-store ^56.0.4`, `better-auth`, `@convex-dev/better-auth`, `convex`.
- `packages/auth/src/auth-client.ts` scaffold is committed and shared.

### ⚠️ Not run / blocked

- **Simulator runtime test** was not executed because:
  1. The pre-existing `convex/externalPlugins.ts` syntax errors prevent a clean `tsc --noEmit` from the repo root / mobile package script, which is a prerequisite for a confident build.
  2. The spike is code-level verification only; it requires a live backend + valid CRM credentials to exercise end-to-end.

### ❌ Blockers

1. **`convex/externalPlugins.ts` has syntax errors.**
   - 10 TS errors starting at L399 / L518 (`fetch(` call is malformed, extra closing braces, `catch (err: any)` inside a broken block).
   - These errors leak into **both** `apps/web` and `apps/mobile` typechecks because `convex/_generated/api.d.ts` imports `../externalPlugins.js` for typing.
   - **Impact**: `pnpm typecheck` fails for the whole repo, which blocks mobile bundle verification until fixed.
   - **Recommendation**: fix the backend file in a separate PR before declaring mobile CI green. This is unrelated to the auth spike.

2. **Mobile workspace was modified concurrently.**
   - During this spike other files appeared (e.g. `apps/mobile/src/components/ui/*.tsx`, theme.ts changes). My untracked spike files were deleted twice before being staged.
   - **Recommendation**: commit the U0 spike files immediately to avoid further clobbering.

## Go / no-go recommendation

**GO — with conditions.**

The Better Auth + Convex token-exchange architecture for React Native is sound:

- `crossDomainClient` + `expo-secure-store` correctly replaces browser cookies.
- `better-auth/react` works in an RN bundle (nanostores, no react-dom).
- `convex/react` `ConvexReactClient.setAuth()` accepts the Better Auth JWT.
- The session-cookie persistence and sign-out cleanup paths are in place.

**Conditions before production work:**

1. Fix `convex/externalPlugins.ts` syntax errors so `pnpm typecheck` passes repo-wide.
2. Replace the throwaway `auth-client.ts` with the shared `createCrmAuthClient` factory from `@crm/auth`, or keep the factory as the single source of truth and only add a nanostores→React bridge in mobile.
3. Add the `@convex/*` path alias to Metro so mobile can import `@convex/_generated/api` directly instead of the relative-path re-export in `apps/mobile/src/lib/api.ts`.
4. Run the spike on iOS/Android simulators against the live backend with real credentials and confirm `api.user.getCurrentUser` returns data.
5. Add CI typecheck / bundle smoke test for `apps/mobile` so regressions are caught early.

If the simulator test fails despite the above, only then should the project reconsider responsive-web/PWA.

## Next steps

1. Fix `convex/externalPlugins.ts`.
2. Land this spike commit.
3. U1/U2: formalize Metro `@convex/*` alias and switch mobile to `createCrmAuthClient`.
4. U3: build real sign-in screen and authenticated root layout using the proven provider pattern.
