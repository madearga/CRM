# Mobile MVP Hardening + Internal Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take the scaffolded mobile CRM MVP from "code exists and runs in Expo Go" to "validated end-to-end on device, security-hardened, and installable as an internal build via EAS."

**Architecture:** The mobile app (Expo SDK 54 / React 19 / NativeWind v4) reuses the existing Convex + Better Auth backend. All MVP units U0–U8 are already scaffolded and committed (`feat/u1-mobile-scaffold`). This phase does NOT add new features — it **validates** the scaffolded screens against live data, **fixes** defects found, **hardens** security per the original plan's Security Requirements, and produces the first **internal distribution build**. Distribution moves auth from Expo Go's `exp://` deep link to the native `crmmobile://` scheme via a real EAS build.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19.1, Expo Router 6, NativeWind 4, `convex/react`, Better Auth (`@better-auth/expo`), EAS Build/Submit, GitHub Actions.

---

## Context for the Implementing Engineer

You have zero context for this repo. Read these first:

- **Original plan:** `docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md` — defines units U0–U9, scope boundaries, and Security Requirements. This phase completes the validation + U9 distribution that U9's placeholders left open.
- **Auth spike findings:** `docs/plans/mobile-auth-spike-findings.md` — how the Better Auth + Convex token exchange works in RN.
- **Key files already done (do NOT rewrite):**
  - `apps/mobile/src/lib/auth-client.ts` — `expoClient` from `@better-auth/expo`.
  - `apps/mobile/src/providers/auth-provider.tsx` — `signInGoogle`, `Linking.createURL('auth/callback')`.
  - `apps/mobile/app/(auth)/_layout.tsx` + `app/(app)/_layout.tsx` — auth redirect guards.
  - `convex/auth.ts` + `convex/http.ts` — dynamic `baseURL` per request (web vs mobile).
  - `apps/mobile/src/lib/config.ts` — reads `EXPO_PUBLIC_*` via `@crm/config`.
  - `apps/mobile/.env.local` — dev env (gitignored; has `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`).
- **Current branch:** `feat/u1-mobile-scaffold` (or a new branch off it — see Task 0).
- **Convex dev deployment:** `knowing-capybara-968`. Site URL `https://knowing-capybara-968.convex.site`.
- **Tailscale (Mac):** `100.108.222.46`. Metro dev command:
  `REACT_NATIVE_PACKAGER_HOSTNAME=100.108.222.46 npx expo start -c --offline`

**DRY / YAGNI / TDD / frequent commits.** Mobile UI cannot be unit-tested for "renders on device" — those steps are **manual verification** with explicit pass/fail criteria. Where pure logic exists (e.g. invoice overdue classification), write a real test.

---

## Task 0: Create a working branch

**Files:** none (git only).

**Step 1: Branch off the current mobile branch**
Run: `git checkout -b phase/mobile-hardening-and-distribution`
Expected: new branch created from `feat/u1-mobile-scaffold` HEAD.

**Step 2: Verify clean tree**
Run: `git status --short`
Expected: only untracked `.ralph/` / `.context/` artifacts (intentionally uncommitted).

---

## Task 1: Expo Go end-to-end smoke validation (defect discovery)

This task produces a **defect log**, not code. It is the gate for Tasks 2–5. Do it fully before fixing anything — fixing blind leads to whack-a-mole.

**Files:**
- Create: `docs/plans/mobile-mvp-smoke-results.md` (defect log)

**Step 1: Boot Metro on Tailscale**
Run (in a dedicated pane):
```
REACT_NATIVE_PACKAGER_HOSTNAME=100.108.222.46 npx expo start -c --offline
```
Expected: Metro bundles `apps/mobile/index.js` with no Metro resolution errors.

**Step 2: Walk every screen on iPhone via Expo Go, log behavior**

For each item below, record in `mobile-mvp-smoke-results.md`: **PASS / DEFECT** with one-line symptom + Metro/Convex log line. Use a vision-capable reader if you cannot see the screen yourself.

