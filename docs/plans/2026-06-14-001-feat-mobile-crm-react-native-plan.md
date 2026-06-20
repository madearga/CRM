---
title: Mobile CRM MVP with React Native + Expo
type: feat
status: active
date: 2026-06-14
origin: docs/brainstorms/2026-06-14-mobile-crm-react-native.md
---

# Mobile CRM MVP with React Native + Expo

## Overview

Build a focused mobile companion app for the existing CRM using React Native + Expo inside the existing Turborepo. The MVP reuses backend (Convex), authentication (Better Auth), domain types, and shared business logic from the web app, while keeping UI components native-first. Phase 1 targets internal distribution (TestFlight + APK) with a minimal, durable foundation: authenticated access, a dashboard showing what needs attention, quick activity logging, and overdue invoice visibility. Deals, contacts/companies, full invoice reminders, and HR are intentionally deferred to Phase 2 so the foundation can be validated before scope expands.

---

## Problem Frame

The CRM currently only has a desktop web experience. Sales reps, field staff, and managers need on-the-go access to:

1. What needs attention right now (overdue activities, overdue invoices).
2. Quick status of the pipeline and revenue.
3. A fast way to log an activity after a call or meeting.

A native mobile app provides faster input and a UX tailored to small screens. Push notifications, offline sync, deep linking, public store submission, and admin/permission management UI are intentionally deferred.

Origin: `docs/brainstorms/2026-06-14-mobile-crm-react-native.md`

---

## Requirements Trace

- R1. Authenticated users can access the mobile app using existing CRM credentials/session.
- R2. Users see a mobile-first dashboard with priority information on app launch.
- R3. Users can create and view activities.
- R4. Users can view outstanding/overdue invoices.
- R5. App supports internal iOS and Android distribution.
- R6. Shared domain logic, types, auth primitives, and env schema are reused across web and mobile.

**Phase 2 (deferred):** deals pipeline updates, contacts/companies browse, invoice reminders, HR attendance/clock-in, push notifications, offline sync, public store submission.

---

## Scope Boundaries

- **In scope for MVP:** Mobile app scaffold, auth/session integration, mobile navigation, dashboard, activities (list + create), overdue invoices read-only.
- **Out of scope for MVP:** Deal updates, contact/company browse, invoice reminders, HR attendance, push notifications, offline sync, deep linking to per-record web views, customer storefront, admin/permission management UI, public app store submission.
- **Deferred to follow-up work:** Deals, contacts/companies, invoice reminders, HR, push notifications, offline-first sync, biometric login, native payment collection.

---

## Context & Research

### Relevant Code and Patterns

- `apps/mobile/package.json` — currently a placeholder.
- `apps/web/src/lib/convex/components/convex-provider.tsx` — wraps Convex + Better Auth + React Query for web. **Not reusable directly in React Native** because it imports `convex/browser`, `window.location`, `localStorage`, and `sonner`.
- `apps/web/src/lib/convex/auth-client.ts` — creates the Better Auth client used by web.
- `apps/web/src/lib/convex/hooks/convex-hooks.ts` — `useAuthQuery`, `useAuthMutation`. **Not reusable directly in React Native** because it imports `@convex-dev/react-query` (which imports `convex/browser`) and `sonner`.
- `packages/domain/src/index.ts` — domain types, enums, and constants (deal stages, activity types, entity types, roles). **Reusable.**
- `packages/auth/src/index.ts` — currently empty; will hold platform-agnostic Better Auth client configuration and session primitives.
- `packages/config/src/index.ts` — currently empty; will hold platform-agnostic env schema and constants.
- `apps/web/src/app/(dashboard)/page.tsx` — reference dashboard layout and data dependencies. Mobile dashboard will use a consolidated query rather than mirroring all 8+ web queries.
- `apps/web/src/app/(dashboard)/activities/page.tsx` — reference activity list and creation flow.
- `apps/web/src/app/(dashboard)/invoices/page.tsx` — reference invoice list and status display.

### Institutional Learnings

- Dashboard `isLoading` must wait for all dependent queries before rendering content; partial loading causes `$0` flashes on KPI cards.
- `format-date.ts` already hardened against invalid dates; mobile should reuse it.
- Insights widget had a bug due to numeric vs ISO-string `dueAt` handling; mobile should consume normalized timestamps or the same safe parser.
- Web auth provider uses browser-only APIs. Mobile needs a separate provider built on `convex/react` and Better Auth cross-domain client plugin.

### External References

