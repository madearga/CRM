# Mobile CRM — Phase 2: Web-Feature Parity Roadmap

> **For Claude:** This is a **multi-phase roadmap**, not a single executable plan. Execute phase-by-phase. For the phase currently in progress, expand its scope into bite-sized tasks (REQUIRED SUB-SKILL: `superpowers:writing-plans` for the detail expansion; `superpowers:subagent-driven-development` for execution).

**Goal:** Bring the web CRM's capabilities into the mobile app incrementally — each phase ships independently, validated on Expo Go, with zero breakage to web or backend.

**Architecture:** Pure **frontend consumption**. The Convex backend already exposes every module via `createOrgQuery` / `createOrgPaginatedQuery` / `createOrgMutation` (org-scoped, auth-enforced, audited). Mobile adds React Native screens that call the **same** functions the web app already uses. **No backend or schema changes are expected** — verify per phase. The web app is never modified.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19.1, Expo Router 6, NativeWind 4, `convex/react`, Better Auth. Reuses `@crm/domain` (types, enums), `@crm/auth`, `@crm/config`.

---

## Context for the Implementing Engineer

- **Branch:** each phase gets its own branch off `main` (after `phase/mobile-hardening-and-distribution` merges). Naming: `phase/mobile-p2.N-<module>`.
- **Current mobile state (post hardening phase):** auth (Google), dashboard (`api.dashboard.mobileOverview`), activities (list + create via `api.activities.schedule`), invoices (read-only list + detail), settings/sign-out, network banner. **322 tests green, tsc clean, validated end-to-end in Expo Go on iPhone.**
- **Backend is complete** — verified exports:
  - `contacts` (`list` paginated, `getById`), `companies` (`list` paginated, `getById`)
  - `deals` (`list`, `listByStage`, `getById`, `create`, `update`, **`updateStage`**, `convertToSaleOrder`)
  - `products` (`list`, `getByCategory`, `getById`)
  - `payments` (`create`, `cancel`, `list`), `invoiceReminders`
  - `saleOrders`, `hrAttendance`, `hrEmployees`, etc.
- **Reusable mobile infra that already exists:** `apps/mobile/src/components/entity-picker.tsx` (searchable picker, built for activities), `empty-state.tsx`, `error-boundary.tsx`, `network-banner.tsx`, `useQuery`/`useMutation` from `@/hooks/use-convex`.

---

## Safety Rules — "Without Breaking" (apply to EVERY phase)

1. **Backend unchanged unless additive.** Reuse existing `createOrg*` functions. If a query/mutation is genuinely missing, add it following the existing `createOrgQuery`/`createOrgMutation` pattern + server-side authorization (never trust the client). Run the `convex-migration-helper` skill if any schema change is needed.
2. **Web untouched.** After every phase: `cd apps/web && npx tsc --noEmit` must be clean. The monorepo invariant is non-negotiable.
3. **Mobile additive only.** New screens go behind new tabs / nested stacks / "More" rows. Never destructively change the existing Dashboard/Activities/Invoices/Settings contract within a feature phase.
4. **Each phase is independently shippable.** Own branch → green typecheck (mobile + web + convex) → green tests → Expo Go smoke pass → merge. No half-states merge.
5. **Money/permission paths inherit server guarantees.** `createOrgMutation` already enforces org + auth + audit. Mobile never needs to re-implement permission checks for reused mutations — but every NEW mutation must be audited server-side.
6. **Validation gate per phase:** a smoke list (like T1 of the hardening phase) before the phase is marked done.

---

## Sequencing (recommended order — value ↑, risk ↓, dependency-first)