1. **Login** — Google sign-in completes; app lands on Dashboard (not stuck on login).
2. **Dashboard** — KPI cards show numbers (not `$0` flashes, not infinite skeleton); attention section shows overdue activity/invoice counts; recent activities list renders.
3. **Dashboard → tap attention card** — navigates to Activities or Invoices tab.
4. **Activities → Upcoming** — list loads, sorted by due date asc.
5. **Activities → Recent** — list loads, sorted by created desc.
6. **Activities → FAB / New** — create screen opens; title required validation fires on empty submit; type picker works; entity picker (deal/contact/company) returns search results; submit creates activity and returns to list with the new item visible.
7. **Invoices → Overdue / Outstanding / All** — segmented filter works; summary totals match visible rows.
8. **Invoices → tap row → detail** — line items, totals, status, due date, customer render read-only.
9. **More tab** — user card shows; Settings row navigates.
10. **Settings → Sign out** — confirmation → returns to login; on next launch NO session (token cleared).
11. **Offline** — toggle airplane mode → network banner appears; a mutation shows inline failure; back online → banner clears.
12. **Empty states** — (if test org has no data) each list shows empty CTA, not a blank screen.

**Step 3: Commit the defect log**
```bash
git add docs/plans/mobile-mvp-smoke-results.md
git commit -m "docs: record mobile MVP Expo Go smoke-test results"
```

**Verify:** defect log exists with a PASS/DEFECT line per item 1–12.

---

## Task 2: Fix dashboard rendering + audit NativeWind animation hazards

**Depends on:** Task 1 (fix only the DEFECTs logged there for the dashboard).

**Files:**
- Modify: `convex/dashboard.ts` (only if `mobileOverview` still returns invalid data)
- Modify: `apps/mobile/app/(app)/index.tsx` (only if loading/render logic is wrong)
- Test: `apps/mobile/src/lib/format-date.test.ts` (new — guard the timestamp fallback)

**Step 1: Confirm dashboard root cause already patched**
Run: `grep -n "dueAt" convex/dashboard.ts`
Expected: `recentActivities` filters `typeof a.dueAt === 'number'` and casts `as number`. (This was the fix from the prior session.)

**Step 2: Write a failing test for the date fallback**
Create `apps/mobile/src/lib/format-date.test.ts`:
```ts
import { formatRelative } from './format-date'; // adjust to actual export name

test('invalid timestamp renders em-dash fallback, not NaN/Invalid Date', () => {
  expect(formatRelative(undefined)).toBe('—');
  expect(formatRelative(NaN)).toBe('—');
});
```
Run: `cd apps/mobile && bun test src/lib/format-date.test.ts` (or `npx vitest`)
Expected: FAIL (function name/signature may differ — adapt to the real export).

**Step 3: Make it pass** by ensuring the formatter returns `'—'` for non-numbers. Keep it lazy: one guard line.