- Expo docs: https://docs.expo.dev
- Expo Router docs: https://docs.expo.dev/router/introduction/
- NativeWind docs: https://www.nativewind.dev
- Better Auth client plugins: `@convex-dev/better-auth/client/plugins`
- Convex React: https://docs.convex.dev/client/react

---

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| **React Native + Expo** | Matches team’s React knowledge; fastest path to iOS + Android; integrates with existing monorepo via pnpm workspace. |
| **Expo SDK 53+** | Root repo uses React 19.1.1; SDK 53 is the first Expo release compatible with React 19. SDK 52 must not be used. |
| **Expo Router** | File-based routing aligns with the existing Next.js web app, reduces navigation boilerplate, and is the Expo-recommended default. |
| **NativeWind v4** | Lets mobile share Tailwind design tokens with the web while remaining React Native compatible. Plain StyleSheet is the fallback if NativeWind setup conflicts with React 19. |
| **Reuse Convex + Better Auth backend** | No new backend needed; auth/session logic stays centralized. |
| **Share `@crm/domain`, `@crm/auth`, `@crm/config`** | Prevents domain drift; keeps validators, permissions, and types single-source-of-truth. UI and platform-specific hooks stay separate. |
| **Native UI components separate from web** | shadcn/ui + Tailwind class-based components are web-only; mobile needs React Native primitives wrapped for touch. |
| **Mobile-specific Convex hooks** | Do not reuse `apps/web/src/lib/convex/hooks/convex-hooks.ts` because it pulls browser-only dependencies. Build a thin mobile wrapper around `useQuery`/`useMutation` from `convex/react`. |
| **Internal distribution first** | TestFlight + internal APK for validation before store review/privacy compliance work. |
| **Online-only Phase 1** | Offline sync adds significant complexity; optimistic UI with network feedback is sufficient for first release. |

---

## Open Questions

### Resolved During Planning

- **Framework:** React Native + Expo.
- **Expo SDK:** 53+ (required by React 19).
- **Navigation:** Expo Router with file-based routes.
- **Styling:** NativeWind v4 as primary; StyleSheet fallback if integration issues arise.
- **Auth:** Reuse Better Auth via a mobile-specific `crossDomainClient` plugin + `expo-secure-store` token storage.
- **Shared code scope:** Domain + platform-agnostic auth/config shared; UI and Convex hook adapters platform-specific.
- **Deployment target:** Internal distribution first.

### Deferred to Implementation

- Exact color/theme token mapping from web to NativeWind.
- Whether to consolidate dashboard KPIs into `api.dashboard.mobileOverview` or limit to a strict subset of existing queries.
- Social login provider list (email first; Google/Apple OAuth optional if Better Auth plugin supports mobile).

---

## Output Structure

```text
apps/mobile/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx           # No-tab auth layout
│   │   └── login.tsx             # Email login screen
│   └── (app)/
│       ├── _layout.tsx           # Root app layout with bottom tabs
│       ├── index.tsx             # Dashboard (priority: attention + KPIs)
│       ├── activities/
│       │   ├── index.tsx         # Activity list (recent + upcoming)
│       │   └── new.tsx           # Create activity screen
│       └── invoices/
│           ├── index.tsx         # Overdue/outstanding invoices
│           └── [id].tsx          # Invoice detail (read-only)
├── src/
│   ├── components/
│   │   ├── ui/                   # Primitives (Button, Card, Badge, Skeleton, Input, Text)
│   │   ├── empty-state.tsx
│   │   ├── kpi-card.tsx
│   │   ├── activity-row.tsx
│   │   ├── invoice-row.tsx
│   │   └── network-banner.tsx
│   ├── hooks/
│   │   ├── use-auth.ts           # Mobile auth state
│   │   ├── use-convex.ts         # Mobile useQuery/useMutation wrappers
│   │   └── use-dashboard-data.ts
│   ├── lib/
│   │   ├── auth-client.ts        # Mobile Better Auth client
│   │   ├── convex-client.ts      # ConvexReactClient setup
│   │   ├── secure-storage.ts     # expo-secure-store wrapper
│   │   └── linking.ts            # Linking.openURL helpers with URL safelist
│   ├── providers/
│   │   ├── auth-provider.tsx     # Mobile auth provider (NOT web provider)
│   │   └── convex-provider.tsx   # ConvexReactClient provider
│   ├── styles/
│   │   └── theme.ts              # Color/spacing tokens + NativeWind config bridge
│   └── types/
│       └── navigation.ts         # Route param types
├── package.json
├── tsconfig.json
├── app.json
├── metro.config.js
├── babel.config.js
├── eas.json
├── .easignore
└── README.md

packages/auth/src/
├── auth-client.ts                # createAuthClient config (platform-agnostic)
├── session.ts                    # Session primitives (no platform deps)
└── index.ts

packages/config/src/
├── env.ts                        # Zod schema (no Next.js deps)
├── constants.ts
└── index.ts
```

