# @crm/mobile

React Native + Expo companion app for the CRM, built inside the Turborepo.

- **Expo SDK 54** (React Native 0.81.x) — chosen because the root repo pins **React 19.1.1**; SDK 53+ is the first Expo line compatible with React 19.
- **NativeWind v4** (Tailwind) as the primary styling system; plain `StyleSheet` + `src/styles/theme.ts` tokens are the documented fallback.
- **Expo Router** (file-based routes under `app/`).
- Shares `@crm/domain`, `@crm/auth`, `@crm/config` from the workspace.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` / `pnpm start` | Start Expo dev server (`expo start`). |
| `pnpm ios` | Start on iOS simulator. |
| `pnpm android` | Start on Android emulator. |
| `pnpm web` | Start the web target (Metro). |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm bundle:analyze` | Visualize the JS bundle. |

Run from the repo root with Turborepo (`pnpm dev` runs all `dev` tasks) or scoped:

```bash
cd apps/mobile && pnpm dev
```

> **Package manager:** `@crm/mobile` no longer pins its own `packageManager` field; it inherits the workspace root's package manager (currently `pnpm`). When the root workspace migrates to Bun, these commands switch to `bun run` automatically.

## Workspace imports

Metro is configured (`metro.config.js`) to resolve the pnpm workspace so you can import shared packages directly:

```ts
import { DEAL_STAGES } from "@crm/domain";
```

This works because:
1. `pnpm-workspace.yaml` includes `apps/*` and `packages/*` and sets `publicHoistPattern: ["*"]` (see below).
2. `metro.config.js` sets `watchFolders`, `nodeModulesPaths`, symlink support, and disables hierarchical lookup.

## pnpm hoist pattern (workspace root)

`pnpm-workspace.yaml` declares:

```yaml
publicHoistPattern: ["*"]
```

