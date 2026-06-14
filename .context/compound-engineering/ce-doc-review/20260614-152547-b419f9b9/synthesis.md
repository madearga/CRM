# Document Review Synthesis — Mobile CRM Plan

**Document:** `docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md`  
**Reviewers:** coherence, feasibility, product-lens, design-lens, security-lens, scope-guardian, adversarial  
**Run:** `20260614-152547-b419f9b9`

## Verdict

**Not ready for implementation.** The plan is coherent and directionally correct, but it has several load-bearing gaps that would block implementers or produce a bloated, insecure, and generic MVP. It needs a smaller MVP definition, concrete mobile auth strategy, resolved navigation/design decisions, and feasibility fixes before `ce-work` should begin.

## Critical findings (must fix before implementation)

### 1. Scope inflation — "web-parity-lite" actually ports 6+ web modules
- **Evidence:** Scope says "lite" but covers dashboard, deals, contacts/companies, activities, invoices, and HR.
- **Reviewers:** product-lens (P1), scope-guardian (P0), adversarial (P1)
- **Fix:** Define a true MVP of 2–3 modules. Recommended P0 = auth + dashboard + quick activity logging + overdue invoices. Move deals editing, contacts/companies, HR clock-in, and invoice reminders to Phase 2.

### 2. Mobile auth strategy is unresolved and is a hard blocker
- **Evidence:** Open Questions defer "Exact Better Auth token exchange mechanism for mobile vs web session sharing." U3 treats it as a spike within implementation.
- **Reviewers:** coherence (P1), product-lens (P1), adversarial (P1), security-lens (P0), scope-guardian (P1)
- **Fix:** Add a pre-implementation spike (U0) to prove token/session exchange works in React Native. Define exact mechanism (short-lived access token + refresh, SecureStore, device binding, remote revocation). Do not proceed to U3 until spike passes.

### 3. `@convex-dev/better-auth/react` and `@convex-dev/react-query` are browser-only
- **Evidence:** Feasibility verified that `ConvexBetterAuthProvider` imports `convex/browser`, `window.location`, `localStorage`. `convex-hooks.ts` imports `sonner` and `@convex-dev/react-query`, which also pull browser-only modules.
- **Reviewer:** feasibility (P0 x2)
- **Fix:** Do not reuse web provider/hooks directly. Build mobile-specific auth integration using `convex/react` + Better Auth `crossDomainClient` with `expo-secure-store`. Create mobile-specific hooks wrapping `useQuery`/`useMutation` from `convex/react`.

### 4. Navigation model and primary IA are undefined
- **Evidence:** Output Structure assumes Expo Router file paths, but Open Questions defer navigation library choice. No tab bar/drawer/stack decision, tab order, or entry screen defined.
- **Reviewers:** design-lens (P0), coherence (P1), adversarial (P1), scope-guardian (P2)
- **Fix:** Resolve navigation choice in U1. Document bottom tab structure: Dashboard, Deals, Contacts, Activities, (More). Decide whether settings/profile lives under More or stack. Update file structure accordingly.

### 5. Mobile dashboard should not mirror 8+ web queries
- **Evidence:** Web dashboard fires 8+ separate queries. Origin brainstorm explicitly flagged this performance risk.
- **Reviewer:** feasibility (P2)
- **Fix:** Add `api.dashboard.mobileOverview` Convex query returning Phase 1 mobile KPIs in one round trip, or drastically reduce mobile dashboard to 3–4 KPIs.

## High-priority findings (should fix before implementation)

### 6. Shared package refactor is bigger than assumed
- `@crm/auth` and `@crm/config` are currently empty. Web `env.ts` uses `@t3-oss/env-nextjs` (Next.js-specific). Web hooks import `sonner` (web-only).
- **Fix:** Choose platform-agnostic Zod env schema. Refactor web hooks into platform-agnostic core + web-specific adapter. Do not modify working web files unless necessary.

### 7. Security: token storage, data at rest, authz audit, URL sanitization
- SecureStore vs SecureStore ambiguity; no keychain accessibility level; no biometric unlock; no remote wipe.
- No authorization audit of reused Convex endpoints.
- `Linking.openURL` receives unsanitized phone/email/WhatsApp/URL.
- **Fix:** Specify `expo-secure-store` with `whenUnlockedThisDeviceOnly`, token revocation flow, biometric gate, screenshot/screen-recording flags, audit matrix, and URL safelisting.

### 8. Design details missing for every module
- Login screen fields, error placement, keyboard handling unspecified.
- Deals pipeline pattern unresolved (swipeable board vs list with filter).
- Search/filter pattern unspecified across contacts, invoices, activities.
- Empty/error/success states, global network feedback, accessibility, touch targets absent.
- **Fix:** Add a "Mobile UX Spec" section before U4/U5 covering navigation, login flow, dashboard priority, deals pattern, search/filter pattern, empty/error states, and accessibility baseline.

### 9. HR clock-in backend does not support authenticated mobile clock-in
- `convex/hrAttendance.ts` only has `clockInFromWhatsApp` / `clockOutFromWhatsApp` as public mutations requiring WhatsApp number + QR code.
- **Fix:** Either scope U10 to read-only for Phase 1, or add a backend task to create authenticated `clockIn`/`clockOut` mutations before mobile implementation.

### 10. Expo SDK 52 is incompatible with React 19
- Root repo uses React 19.1.1. Expo SDK 52 requires React 18.3.1.
- **Fix:** Pin Expo SDK 53+ and verify peer dependency compatibility.

## Medium-priority findings

- **Push notifications listed as benefit but deferred** — remove from problem justification or add local notification MVP.
- **No evidence that mobile web is inadequate** — add baseline validation: mobile web analytics or 2–3 user interviews.
- **Internal distribution prerequisites missing** — Apple Developer Program, Google Play Console, EAS project, secrets strategy.
- **Styling library decision open** — resolve NativeWind/Tamagui/StyleSheet and document token mapping.
- **Operational documentation premature** — write minimal README in U1; defer root README/runbook until pattern proven.

## Recommended next action

1. Revise the plan to define a true MVP (auth + dashboard + activities + overdue invoices read-only).
2. Add U0: Better Auth + Convex React Native auth spike with go/no-go criteria.
3. Resolve navigation, styling, and design system decisions in U1.
4. Add a mobile UX spec section before screen implementation units.
5. Add security requirements: token storage, authz audit, URL safelisting, data-at-rest protection.
6. Verify backend support for authenticated HR clock-in or remove it from Phase 1.
7. Re-run document review after revisions.

## Artifacts

- `.context/compound-engineering/ce-doc-review/20260614-152547-b419f9b9/{coherence,feasibility,product-lens,design-lens,security-lens,scope-guardian,adversarial}.json`
