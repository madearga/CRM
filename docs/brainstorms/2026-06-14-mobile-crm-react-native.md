# Mobile CRM App — Requirements Brainstorm

**Date:** 2026-06-14  
**Scope:** Build a mobile companion app for the existing CRM using React Native + Expo.  
**Project context:** `apps/mobile` currently exists as an empty placeholder in the Turborepo.

## 1. Why we are building this

- Users need quick access to CRM data while away from desktop (field sales, site visits, commuting).
- Mobile enables instant logging of calls/meetings and pipeline updates at the point of contact.
- Provides a faster feedback loop than responsive web for actions that are awkward on small screens.

## 2. Primary outcomes (success criteria)

- [ ] A user can open the app, see dashboard KPIs, and navigate to any major module in under 3 taps.
- [ ] A user can update a deal stage or log an activity in under 30 seconds from the home screen.
- [ ] Session/auth state is shared with the web app so users do not need to re-authenticate daily.
- [ ] Internal stakeholders (TestFlight + APK) can validate the app within 4–6 weeks of implementation start.

## 3. Scope boundaries

### In scope (Phase 1 — web parity lite)

- **Dashboard** — KPI cards, insights widget, lightweight activity feed.
- **Deals** — pipeline board (kanban/swipe), deal detail, stage update.
- **Contacts & Companies** — list, search, detail, quick action (call/WhatsApp).
- **Activities** — create/edit/log call, email, meeting, note; upcoming list.
- **Invoices** — list outstanding/overdue, detail view, send reminder.
- **HR** — employee list, attendance records, clock-in/clock-out (if supported by backend).
- **Settings** — organization switcher, logout.

### Out of scope / deferred

- Deep reporting and analytics charts beyond simple KPI cards.
- Admin/permission management.
- Storefront/customer-facing shop features (`app/[slug]`).
- Offline-first full sync (Phase 2).
- Push notifications (Phase 2).
- Deep linking to per-record web views.
- Native payment collection.

## 4. User stories

- As a sales rep, I want to update a deal stage immediately after a client meeting so the pipeline stays current.
- As a sales rep, I want to log a call activity with one tap so I do not forget the interaction context.
- As a manager, I want to see today’s KPIs on mobile so I can check team performance without opening my laptop.
- As an HR admin, I want to see who has clocked in today so I can follow up with absent staff.
- As a finance user, I want to see overdue invoices so I can send reminders while traveling.

## 5. Key product decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | **React Native + Expo** | Matches existing React skillset; fastest path to iOS + Android. |
| Auth | **Reuse Better Auth via shared session** | One auth system across web and mobile; keeps JWT/session handling centralized. |
| Shared code | **Domain + hooks + business logic** | Avoid drift in validators, types, and Convex query logic. UI components stay React Native native. |
| Platform target | **Internal distribution first** | TestFlight + internal APK for stakeholder validation before store submission. |
| Offline strategy | **Optimistic UI with online-only reads** | Mobile app expects connectivity; offline sync deferred to Phase 2. |

## 6. UX / mobile-specific considerations

- Dashboard should be **card-first, tappable, scannable** — not a shrunken desktop table.
- Pipeline board should support **swipe gestures** and a **bottom sheet stage picker**.
- Activities should have a **floating quick-log button** reachable from any main tab.
- Contacts should expose **tap-to-call, tap-to-WhatsApp, tap-to-email** actions.
- Tables from web (invoices, products, sales performance) become **filterable lists with detail screens**.
- Bottom tab bar for primary modules; nested stacks for detail flows.

## 7. Technical assumptions

- Convex React Query hooks from `@crm/auth` / web can be reused if they do not import Next.js-specific modules.
- Better Auth supports mobile token/session exchange or webview-based SSO.
- `@crm/domain` types/validators are platform-agnostic.
- `@crm/ui` shadcn components cannot be reused directly; a parallel mobile component library is needed.
- Expo SDK is current enough to support the chosen navigation and camera/contact APIs.

## 8. Risks

- **Scope risk:** "Semua fitur dashboard web" is large for Phase 1. Consider splitting into internal MVP (dashboard + deals + activities) followed by feature waves.
- **UX risk:** Desktop tables/charts do not map cleanly to mobile. Requires deliberate mobile-first redesign, not 1:1 porting.
- **Auth risk:** Shared session between web and mobile may require changes to Better Auth cookie/token handling.
- **Performance risk:** 8+ dashboard queries firing on mobile could feel slower than web; may need a single consolidated mobile dashboard query.
- **Store risk:** If Play/App Store submission is required later, adds review/privacy/compliance work.

## 9. Open questions (to resolve before planning)

1. Does Better Auth currently expose a token/session endpoint consumable by a native app, or do we need to add it?
2. Should the mobile app share Convex backend mutations as-is, or create mobile-optimized mutation wrappers?
3. Which existing web components/hooks import Next.js APIs that would break in a React Native bundle?
4. Do we need biometric login (Face ID/Touch ID) for Phase 1 or later?
5. Is there budget for TestFlight + Play Console accounts, or should we start with Expo Go/internal build only?
6. Should offline read caching be included in Phase 1, or strictly online-only?

## 10. Proposed next step

Move to `/ce-plan` with this brainstorm as input. First planning deliverable should be a **technical spike** covering:
- Expo setup inside `apps/mobile`
- Auth/session integration with Better Auth
- Shared package audit (what can be imported from `@crm/domain`, `@crm/auth`, `@crm/config`)
- Mobile navigation + bottom tab structure
- First screen implementation: **Mobile Dashboard** (dashboard + quick log activity)
