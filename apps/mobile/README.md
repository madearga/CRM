# @crm/mobile

React Native + Expo companion app for the CRM, built inside the Turborepo.

- **Expo SDK 53** (React Native 0.79.x) — chosen because the root repo pins **React 19.1.1**, and SDK 53 is the first Expo release compatible with React 19.
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
- `babel.nativewind.js` is a **local preset** that replaces the upstream `nativewind/babel` preset. The upstream preset hardcodes `"react-native-worklets/plugin"` (Reanimated **4+**), but SDK 53 ships Reanimated 3.x. Our local preset uses `"react-native-reanimated/plugin"` instead and resolves the css-interop babel plugin through the `nativewind` package path. When the app upgrades to Reanimated 4+, delete `babel.nativewind.js` and switch back to `"nativewind/babel"` in `babel.config.js`.
- `tailwind.config.js` uses the `nativewind/preset` and mobile-only `content` globs.
- Design tokens mirror `../../DESIGN.md` and `src/styles/theme.ts`.

### Fallback to StyleSheet

If NativeWind ever conflicts with a future React/Expo bump, screens can drop className and use `StyleSheet.create` with tokens from `src/styles/theme.ts` without changing the visual system. Keep `tailwind.config.js` colors and `theme.ts` colors in sync.

## Status

**U1 — scaffold complete.** Only a hello-world screen (`app/index.tsx`) is shipped. Auth providers, navigation tabs, and feature screens arrive in later units (U3+).

## Verification (run from `apps/mobile`)

```bash
pnpm install        # at repo root first
pnpm typecheck      # passes
pnpm dev            # `expo start` boots without Metro resolution errors
npx expo export --platform ios   # produces dist/_expo/static/js/ios/entry-*.hbc (~4 MB, 1292 modules)
```

The blocklist is exercised by temporarily adding e.g. `import 'next/image';` to any file under `app/` and re-running `npx expo export --platform ios` — Metro fails fast with `Unable to resolve module next/image`.