---

## High-Level Technical Design

### Auth & Session Flow

```text
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  App launch │────▶│ useSession   │────▶│ token in       │
│             │     │ checks token │     │ expo-secure-   │
└─────────────┘     └──────────────┘     │ store?         │
                                         └────────────────┘
                              │                │
                              ▼                ▼
                       ┌──────────┐   ┌─────────────┐
                       │ (app)    │   │ login.tsx   │
                       │ tabs     │   │ signIn.email│
                       └──────────┘   └─────────────┘
                              │                │
                              ▼                ▼
                    ┌─────────────────┐  ┌────────────────┐
                    │ ConvexReactClient │  │ on success     │
                    │ setAuth(()=>token)│  │ store token    │
                    └─────────────────┘  └────────────────┘
```

**Rules:**

1. Do **not** import `@convex-dev/better-auth/react` or `ConvexBetterAuthProvider` in the mobile bundle; it uses `convex/browser` and `window`.
2. Create a mobile `authClient` using Better Auth's generic `createAuthClient` plus `crossDomainClient` plugin.
3. After email sign-in, call `authClient.convex.token()` to obtain a Convex auth token.
4. Persist the token in `expo-secure-store` with `whenUnlockedThisDeviceOnly` accessibility.
5. Hydrate `ConvexReactClient` from `convex/react` using `setAuth(() => token)`.
6. On sign-out, revoke server-side session if possible, then clear secure storage and reset client auth.

### Convex Hooks for Mobile

Create `apps/mobile/src/hooks/use-convex.ts` that re-exports `useQuery`, `useMutation`, and `useConvex` from `convex/react`. Do **not** import `@convex-dev/react-query` or `apps/web/src/lib/convex/hooks/convex-hooks.ts` in the mobile bundle.

If platform-agnostic shared logic is needed, refactor the web hooks into:

- A core helper in `@crm/utils` or `@crm/hooks` that has no UI deps.
- A web-specific adapter in `apps/web/src/lib/convex/hooks/` for `sonner`/toast.
- A mobile-specific adapter in `apps/mobile/src/hooks/` for native alerts/toast.

### Dashboard Data Strategy

Do not mirror all 8+ web dashboard queries on mobile. Use a single consolidated query:

- Add a new Convex query `api.dashboard.mobileOverview` that returns all MVP mobile KPIs in one round trip: open deals count, overdue activities count, overdue invoices total, revenue MTD, recent activities (top 5), overdue invoices (top 5).
- This replaces the web dashboard pattern of firing 8+ separate analytics queries on mobile, which is too slow and fragile for a small screen.
- `api.dashboard.mobileOverview` is a required backend subtask of U5.

### Mobile UX Foundation

**Navigation:**

- Bottom tab bar with: **Dashboard**, **Activities**, **Invoices**, **More**.
- "More" tab contains Settings (sign-out, org switcher placeholder).
- Activities and invoices use nested stacks for list → detail/new screens.

**Screen priorities:**

- Dashboard leads with "what needs my attention now": overdue activities, overdue invoices, then pipeline KPIs.
- Activities screen optimizes for quick capture: FAB to log a new activity; list sorted by due date descending.
- Invoices screen is read-only; shows overdue first, then outstanding, with totals.

**Empty/error states:**

- Empty state: headline, body, single CTA.
- Error state: inline retry with message; full-screen error on fatal failure.
- Network feedback: global subtle banner when offline; per-mutation loading state on buttons.

**Accessibility baseline:**

- All icon-only buttons have `accessibilityLabel`.
- Minimum touch target 44×44dp (prefer 48dp).
- Respect system font scaling (`allowFontScaling`).
- No auto-playing animations.

---

## Implementation Units

- [ ] **U0. Mobile auth proof-of-concept spike**

**Goal:** Prove that Better Auth session/token exchange works end-to-end in a React Native bundle against the existing backend before building screens.

**Requirements:** R1, R6

**Dependencies:** None

**Files:**
- Create: `apps/mobile/src/lib/__spike__/auth-spike.tsx`
- Create: `apps/mobile/app/__spike__/auth-test.tsx`
- Modify: `packages/auth/src/auth-client.ts` (initial scaffold)
- Modify: `packages/config/src/env.ts` (initial scaffold)

