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
1. `pnpm-workspace.yaml` includes `apps/*` and `packages/*`.
2. `metro.config.js` sets `watchFolders`, `nodeModulesPaths`, symlink support, and disables hierarchical lookup.

## Browser-only blocklist

`metro.config.js` hard-fails the build if any browser-only transitive dependency tries to enter the native bundle:

`next`, `sonner`, `recharts`, `vaul`, `tailwindcss` (build-time only), `@radix-ui/*`.

This protects the mobile bundle from accidentally pulling in web-only code via shared packages. If you see a Metro resolution error for one of these, a shared module is importing web-only code — refactor it out rather than removing the blocklist entry.

## NativeWind v4

- `global.css` is processed by `nativewind/metro` (`withNativeWind`) and imported once in `app/_layout.tsx`.
- `babel.config.js` sets `jsxImportSource: "nativewind"` and the `nativewind/babel` plugin.
- `tailwind.config.js` uses the `nativewind/preset` and mobile-only `content` globs.
- Design tokens mirror `../../DESIGN.md` and `src/styles/theme.ts`.

### Fallback to StyleSheet

If NativeWind ever conflicts with a future React/Expo bump, screens can drop className and use `StyleSheet.create` with tokens from `src/styles/theme.ts` without changing the visual system. Keep `tailwind.config.js` colors and `theme.ts` colors in sync.

## Status

**U1 — scaffold complete.** Only a hello-world screen (`app/index.tsx`) is shipped. Auth providers, navigation tabs, and feature screens arrive in later units (U3+).
