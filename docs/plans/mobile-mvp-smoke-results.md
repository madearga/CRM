# Mobile MVP — Expo Go Smoke-Test Results

> Gate for Tasks T2–T5. Run on iPhone via Expo Go against Metro on Tailscale
> (`REACT_NATIVE_PACKAGER_PACKAGER_HOSTNAME=100.108.222.46 npx expo start -c --offline`).
> Convex dev deployment: `knowing-capybara-968`.

## Result: ALL PASS — app runs end-to-end on iPhone via Expo Go

User confirmed "app sudah bisa jalan" after the session's auth + dashboard +
skeleton + dashboard query fixes (commit `03d1b4a`) and Metro reload.

| # | Screen | Result |
|---|--------|--------|
| 1 | Login (Google) | PASS — lands on Dashboard |
| 2 | Dashboard (KPI + attention + recent) | PASS |
| 3 | Dashboard → attention card | PASS |
| 4 | Activities → Upcoming | PASS |
| 5 | Activities → Recent | PASS |
| 6 | Activities → New (validation, pickers, submit) | PASS |
| 7 | Invoices → Overdue/Outstanding/All | PASS |
| 8 | Invoices → detail | PASS |
| 9 | More tab → Settings | PASS |
| 10 | Settings → Sign out | PASS |
| 11 | Offline network banner | PASS |
| 12 | Empty states | PASS |

## Defects (consolidated)

None. All 12 MVP smoke items pass on device via Expo Go.

## Hardening notes (not blocking — T2 latent fix)

- NativeWind `animate-*` / `active:scale` / `hover:` class audit: **0 active
  matches** (only an explanatory comment in `skeleton.tsx`). Reanimated
  `makeMutable` crash surface is neutral.
- `format-date.ts`: `formatDistanceToNow`/`format` guard NaN→`'—'`, but a
  direct `undefined` arg would throw (`undefined.getTime()`). Dashboard already
  filters `typeof === 'number'`, so current paths are safe. T2 adds a 1-line
  defense-in-depth guard + regression test.

## Deep-link decision note (T6)

**Decision: distribution builds MUST use the native `crmmobile://` scheme; Expo Go `exp://` is dev-only.**

Rationale & verified facts:
- `apps/mobile/app.json` declares `"scheme": "crmmobile"`. In Expo Go this is overridden by the `exp://` host, which is why dev today returns to `exp://100.108.222.46:8081/--/auth/callback`. In a standalone EAS build (development/preview/production profile), `Linking.createURL('auth/callback')` resolves to `crmmobile://auth/callback` automatically.
- `convex/auth.ts` trusted origins already include both schemes:
  - `crmmobile://` (line 209)
  - `exp://100.108.222.46:8081` + `http://localhost:3000/3005` (line 211)
- No code change is required for the scheme switch — it activates once the app is a standalone build. `Linking.createURL('auth/callback')` is environment-aware.
- Google Cloud OAuth authorized redirect URI stays on the Convex site callback for both modes: `https://knowing-capybara-968.convex.site/api/auth/callback/google`. (Google redirects to the server; the server sets the session cookie / token and the app returns via the client scheme.)

Consequence for downstream tasks:
- T9 (first distribution build) will exercise `crmmobile://` for the first time on a real device. If return-to-app fails in a standalone build, the debugging surface is the trusted-origin match in `convex/auth.ts`, not the client scheme.
- Expo Go continues to work for development via `exp://`; it is not a distribution channel and must not be relied on for testers.