**Approach:**
- Configure a minimal Expo project with `expo-secure-store` and `convex/react`.
- Create a throwaway screen that signs in with email, calls `authClient.convex.token()`, stores token in `expo-secure-store`, and fetches one authenticated Convex query.
- Document exact token format, lifetime, refresh behavior, and sign-out cleanup.

**Go/no-go criteria:**
- ✅ Authenticated Convex query returns data in React Native bundle.
- ✅ Token persists across app restarts and is cleared on sign-out.
- ❌ If spike fails, stop mobile implementation and reconsider responsive-web/PWA approach.

**Verification:**
- Spike screen runs on iOS and Android simulators with live backend.
- Sign-in, token storage, authenticated query, and sign-out all work manually.
- Findings written to `docs/plans/mobile-auth-spike-findings.md`.

---

- [ ] **U1. Scaffold Expo mobile app in `apps/mobile`**

**Goal:** Create a working React Native + Expo package inside the Turborepo that builds and runs a hello-world screen.

**Requirements:** R5

**Dependencies:** U0 (go/no-go passed)

**Files:**
- Create: `apps/mobile/package.json` (Expo SDK 53+, React 19, NativeWind v4)
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/metro.config.js` (workspace + blocklist)
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/src/styles/theme.ts`
- Create: `apps/mobile/app/index.tsx` (hello-world)
- Modify: `pnpm-workspace.yaml` (if needed to include mobile)
- Modify: `turbo.json` (add mobile tasks)

**Approach:**
- Pin Expo SDK 53+ and verify peer dependency compatibility with React 19.1.1.
- Configure Metro to resolve workspace packages (`@crm/domain`, `@crm/auth`, `@crm/config`) and block browser-only transitive deps (`sonner`, `next`, `recharts`, `@radix-ui/*`, `tailwindcss`, `vaul`) from entering the mobile bundle.
- Add shared dev scripts: `dev`, `ios`, `android`, `typecheck`, `bundle:analyze`.
- Configure NativeWind v4. If it conflicts with React 19, fallback to StyleSheet and document the decision.

**Patterns to follow:**
- Existing pnpm workspace setup in `pnpm-workspace.yaml`.
- Turborepo task conventions in `turbo.json`.

**Test scenarios:**
- Happy path: `pnpm install` succeeds and `apps/mobile` resolves workspace deps.
- Happy path: `expo start` boots without Metro resolution errors.
- Happy path: a file in `@crm/domain` can be imported from `apps/mobile` without bundler errors.
- Error path: importing `next`, `sonner`, or `apps/web/src/lib/convex/hooks/convex-hooks.ts` from mobile fails the build.

**Verification:**
- `cd apps/mobile && pnpm dev` starts Expo.
- No TypeScript or Metro resolution errors when importing `@crm/domain`.
- `npx react-native-bundle-visualizer` (or EAS build) shows no browser-only modules in the bundle.

---

- [ ] **U2. Populate shared packages for cross-platform use**

**Goal:** Move platform-agnostic auth configuration and env schema into `@crm/auth` and `@crm/config` so both web and mobile can import them without web-only dependencies.

**Requirements:** R1, R6

**Dependencies:** U0, U1

**Files:**
- Create: `packages/auth/src/auth-client.ts`
- Create: `packages/auth/src/session.ts`
- Modify: `packages/auth/src/index.ts`
- Create: `packages/config/src/env.ts`
- Create: `packages/config/src/constants.ts`
- Modify: `packages/config/src/index.ts`
- **Create:** `apps/web/src/lib/convex/auth-client.mobile-adapter.ts` (thin web wrapper if needed)
- **Leave untouched unless required:** `apps/web/src/lib/convex/auth-client.ts`, `apps/web/src/env.ts`

**Approach:**
- Extract `createAuthClient` configuration into `@crm/auth` **without** Next.js or browser-only imports. The package exports the auth client factory, session types, and sign-in/sign-out primitives.
- Extract a platform-agnostic Zod env schema into `@crm/config` for `CONVEX_URL`, `CONVEX_SITE_URL`, `BETTER_AUTH_SECRET` (server-side only, not bundled), and public runtime values.
- `apps/web/src/env.ts` may continue using `@t3-oss/env-nextjs` internally, but it should re-export or align with the Zod schema from `@crm/config`. Only modify web files if type alignment requires it.
- Create mobile-specific wrappers in `apps/mobile/src/lib/` rather than mutating working web files.

**Execution note:** Start with a failing typecheck in `apps/mobile` importing `@crm/auth` and `@crm/config`; then move code until it passes.

**Patterns to follow:**
- `apps/web/src/lib/convex/auth-client.ts` for auth client setup (but strip web-only plugins).
- Plain Zod for env validation.