This hoists every dependency to the workspace root `node_modules/`. It is the configuration recommended by the Expo team for monorepos ([docs.expo.dev/guides/monorepos](https://docs.expo.dev/guides/monorepos/)) because React Native's build graph references hundreds of transitive deps via `require()` (e.g. `react-native/index.js` → `invariant`, `fbjs`, `react-native-css-interop`, `expo-modules-core`, `whatwg-fetch`, `react-native-worklets`). Listing them one-by-one is impossible to maintain — every SDK / minor bump adds new ones.

The web app is unaffected: Next.js resolves through its own node_modules tree and the hoisted packages are simply an extra `node_modules/.pnpm/...` symlink target.

## Browser-only blocklist

`metro.config.js` hard-fails the build if any browser-only transitive dependency tries to enter the native bundle:

`next`, `sonner`, `recharts`, `vaul`, `tailwindcss` (build-time only), `@radix-ui/*` **except `@radix-ui/react-slot`**.

This protects the mobile bundle from accidentally pulling in web-only code via shared packages. If you see a Metro resolution error for one of these, a shared module is importing web-only code — refactor it out rather than removing the blocklist entry.

### `@radix-ui/react-slot` is aliased to a local RN stub

`expo-router@5.1.11/build/ui/Slot.js` `require()`s `@radix-ui/react-slot`, which is a web-only package. The upstream Slot runtime that RN actually uses is Expo Router's own RN implementation; this file is never called at runtime on a mobile build. Metro's resolver insists the require resolves, so `metro.config.js` rewrites `@radix-ui/react-slot` to `mocks/react-slot.tsx` (a no-op `({children}) => children` component). The web app keeps importing the real package.

## NativeWind v4

- `global.css` is processed by `nativewind/metro` (`withNativeWind`) and imported once in `app/_layout.tsx`.
- `babel.config.js` sets `jsxImportSource: "nativewind"`.
- `babel.nativewind.js` is a **local preset** that replaces the upstream `nativewind/babel` preset. It was introduced when the app shipped Reanimated 3.x; SDK 54 now bundles Reanimated 4.x, so the rationale is stale. The app **runs and is validated end-to-end** with this preset in place (see Status), but a future cleanup should re-evaluate whether the upstream `nativewind/babel` preset can be used directly.
- `tailwind.config.js` uses the `nativewind/preset` and mobile-only `content` globs.
- Design tokens mirror `../../DESIGN.md` and `src/styles/theme.ts`.

### Fallback to StyleSheet

If NativeWind ever conflicts with a future React/Expo bump, screens can drop className and use `StyleSheet.create` with tokens from `src/styles/theme.ts` without changing the visual system. Keep `tailwind.config.js` colors and `theme.ts` colors in sync.

## EAS internal distribution (U9)

The app ships via **EAS Build** with three profiles defined in [`eas.json`](./eas.json):

| Profile | Distribution | Dev client | Purpose |
| --- | --- | --- | --- |
| `development` | internal (`simulator: true` / `apk`) | ✅ | Day-to-day dev builds against a dev Convex deployment. |
| `preview` | internal (TestFlight internal testers + ad-hoc APK) | ❌ | Stakeholder QA builds — the **primary MVP distribution profile**. |
| `production` | App Store / Play Store archive | ❌ | Production-signed binary. **Does not auto-submit** — public store submission is deferred past MVP. |

### Prerequisites checklist

Before the first build, the following must exist (identify owners before running `eas build`):

- [ ] **Apple Developer Program** account (Team Agent) — owner: _TBD_. Needed for iOS signing + TestFlight internal testing.
- [ ] **Google Play Console** account — owner: _TBD_. Needed for the Android internal testing track.
- [ ] **EAS project** — run `cd apps/mobile && eas init` once. This creates the Expo project and writes `extra.eas.projectId` into `app.json` (currently the placeholder `REPLACE_AFTER_EAS_INIT`).
- [ ] **`EXPO_TOKEN`** secret in the GitHub repo (`Settings → Secrets and variables → Actions`) — a token from an Expo account that has access to the EAS project. Used by the CI workflow.
- [ ] **Tester lists** — Apple TestFlight internal testers (max 100) and Google Play internal testers (Google Group email list).
- [ ] **Placeholder icon/splash replaced** — `assets/icon.png`, `assets/adaptive-icon.png`, and `assets/splash.png` are currently solid-color placeholders. Drop branded assets in (same filenames/sizes) before a stakeholder build.

### Build commands

First-time EAS project setup (run once, from `apps/mobile`):

```bash
cd apps/mobile
eas login            # or set EXPO_TOKEN
eas init             # creates project, writes projectId into app.json
eas build:configure  # optional: reconfigure profiles interactively
```

Local build (no CI):

```bash
# Preview build for stakeholders (primary MVP profile)
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Dev-client build for development
eas build --profile development --platform ios

# Production archive (does NOT submit to stores)
eas build --profile production --platform ios
```

CI builds on push to `main` and via manual dispatch — see [`.github/workflows/deploy-mobile.yml`](../../.github/workflows/deploy-mobile.yml). Pull requests run `typecheck` only (no paid build).

### Environment variable mapping

EAS Build inlines any `EXPO_PUBLIC_*` variable into the JS bundle at build time. The mapping from shared `@crm/config` names to the mobile `EXPO_PUBLIC_*` names (see [`src/lib/config.ts`](./src/lib/config.ts)) is:

| `@crm/config` name | Mobile bundle var | Classification | Where it lives |
| --- | --- | --- | --- |
| `CONVEX_URL` | `EXPO_PUBLIC_CONVEX_URL` | **Public** (embedded in bundle) | `eas.json` `env` or EAS secret |
| `CONVEX_SITE_URL` | `EXPO_PUBLIC_CONVEX_SITE_URL` | **Public** (embedded in bundle) | `eas.json` `env` or EAS secret |
| `SITE_URL` *(== plan's `BETTER_AUTH_URL`)* | `EXPO_PUBLIC_SITE_URL` | **Public** (embedded in bundle) | `eas.json` `env` or EAS secret |
| `BETTER_AUTH_SECRET` | _(none — never prefixed `EXPO_PUBLIC_`)_ | **Server-only** | Stays in Convex / Better Auth server. **MUST NOT reach the bundle.** |
| signing credentials | _(managed by EAS / credentials.json)_ | **Build-only secret** | EAS credentials; never in repo or bundle |

`eas.json` currently carries `REPLACE_WITH_*` placeholder strings in each profile's `env`. Replace them with the real per-environment URLs, **or** (recommended for production) create them as EAS secrets so the values are not committed:

```bash
eas secret:create --name EXPO_PUBLIC_CONVEX_URL       --value https://<prod>.convex.cloud
eas secret:create --name EXPO_PUBLIC_CONVEX_SITE_URL  --value https://<prod>.convex.site
eas secret:create --name EXPO_PUBLIC_SITE_URL         --value https://app.example.com
```

> **Guardrail:** never create an EAS secret whose name starts with `EXPO_PUBLIC_BETTER_AUTH_SECRET`. Any `EXPO_PUBLIC_*` var is inlined into the client bundle and would leak the server secret. `BETTER_AUTH_SECRET` is consumed only by the Convex backend and Better Auth server.

### `.easignore`

[`.easignore`](./.easignore) excludes the web app, docs, and build artifacts from the EAS context upload while keeping `packages/*` (required because the mobile bundle imports `@crm/domain`, `@crm/auth`, `@crm/config`).

## Verification (run from `apps/mobile`)

```bash
pnpm install        # at repo root first
pnpm typecheck      # passes
pnpm dev            # `expo start` boots without Metro resolution errors
npx expo export --platform ios   # produces dist/_expo/static/js/ios/entry-*.hbc (~4 MB, 1292 modules)
```

The blocklist is exercised by temporarily adding e.g. `import 'next/image';` to any file under `app/` and re-running `npx expo export --platform ios` — Metro fails fast with `Unable to resolve module next/image`.

## Status

**MVP validated end-to-end; hardening complete; distribution deferred pending accounts.**

- **U0–U8 complete & verified.** The app runs in Expo Go on iPhone via Metro over Tailscale, and passed all 12 smoke-test screens (login → dashboard → activities create/list → invoices list/detail read-only → settings/sign-out → offline banner → empty states). See `docs/plans/mobile-mvp-smoke-results.md`.
- **Hardening phase (2026-06-20):** `format-date` guarded against bad inputs + regression tests; `isInvoiceOverdue` classifier regression tests; security posture verified (SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no unencrypted PII cache, screenshot/app-switcher protection on the invoice detail screen via `expo-screen-capture`). See `docs/plans/2026-06-20-mobile-mvp-hardening-and-distribution.md`.
- **U9 — EAS distribution configured** (profiles in `eas.json`, CI workflow `.github/workflows/deploy-mobile.yml`, `app.json`, placeholder assets), **but NOT yet built.** The first real build is blocked on:
  - `eas login` + `eas init` (writes a real `projectId`; replace the `REPLACE_AFTER_EAS_INIT` placeholder).
  - Replacing the `REPLACE_WITH_*` env placeholders in `eas.json` (or moving them to EAS secrets).
  - For **iOS device / TestFlight** installs: an **Apple Developer Program** account ($99/yr) for code signing. *(iOS Simulator builds are free and need no Apple account.)*
  - For **Play Store** publishing: a **Google Play Console** account ($25). *(A standalone **Android APK** can be built and sideloaded with no account at all — this is the cheapest path to a shareable binary today.)*
- **Deep-link scheme:** `crmmobile://` is declared in `app.json` and listed in Convex trusted origins for standalone builds; Expo Go dev uses `exp://`. See the T6 decision note in the smoke-results doc.