| # | Phase | Why this order | Effort | Risk | New backend? |
|---|-------|----------------|--------|------|--------------|
| 1 | **P2.1 Contacts & Companies** + shared browse infra | Highest field-rep value (call/email). Builds the **reusable list/search/pagination/detail infra** every later phase reuses. | M | Low | No |
| 2 | **P2.2 Products catalog** | Reuses P2.1 infra. Pure read, quick win, rep can check price/stock in the field. | S–Low | Low | No |
| 3 | **P2.3 Deals pipeline** (view + stage update) | First write-heavy module. Establishes the **mutation-feedback pattern** reused by P2.4–P2.5. Depends on contacts (P2.1) for deal links. | M | M | No (`updateStage` exists) |
| 4 | **P2.4 Invoice actions + Payments** | Promotes the shipped invoice module from read-only → **mark paid** (`payments.create`) + send reminder. Money path, but server already audits. | M | Low–M | No |
| 5 | **P2.5 Sales Orders** | Complex (line items, pricing). Depends on products (P2.2) + contacts (P2.1). `convertToSaleOrder` exists. | L | M | No |
| 6 | **P2.6 HR attendance / clock-in** | Most mobile-native (GPS/time) but largest standalone module + device permissions. Best done when infra is battle-tested. | L | M–H | No |
| 7 | **P2.7 Settings / admin** | Lowest mobile priority. Role-gated. Builds on the permission-gate infra accumulated above. | M | Low | No |

> **Cross-cutting infrastructure** is NOT a phase — it is **built in P2.1 and hardened through each phase**, extracted only when a second consumer appears (DRY). Do not pre-build infra for hypothetical needs (YAGNI).

---

## Shared Mobile Infrastructure (built in P2.1, evolved as needed)

These are extracted opportunistically — build the minimal version in P2.1, generalize only when P2.2 actually reuses it:

- **`usePaginatedOrgList(apiFn, args)`** — paginated org query hook wrapping `convex/react` pagination (used by contacts, companies, products, deals).
- **`<SearchList>`** — FlatList + search input + empty/error/loading/skeleton states (replaces per-screen duplication).
- **`useMutationFeedback()`** — standardized success toast / inline error for mutations (alert-based on RN), established in P2.3 (first non-activity mutation).
- **`<EntityDetailHeader>`** — avatar/title/subtitle header pattern for detail screens.
- **Deep-link-to-web escape hatch** (optional accelerator) — for complex create/edit forms that are low-value to re-implement natively, `Linking.openURL` into the authenticated web app instead of building a native form. Decide per screen; default to native for high-frequency flows, web-deeplink for rare/admin flows.

---

## Phase Scope Cards

### P2.1 — Contacts & Companies (FOUNDATION)

**Goal:** Browse org contacts/companies, tap-to-call / tap-to-email / open address, view detail. Establishes reusable browse infra.

**Requirements:** field reps can reach any contact from their phone.

**Files (new mobile):**
- `apps/mobile/src/hooks/use-paginated-org-list.ts` (infra — built here)
- `apps/mobile/src/components/search-list.tsx` (infra)
- `apps/mobile/app/(app)/contacts/index.tsx` + `[id].tsx`
- `apps/mobile/app/(app)/companies/index.tsx` + `[id].tsx`
- `apps/mobile/src/components/contact-row.tsx`, `company-row.tsx`
- Modify `apps/mobile/app/(app)/_layout.tsx` or `more.tsx` (add entry points)

**Approach:** consume `api.contacts.list`/`getById`, `api.companies.list`/`getById`. Tap-to-call = `Linking.openURL('tel:…')`, email = `mailto:`, with sanitization (reject `javascript:`, control chars). Build `usePaginatedOrgList` + `<SearchList>` as the shared layer.

**Validation:** contacts list paginates + searches; tap call opens dialer; detail shows all web fields; empty state shows CTA; offline → banner.

**Done criteria:** green typecheck (mobile+web+convex), tests green, Expo Go smoke pass, infra hooks reused by at least one screen (proving extraction was worth it).

---

### P2.2 — Products Catalog

**Goal:** Read-only browse of products, category filter, price/stock detail in the field.

**Reuses:** P2.1 `<SearchList>` + `usePaginatedOrgList`.

**Files:** `app/(app)/products/index.tsx`, `[id].tsx`, `product-row.tsx`.

**Consumes:** `api.products.list`, `getByCategory`, `getById`.

**Done criteria:** as above + smoke on device.

---

