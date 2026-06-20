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

> (To be filled in Task 6.)