**Test scenarios:**
- Happy path: `@crm/auth` exports `signIn`, `signOut`, session types without importing `next/headers`.
- Happy path: `@crm/config` validates env vars without importing Next.js.
- Edge case: mobile bundle does not pull in `next/headers`, `react-dom/server`, or `sonner` transitively.
- Error path: missing required env var throws clear error at startup.

**Verification:**
- `pnpm typecheck` passes for `packages/auth`, `packages/config`, `apps/mobile`.
- `cd apps/mobile && pnpm bundle:analyze` confirms no browser-only modules.

---

- [ ] **U3. Set up mobile auth and Convex provider**

**Goal:** Authenticate users in the mobile app using existing Better Auth and Convex backend via a mobile-specific provider stack.

**Requirements:** R1, R6

**Dependencies:** U0, U1, U2

**Files:**
- Create: `apps/mobile/src/lib/auth-client.ts`
- Create: `apps/mobile/src/lib/convex-client.ts`
- Create: `apps/mobile/src/lib/secure-storage.ts`
- Create: `apps/mobile/src/providers/auth-provider.tsx`
- Create: `apps/mobile/src/providers/convex-provider.tsx`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/src/hooks/use-auth.ts`
- Create: `apps/mobile/src/hooks/use-convex.ts`

**Approach:**
- Use `expo-secure-store` to persist the Convex auth token with `whenUnlockedThisDeviceOnly` accessibility.
- Initialize `ConvexReactClient` from `convex/react` with `CONVEX_URL` from `@crm/config`.
- Build a mobile `AuthProvider` that checks the stored token on launch, routes to `(app)` if valid, otherwise shows login.
- Login screen uses `signIn.email` from `@crm/auth` first. Social login optional.
- On sign-in success: fetch Convex token via `authClient.convex.token()`, store it, hydrate Convex client.
- On sign-out: call server-side sign-out if available, clear secure storage, reset Convex auth, redirect to login.

**What NOT to do:**
- Do not import `ConvexBetterAuthProvider` from `@convex-dev/better-auth/react` in mobile.
- Do not import `apps/web/src/lib/convex/components/convex-provider.tsx`.
- Do not import `@convex-dev/react-query` directly in mobile.

**Execution note:** Implement test-first for the auth-provider state machine.

**Patterns to follow:**
- Spike findings from U0.
- Expo Router `(auth)` / `(app)` group conventions.

**Test scenarios:**
- Happy path: valid credentials → token stored → app navigates to dashboard.
- Happy path: existing valid token on app launch → auto-login.
- Error path: invalid credentials → error message displayed on login screen.
- Error path: expired/invalid token → redirect to login.
- Edge case: app returns from background with revoked token → clear storage, redirect to login.

**Verification:**
- Mobile app can log in against the existing backend.
- Authenticated `useQuery` from `convex/react` returns data in a test screen.
- `pnpm typecheck` passes; bundle analysis confirms no browser-only deps.

---

- [ ] **U4. Create mobile design system**

**Goal:** Build a minimal, durable set of native UI primitives that map to the web design tokens and are reusable across mobile screens.

**Requirements:** R2–R4

**Dependencies:** U1

**Files:**
- Create: `apps/mobile/src/styles/theme.ts`
- Create: `apps/mobile/src/components/ui/text.tsx`
- Create: `apps/mobile/src/components/ui/button.tsx`
- Create: `apps/mobile/src/components/ui/card.tsx`
- Create: `apps/mobile/src/components/ui/badge.tsx`
- Create: `apps/mobile/src/components/ui/skeleton.tsx`
- Create: `apps/mobile/src/components/empty-state.tsx`
- Create: `apps/mobile/src/components/network-banner.tsx`

**Approach:**
- Use React Native primitives (`View`, `Text`, `Pressable`, `TextInput`, `ActivityIndicator`).
- Map colors to the web theme (primary, muted, destructive, success, warning, background, foreground, border) via `theme.ts`.
- Use NativeWind classes where stable; fallback to StyleSheet for complex dynamic styles.
- All tappable elements ≥ 44×44dp touch target (prefer 48dp).
- All icon-only buttons receive `accessibilityLabel`.
- Keep components small; defer additional primitives until a second screen reuses them.

**Patterns to follow:**
- Web `Button`, `Card`, `Badge`, `Skeleton` in `apps/web/src/components/ui/` for semantics, not implementation.
- Tailwind semantic tokens used in dashboard polish.

**Test scenarios:**
- Happy path: each primitive renders correctly on iOS and Android simulators.
- Edge case: long text truncates gracefully in `Card`.
- Edge case: button disabled state is visually distinct and non-interactive.
- Edge case: `Badge` handles all status variants used in MVP.

**Verification:**
- A component gallery screen renders all primitives without crashes.
- TypeScript types are exported and consumed cleanly.
- NativeWind config loads without build errors.

---

- [ ] **U5. Build mobile dashboard screen**

**Goal:** Port dashboard to a mobile-first layout that prioritizes attention over analytics.

**Requirements:** R2

**Dependencies:** U3, U4

**Files:**
- Create: `apps/mobile/src/hooks/use-dashboard-data.ts`
- Create: `apps/mobile/src/components/kpi-card.tsx`
- Create: `apps/mobile/src/components/attention-card.tsx`
- Create: `apps/mobile/src/components/activity-row.tsx`
- Modify: `apps/mobile/app/(app)/index.tsx`
- **Modify (backend):** `convex/dashboard.ts` — add `api.dashboard.mobileOverview` query.

**Approach:**
- Implement `api.dashboard.mobileOverview` in `convex/dashboard.ts` to return all MVP dashboard data in a single round trip.
- Dashboard layout order:
  1. Attention section: overdue activities count + overdue invoices total, each tappable to its module.
  2. KPI cards (2–3): open deals, revenue MTD, activities due today.
  3. Recent/upcoming activities (top 5).
- Show skeleton while all data is loading; never render partial numeric cards.
- Use `format-date.ts` for timestamp normalization.

**Patterns to follow:**
- `apps/web/src/app/(dashboard)/page.tsx` for data semantics, not layout.

**Test scenarios:**
- Happy path: dashboard shows attention values after all queries resolve.
- Happy path: skeleton appears while loading.
- Happy path: empty states render with CTA buttons and clear copy.
- Edge case: invalid activity timestamps render `'—'` fallback instead of crashing.
- Error path: query error shows inline retry with message.

**Verification:**
- Dashboard screen renders on device with live Convex data.
- Tapping attention cards navigates to the correct module.
- Dashboard completes its entire data load in a single `api.dashboard.mobileOverview` round trip.

---

- [ ] **U6. Build activities module**

**Goal:** View upcoming/recent activities and log new ones quickly.

**Requirements:** R3

**Dependencies:** U3, U4

**Files:**
- Create: `apps/mobile/app/(app)/activities/index.tsx`
- Create: `apps/mobile/app/(app)/activities/new.tsx`
- Create: `apps/mobile/src/components/activity-row.tsx`
- Create: `apps/mobile/src/components/activity-type-picker.tsx`

**Approach:**
- List screen: tab or segmented control for "Upcoming" vs "Recent".
- Activities sorted by due date descending/upcoming first.
- FAB or primary button to create new activity.
- "New activity" screen: title (required), type picker (call, email, meeting, task), due date/time, linked entity (deal/contact/company) via searchable picker, optional notes.
- Reuse Zod schemas from `@crm/domain` for validation.
- On success: navigate back and show success feedback.

**Test scenarios:**
- Happy path: create a call activity for a deal.
- Happy path: upcoming activities sort by due date.
- Edge case: logging activity with empty title shows validation error.
- Edge case: entity picker handles empty search results.

**Verification:**
- New activity appears in mobile list and in web dashboard after refresh.
- Validation errors prevent submission.

---

- [ ] **U7. Build invoices module (read-only)**

**Goal:** View outstanding and overdue invoices.

**Requirements:** R4

**Dependencies:** U3, U4

**Files:**
- Create: `apps/mobile/app/(app)/invoices/index.tsx`
- Create: `apps/mobile/app/(app)/invoices/[id].tsx`
- Create: `apps/mobile/src/components/invoice-row.tsx`

**Approach:**
- Query invoice list filtered to outstanding/overdue.
- Top section shows total overdue and total outstanding.
- Status segmented control: Overdue, Outstanding, All.
- Detail screen is read-only: shows line items, totals, status, due date, customer.
- "Send reminder" action is intentionally deferred to Phase 2.

**Test scenarios:**
- Happy path: invoice list loads and filters by status.
- Happy path: detail matches web data.
- Edge case: no invoices shows empty state with clear copy.

**Verification:**
- Invoice list matches web data.
- Total calculations are correct.

---

- [ ] **U8. Add network feedback, error handling, and settings/sign-out**

**Goal:** Provide consistent network and mutation feedback plus a settings screen for sign-out.

**Requirements:** R1, R2–R4

**Dependencies:** U3, U4

**Files:**
- Create: `apps/mobile/src/components/network-banner.tsx`
- Create: `apps/mobile/src/components/mutation-button.tsx`
- Create: `apps/mobile/app/(app)/settings.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx` (add More tab linking to settings)
- Modify: `apps/mobile/src/providers/convex-provider.tsx` (network listener)

**Approach:**
- Global network banner: subtle top banner when offline, hidden when online.
- Mutation button: loading/disabled state during mutation, success icon briefly, error inline.
- Settings screen: org name display, app version, sign-out button with confirmation.
- Sign-out flow: confirmation dialog → server sign-out → clear secure storage → redirect to login.

**Test scenarios:**
- Happy path: sign-out clears token and shows login.
- Error path: network offline shows banner.
- Edge case: mutation failure shows inline retry.

**Verification:**
- Manual test on airplane mode.
- Sign-out leaves no token in secure storage.

---

- [ ] **U9. Set up internal distribution builds**

**Goal:** Produce installable iOS (TestFlight) and Android (APK/internal track) builds for stakeholders.

**Requirements:** R5

**Dependencies:** U1–U8

**Files:**
- Create: `apps/mobile/eas.json`
- Create: `apps/mobile/.easignore`
- Create: `.github/workflows/deploy-mobile.yml`
- Modify: `apps/mobile/app.json` (bundle identifier, version, splash, icon placeholders)
- Modify: `apps/mobile/README.md`

**Approach:**
- Configure EAS Build profiles: `development`, `preview` (internal), `production`.
- Map environment variables into `eas.json` build-time env:
  - Public: `CONVEX_URL`, `CONVEX_SITE_URL`, `BETTER_AUTH_URL`.
  - Build-only secrets: signing credentials, any build-time API keys.
  - Server-only secrets must not reach the bundle (e.g., `BETTER_AUTH_SECRET` stays in Convex/Better Auth server).
- Add CI workflow that triggers on changes to `apps/mobile/**` and `packages/**`.
- Document prerequisites: Apple Developer Program account, Google Play Console account, EAS project (`eas init`), tester lists.

**Patterns to follow:**
- Existing CI workflow structure in `.github/workflows/`.

**Test scenarios:**
- Happy path: `eas build --platform ios --profile preview` succeeds.
- Happy path: `eas build --platform android --profile preview` succeeds.
- Edge case: missing EAS secret fails build with clear message.
- Error path: server-only secret in bundle fails CI check.

**Verification:**
- TestFlight build is distributed to internal testers.
- APK can be installed on Android test device.

---

## System-Wide Impact

- **Interaction graph:** Mobile app adds new consumers of existing Convex queries/mutations. No backend schema changes expected for MVP; only a possible new `api.dashboard.mobileOverview` query.
- **Error propagation:** Auth failures redirect to mobile login. Query errors show retry UI. Network offline shows global banner.
- **State lifecycle risks:** Secure token storage must be cleared on sign-out. Multiple tabs in mobile share the same Convex client instance.
- **API surface parity:** Mobile uses the same queries/mutations as web where possible. Where web hooks are not mobile-compatible, mobile uses `convex/react` directly with a thin wrapper.
- **Unchanged invariants:** Web app behavior, database schema, and existing API contracts remain unchanged.

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Better Auth mobile session sharing is non-trivial | Medium | High | U0 spike with explicit go/no-go; do not proceed to U3 until proven. If spike fails, reconsider responsive-web/PWA. |
| Expo SDK 53 / React 19 compatibility issues | Medium | High | Pin SDK 53+ in U1; verify peer deps before first install. |
| Browser-only modules leak into mobile bundle | Medium | High | Metro blocklist + bundle analysis in U1; typecheck mobile imports. |
| Scope creep trying to port all web features | High | High | Strict MVP scope; Phase 2 list is locked and not part of MVP acceptance criteria. |
| NativeWind v4 setup friction with React 19 | Medium | Medium | Fallback to StyleSheet documented in U1; theme tokens remain shared. |
| React Native bundle size with Convex deps | Medium | Medium | Audit bundle after U3; tree-shake unused imports. |
| Internal distribution prerequisites missing | Medium | High | Add prerequisites checklist to U9; identify account owners before first build. |
| Sensitive CRM data on lost/stolen device | Medium | High | Security requirements: SecureStore accessibility, no persistent PII cache, screenshot flags; documented in U3/U8. |

---

## Security Requirements

**Token storage (U3):**
- Use `expo-secure-store` (cross-platform), not `SecureStore` (iOS-only).
- Accessibility level: `whenUnlockedThisDeviceOnly`.
- Clear token on sign-out and on detected revocation.
- Define behavior when a server-side session is invalidated while app is running.

**Data at rest (U3, U8):**
- Do not persist contacts, invoices, or activities in AsyncStorage or any unencrypted cache by default.
- Disable screenshots and app-switcher preview for invoice detail and any future PII-heavy screens.
- Ensure app data is excluded from iCloud/Google backups or encrypted if backup is required.
- Prohibit logging of full contact/invoice details.

**Authorization (U2, U3):**
- Inventory all `api.*` queries/mutations consumed by mobile and confirm each enforces server-side authorization based on caller identity and org/role, not UI gating.
- Document feature-to-permission matrix for dashboard, activities, invoices.

**Input validation (U6, U7):**
- Reuse Zod schemas from `@crm/domain` for all mobile forms.
- Sanitize phone numbers, emails, and URLs before `Linking.openURL`; reject `javascript:`, custom schemes, and control characters.
- Invoice module is read-only in MVP; no write path to validate.

**Third-party trust (U9):**
- Document EAS/Expo trust boundaries: which services touch code or credentials, whether OTA updates are enabled and how they are signed.
- Pin EAS build environment where possible.
- Define fallback if a social identity provider is unavailable.

**Audit trail (deferred to Phase 2):**
- Server-side audit events should already exist for reused mutations. Mobile does not add new state-changing endpoints in MVP beyond activity creation; that mutation must emit an audit event.

---

## Mobile UX Spec

**Navigation model:**
- Bottom tab bar: Dashboard, Activities, Invoices, More.
- Dashboard, Activities, Invoices are primary. More contains Settings.
- Activities and Invoices screens are nested stacks: list → detail/new.
- Login is a modal/stack outside the tab layout.

**Dashboard priority (top to bottom):**
1. Attention: overdue activities count (tappable → Activities), overdue invoices total (tappable → Invoices).
2. Quick KPIs: open deals count, revenue MTD, activities due today.
3. Recent/upcoming activities (top 5).

**Login screen:**
- Fields: email, password.
- Primary action: Sign In.
- Error placement: inline below password field.
- Loading state: disabled button with spinner.
- Keyboard handling: return key moves to password, then submits.
- Social login: optional, only if enabled by backend.

**Activities:**
- List tabs: Upcoming / Recent.
- Sort: Upcoming by due date ascending; Recent by due date descending.
- FAB: New Activity.
- New activity form: type picker (4 options), title required, due date/time, linked entity searchable picker, notes optional.

**Invoices:**
- List status filter: Overdue / Outstanding / All.
- Top summary cards: total overdue, total outstanding.
- Detail read-only: customer, line items, totals, status badge, due date.

**Empty/error states:**
- Empty: headline + body + single CTA.
- Error: message + Retry button.
- Search/filter empty: "No results" with clear-filter action.

**Accessibility baseline:**
- Touch targets ≥ 44×44dp (prefer 48dp).
- `accessibilityLabel` on every icon-only button.
- `allowFontScaling` on Text components.
- Focus order follows visual order.

---

## Documentation / Operational Notes

- Create `apps/mobile/README.md` covering dev setup, env vars, build commands, and internal distribution.
- Do not update root README until MVP is validated internally.
- Defer runbook for adding a new mobile screen until at least three screens establish a repeatable pattern.

---

## Phase 2 Backlog (not part of MVP)

Modules and features explicitly deferred to a later phase:

1. **Deals:** list, stage board/list, detail, stage change, mark won/lost.
2. **Contacts & Companies:** browse, search/filter, detail with call/email/WhatsApp/URL actions.
3. **Invoice reminders:** "Send reminder" action on invoice detail.
4. **HR:** attendance list, employee list, authenticated clock-in/clock-out (requires new backend mutations). GPS/location not considered until backend supports it.
5. **Push notifications:** overdue activity reminders, invoice due reminders.
6. **Offline sync:** mutation queue, read-through cache.
7. **Deep linking:** open specific records from external sources.
8. **Public store submission:** App Store / Google Play release.
9. **Biometric login:** Face ID / fingerprint gate.
10. **Admin/permission UI:** role/permission management.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-06-14-mobile-crm-react-native.md`
- **Doc review synthesis:** `.context/compound-engineering/ce-doc-review/20260614-152547-b419f9b9/synthesis.md`
- Related code: `apps/web/src/app/(dashboard)/page.tsx`, `apps/web/src/lib/convex/`
- Related packages: `packages/domain/`, `packages/auth/`, `packages/config/`
- External docs: Expo SDK 53, Expo Router, NativeWind v4, Better Auth, Convex React