### P2.3 — Deals Pipeline (view + stage update)

**Goal:** See deals grouped by stage, update a deal's stage, view deal detail. First real non-activity mutation → establishes `useMutationFeedback`.

**Consumes:** `api.deals.listByStage`, `getById`, **`updateStage`**. Links to contact/company (P2.1 detail screens via navigation).

**Files:** `app/(app)/deals/index.tsx` (stage sections / horizontal sweep), `[id].tsx`, `deal-card.tsx`; `src/hooks/use-mutation-feedback.ts` (infra).

**Done criteria:** stage update persists + reflects in web; optimistic UI + revert on failure; audit entry exists (verify server-side).

---

### P2.4 — Invoice Actions + Payments

**Goal:** Promote invoice module: **mark paid** (records a payment via `payments.create`), send reminder action.

**Consumes:** `api.payments.create`, `api.invoiceReminders.*`, existing `invoices.getById`.

**Files:** modify `app/(app)/invoices/[id].tsx` (add actions), new `record-payment-sheet.tsx`.

**Done criteria:** mark paid updates invoice + appears in web; money mutation audited; confirmation dialog on destructive.

---

### P2.5 — Sales Orders

**Goal:** List + detail + create sales order (line items, price lookup).

**Consumes:** `api.saleOrders.*`, `api.products.*` (price), `api.deals.convertToSaleOrder`.

**Done criteria:** create SO from mobile appears in web; line-item math matches web.

---

### P2.6 — HR Attendance / Clock-in

**Goal:** Clock-in/out with timestamp (+ optional GPS), attendance history, correction request.

**Needs:** device permissions (location). Standalone module.

**Consumes:** `api.hrAttendance.*`, `api.hrCorrections.*`.

**Done criteria:** clock-in recorded; history list; permission flow handled gracefully when denied.

---

### P2.7 — Settings / Admin

**Goal:** Team management, key org settings, role-gated views.

**Consumes:** `api.user.*`, `api.organization.*`, `api.permissionQueries.*`.

**Done criteria:** role-gated screens hide for unauthorized; admin actions audited.

---

## System-Wide Impact (reaffirmed per phase)

- **Web:** unchanged. Verify web typecheck every phase.
- **Backend:** unchanged unless an additive query/mutation is genuinely missing (then follow `createOrg*` + audit pattern).
- **Mobile:** additive screens only.
- **State lifecycle:** each module's mutations are server-transactional; mobile does optimistic UI with revert on failure.
- **Unchanged invariants:** DB schema, API contracts, web behavior.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope creep within a phase | Each phase has a fixed scope card; extras go to the next phase's backlog. |
| Reused mutation lacks mobile-needed behavior | Verify server-side before wiring; add additive mutation if needed (never weaken auth). |
| NativeWind/Reanimated crash class recurs (see skeleton incident) | Per-phase: `grep -rn "animate-\|active:scale\|hover:" apps/mobile` before merge; static fallback only. |
| Money path bug | P2.4 verifies `payments.create` audit + web parity before merge. |
| HR permissions (location) | P2.6 handles denial gracefully; GPS optional. |
| Big-bang merge | Strict per-phase branch + validation gate; nothing merges half-done. |

## Done Criteria (entire roadmap)

- Every phase P2.1–P2.7 merged with green mobile+web+convex typecheck, green tests, and a passing Expo Go smoke.
- No backend schema changes introduced (or, if any, each documented via `convex-migration-helper`).
- Web app behavior verified unchanged at roadmap completion.
- Shared infra (`usePaginatedOrgList`, `<SearchList>`, `useMutationFeedback`) reused by ≥2 phases each.

---

## How to execute this roadmap

1. Confirm this sequence (or reorder priorities).
2. Merge the hardening branch (`phase/mobile-hardening-and-distribution`) to `main`.
3. Branch `phase/mobile-p2.1-contacts-companies`.
4. Expand **P2.1** into bite-sized tasks (`superpowers:writing-plans`) and execute (`superpowers:subagent-driven-development`).
5. Repeat per phase.