**Step 4: Audit for other Reanimated-triggering classes**
Run: `grep -rn "animate-\|transition-\|active:scale\|hover:" apps/mobile/src apps/mobile/app`
Expected: only the explanatory comment in `skeleton.tsx`. If other matches exist, replace with a static style or a plain `Animated` value (do NOT re-enable `animate-pulse` — it calls `makeMutable` which is undefined in Expo Go's Reanimated runtime).

**Step 5: Re-run smoke item 2 (dashboard) → PASS.**

**Step 6: Commit**
```bash
git add apps/mobile/src/lib/format-date.ts apps/mobile/src/lib/format-date.test.ts convex/dashboard.ts
git commit -m "fix(mobile): harden dashboard date fallback + reanimated class audit"
```

---

## Task 3: Validate + fix activities module

**Depends on:** Task 1 (smoke items 4–6).

**Files:**
- Verify/Modify: `apps/mobile/app/(app)/activities/index.tsx`
- Verify/Modify: `apps/mobile/app/(app)/activities/new.tsx`
- Verify/Modify: `apps/mobile/src/components/entity-picker.tsx`
- Verify/Modify: `apps/mobile/src/components/activity-type-picker.tsx`
- Modify: `convex/activities.ts` (only if a needed query/mutation is missing or broken)

**Step 1: Confirm the create mutation exists server-side**
Run: `grep -n "export const create\b" convex/activities.ts`
Expected: a mutation matching what `new.tsx` calls (`api.activities.create`). If missing, add it mirroring the web `activities` create (org-scoped, audited).

**Step 2: Manual verify smoke items 4–6 → fix each DEFECT** logged in Task 1 (e.g. entity picker not searching, validation not firing, no navigation back on success). Smallest diff each.

**Step 3: Cross-check with web** — create an activity on mobile, refresh web dashboard → it appears. Create on web → appears in mobile list.

**Step 4: Commit**
```bash
git add apps/mobile convex/activities.ts
git commit -m "fix(mobile): activities list + create end-to-end"
```

---

## Task 4: Validate + fix invoices module (read-only)

**Depends on:** Task 1 (smoke items 7–8).

**Files:**
- Verify/Modify: `apps/mobile/app/(app)/invoices/index.tsx`
- Verify/Modify: `apps/mobile/app/(app)/invoices/[id].tsx`
- Verify/Modify: `apps/mobile/src/components/invoice-row.tsx`
- Test: `apps/mobile/src/components/invoice-row.test.ts` (new — the overdue classifier is pure logic)

**Step 1: Write a failing test for the overdue classifier**
The component exports `isInvoiceOverdue`. Create:
```ts
import { isInvoiceOverdue } from './invoice-row';

test('overdue classification', () => {
  const past = { posted: true, amountDue: 100, dueDate: Date.now() - 86400000 };
  const future = { posted: true, amountDue: 100, dueDate: Date.now() + 86400000 };
  const paid = { posted: true, amountDue: 0, dueDate: Date.now() - 86400000 };
  expect(isInvoiceOverdue(past as any)).toBe(true);
  expect(isInvoiceOverdue(future as any)).toBe(false);
  expect(isInvoiceOverdue(paid as any)).toBe(false);
});
```
Run test → expected PASS (classifier already exists) or FAIL → fix the classifier.

**Step 2: Manual verify smoke items 7–8** → fix DEFECTs (e.g. detail route param not read, totals mismatch).

**Step 3: Confirm read-only** — no write/reminder action is wired (Phase 2 deferred).

**Step 4: Commit**
```bash
git add apps/mobile/src/components/invoice-row.tsx apps/mobile/src/components/invoice-row.test.ts apps/mobile/app/(app)/invoices
git commit -m "fix(mobile): invoices list + read-only detail"
```

---

## Task 5: Validate + fix settings / sign-out + network banner

**Depends on:** Task 1 (smoke items 9–11).

**Context:** `apps/mobile/src/components/mutation-button.tsx` was **deleted** earlier. Confirm nothing still imports it (already verified: 0 matches). Settings likely uses the plain `Button`. The risk is the **sign-out cleanup chain**.

**Files:**
- Verify/Modify: `apps/mobile/app/(app)/settings.tsx`
- Verify/Modify: `apps/mobile/app/(app)/more.tsx`
- Verify/Modify: `apps/mobile/src/providers/auth-provider.tsx` (sign-out must clear SecureStore + reset Convex auth)
- Verify/Modify: `apps/mobile/src/components/network-banner.tsx`
- Verify/Modify: `apps/mobile/src/providers/network-provider.tsx`

**Step 1: Read the sign-out implementation**
Run: `grep -n "signOut\|clearAuth\|SecureStore\|deleteItem" apps/mobile/src/providers/auth-provider.tsx apps/mobile/app/(app)/settings.tsx`
Confirm the chain: confirmation → server sign-out → `secureStorage` clear → `convexClient.clearAuth()` → redirect to login.

**Step 2: Fix any gap** so that after sign-out, `mobileOverview` is NOT still callable with a stale token (relaunch must land on login). Smallest diff.

**Step 3: Manual verify smoke items 9–11** (More → Settings → Sign out; airplane mode banner; mutation inline failure + recovery).

**Step 4: Commit**
```bash
git add apps/mobile
git commit -m "fix(mobile): settings sign-out cleanup + network feedback"
```

---

## Task 6: Decide deep-link strategy — Expo Go (exp://) vs dev build (crmmobile://)

**Depends:** Tasks 2–5 green.

This is a **decision task**. Do NOT code until the choice is made — it changes `app.json` and the trusted-origin surface.

**Step 1: Understand the two modes**
- **Expo Go (current):** `Linking.createURL('auth/callback')` → `exp://100.108.222.46:8081/--/auth/callback`. Works for dev only; trusted origin already set (`exp://100.108.222.46:8081`). Cannot ship to testers.
- **Dev / preview / prod build:** custom scheme `crmmobile://` (already in `app.json`). `crmmobile://auth/callback` trusted origin already in `convex/auth.ts`. This is what distribution needs.

**Step 2: Document the decision**
Append to `mobile-mvp-smoke-results.md`:
> Distribution build MUST use the `crmmobile://` scheme (Expo Go is dev-only). Trusted origins in `convex/auth.ts` already include `crmmobile://`. No code change needed for the scheme itself — it activates once the app is a standalone build. Google Cloud OAuth authorized redirect URI for builds stays the Convex site callback: `https://knowing-capybara-968.convex.site/api/auth/callback/google`.

**Step 3: Build a development client (optional but recommended for faithful deep-link testing)**
Run: `cd apps/mobile && eas build --profile development --platform ios`
Expected: an installable `.app` for a simulator/device that supports `crmmobile://`. If EAS is not initialized yet, Task 7 runs first.

**Commit** the decision note (docs only).

---

## Task 7: Initialize EAS + finalize app.json / eas.json

**Depends:** Task 6 decision.

**Files:**
- Modify: `apps/mobile/app.json` (fill `eas.projectId`, bump version if needed)
- Modify: `apps/mobile/eas.json` (remove `REPLACE_*` placeholders — env goes to EAS, not the repo)
- Create: nothing committed (env vars live in EAS dashboard / `eas env`)

**Step 1: Log into Expo & init the project**
Run:
```
cd apps/mobile
eas login
eas init
```
Expected: prints a `projectId`. Copy it.

**Step 2: Write projectId into app.json**
Replace `"projectId": "REPLACE_AFTER_EAS_INIT"` with the real id.

**Step 3: Move EXPO_PUBLIC_* out of committed eas.json**
Delete the three `REPLACE_WITH_*` placeholder blocks in `eas.json` `env`. Instead set them via:
```
eas env:create --environment preview EXPO_PUBLIC_CONVEX_URL=...
eas env:create --environment preview EXPO_PUBLIC_CONVEX_SITE_URL=...
eas env:create --environment preview EXPO_PUBLIC_SITE_URL=...
eas env:create --environment preview EXPO_PUBLIC_GOOGLE_CLIENT_ID=...
```
(Repeat for `production`.) Never commit secret-bearing env. Keep `eas.json` env blocks empty or removed.

**Step 4: Verify typecheck still clean**
Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS.

**Step 5: Commit**
```bash
git add apps/mobile/app.json apps/mobile/eas.json
git commit -m "build(mobile): init EAS project, finalize app.json + eas.json env"
```

---

## Task 8: Security hardening (per original plan Security Requirements)

**Files:**
- Verify/Modify: `apps/mobile/src/lib/secure-storage.ts` (accessibility flag)
- Modify: `apps/mobile/app.json` (add screenshot-protect plugin) OR add `expo-screen-capture` usage on PII screens
- Modify: `apps/mobile/app/(app)/invoices/[id].tsx` (flag secure on detail)

**Step 1: Verify SecureStore accessibility**
Run: `grep -n "whenUnlockedThisDeviceOnly\|keychainAccessible\|SecureStore" apps/mobile/src/lib/secure-storage.ts`
Expected: accessibility = `whenUnlockedThisDeviceOnly` (or equivalent). If using `AsyncStorage` anywhere for tokens → FAIL, switch to SecureStore.

**Step 2: Audit for PII caching**
Run: `grep -rn "AsyncStorage" apps/mobile/src`
Expected: zero matches (or only non-PII UI prefs). No contacts/invoices/activities persisted to unencrypted storage.

**Step 3: Protect PII screens from screenshots / app-switcher preview**
On `invoices/[id].tsx` detail (and any future PII screen), add `expo-screen-capture`'s `usePreventScreenCapture()` while mounted. Add `expo-screen-capture` to `app.json` plugins if not present.
```tsx
import { usePreventScreenCapture } from 'expo-screen-capture';
// inside the component:
usePreventScreenCapture();
```
Install: `cd apps/mobile && npx expo install expo-screen-capture`.

**Step 4: Confirm no PII in logs**
Run: `grep -rn "console.log\|console.warn" apps/mobile/src | grep -i "invoice\|contact\|email\|phone"`
Expected: no full PII payloads logged.

**Step 5: Commit**
```bash
git add apps/mobile/app.json apps/mobile/app/(app)/invoices/[id].tsx apps/mobile/src/lib/secure-storage.ts package.json pnpm-lock.yaml
git commit -m "security(mobile): secure-store accessibility + screenshot-protect PII screens"
```

---

## Task 9: First internal distribution build

**Depends:** Tasks 7–8.

**Files:** none committed (build outputs are external).

**Step 1: Android internal APK**
Run: `cd apps/mobile && eas build --profile preview --platform android`
Expected: build succeeds, downloadable APK URL. Install on an Android test device; sign in; verify dashboard.

**Step 2: iOS internal (TestFlight internal testers)**
Run: `cd apps/mobile && eas build --profile preview --platform ios`
Then: `eas submit -p ios --latest` (to TestFlight internal).
Prereqs: Apple Developer Program account linked, app record created. If missing, stop and surface to the human owner — do not guess credentials.

**Step 3: Record build URLs + tester install result** in `mobile-mvp-smoke-results.md`.

**Step 4: Commit** the results note.

---

## Task 10: Docs + finalize

**Files:**
- Modify: `apps/mobile/README.md` (prereqs: EAS login, Apple/Google accounts, env vars, build commands)
- Modify: `docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md` (mark U9 done, link this phase doc)

**Step 1: Write the README build/distribute section** — accounts needed, `eas login`, env setup, the three build profiles, how to distribute to testers.

**Step 2: Mark original plan U9 complete** and note distribution scheme decision.

**Step 3: Final typecheck + commit + push**
```bash
cd apps/mobile && npx tsc --noEmit
cd ../.. && git add docs apps/mobile/README.md
git commit -m "docs(mobile): finalize distribution README + mark U9 done"
git push -u origin phase/mobile-hardening-and-distribution
```

---

## System-Wide Impact

- **Web app:** untouched. All mobile changes live in `apps/mobile/**` and (only if needed) new/verified Convex queries in `convex/**`. Web typecheck must remain green after every task.
- **Backend:** no schema changes expected; only possible query/mutation gap-fills in `convex/activities.ts` / `convex/invoices.ts`.
- **CI:** `.github/workflows/deploy-mobile.yml` already triggers on `apps/mobile/**` + `packages/**`; real EAS builds run via the workflow's `workflow_dispatch` once EAS is initialized.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Screen defects discovered in Task 1 expand scope | Fix only what blocks MVP acceptance (R1–R5); log the rest as Phase 2. |
| `crmmobile://` return-to-app fails in standalone build | Task 6 verifies scheme + trusted origin before distribution; `exp://` is dev-only by design. |
| Apple/Google distribution accounts missing | Task 9 Step 2 stops and surfaces to human — no guessed credentials. |
| `EXPO_PUBLIC_*` secret leaks into repo | Task 7 moves env to EAS dashboard; `.easignore` already blocks `.env*`. |
| Reanimated `makeMutable` crash recurs | Task 2 audits all `animate-*` classes; skeleton stays static. |

## Done Criteria

- All 12 smoke items PASS on a real device build (not just Expo Go).
- `apps/mobile && npx tsc --noEmit` green; `apps/web && npx tsc --noEmit` green.
- One iOS internal + one Android APK distributed and installed by at least one tester.
- Security checklist (secure-store accessibility, screenshot-protect on PII, no PII cache) verified.
- `app.json` has real `projectId`; `eas.json` has no committed secrets.
- Plan U9 marked complete; README documents distribution.
