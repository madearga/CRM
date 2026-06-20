## Agent-Native Architecture Review

### Summary
This branch introduces the mobile CRM MVP (`apps/mobile`) as a React Native + Expo app backed by Convex. The codebase already has an AI-agent integration layer in the Convex backend: `convex/aiChat.ts` exposes a chat endpoint that calls OpenAI/OpenRouter with a system prompt (`convex/aiSystemPrompt.ts`) and a fixed tool registry (`convex/aiTools/definitions.ts` + `convex/aiToolInternals.ts`). The shared Convex data model means agents and users can in principle operate in the same workspace, but the **new mobile features are largely not exposed to the agent**. The new `dashboard.mobileOverview` query, the `activities.upcoming` / `activities.listRecent` attention views, the mobile invoice detail shape, and the full lifecycle of an activity (complete/cancel/reschedule) have no equivalent agent tool. The one existing overlap — `createActivity` — is a partial match because the internal implementation does not set the `status: 'planned'` / `scheduledAt` fields that the mobile "Upcoming" list expects, so agent-created activities silently fail to appear where mobile users look for them. Overall parity: **NEEDS WORK**.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| View dashboard attention + KPIs | `apps/mobile/app/(app)/index.tsx:70` | none matching `dashboard.mobileOverview` | No | Must | Missing |
| View upcoming activities list | `apps/mobile/app/(app)/activities/index.tsx:48` | none | No | Must | Missing |
| View recent activities list | `apps/mobile/app/(app)/activities/index.tsx:49` | none | No | Must | Missing |
| Create activity | `apps/mobile/app/(app)/activities/new.tsx:113` | `createActivity` (`convex/aiTools/definitions.ts:86`) | Partial ("aktivitas" mentioned) | Must | Partial |
| View invoice list (overdue/outstanding/all) | `apps/mobile/app/(app)/invoices/index.tsx:96` | `listInvoices` (`convex/aiTools/definitions.ts:226`) | Partial | Must | Partial |
| View invoice detail (lines, payments, notes) | `apps/mobile/app/(app)/invoices/[id].tsx:60` | `getInvoice` (`convex/aiTools/definitions.ts:238`) | Partial | Must | Partial |
| Search/link entity | `apps/mobile/src/components/entity-picker.tsx:1` | `searchEntities` (`convex/aiTools/definitions.ts:116`) | Partial | Should | Partial |
| Sign out | `apps/mobile/app/(app)/settings.tsx:60` | N/A | N/A | Low | N/A |
| View settings / app version | `apps/mobile/app/(app)/settings.tsx:1` | none | No | Low | Missing |
| Retry network check | `apps/mobile/src/components/network-banner.tsx:1` | N/A | N/A | Low | N/A |

### Findings

#### Critical (Must Fix)
1. **Agent-created activities do not surface in the mobile Upcoming list** — `convex/aiToolInternals.ts:316` (`createActivityForHttp`) inserts an activity with `dueAt` but omits `status: 'planned'` and `scheduledAt`. The mobile Upcoming query (`convex/activities.ts:147` `upcoming`) filters on `status === 'planned'`, so activities created by the agent via the existing `createActivity` tool are invisible in the mobile attention view. Fix: align the agent activity creation with the mobile `schedule` mutation — set `status: 'planned'`, `scheduledAt`, and `dueAt` (and consider `assigneeId` so the activity is assigned to the requesting user). Alternatively expose the public `api.activities.schedule` mutation to the agent.

#### Warnings (Should Fix)
1. **No agent access to the mobile dashboard / attention model** — `convex/dashboard.ts:273` adds `mobileOverview`, a single-round-trip attention payload (`openDealsCount`, `overdueActivitiesCount`, `overdueInvoicesTotal`, `revenueMTD`, `recentActivities`, `overdueInvoices`). The agent has `getDashboardStats`, but it returns the old web-style stats and does not include the new attention/KPI data users see on mobile. Fix: add a `getMobileDashboard` or `getAttentionOverview` tool backed by `dashboard.mobileOverview`, and document it in the system prompt.
2. **No agent tools for reading the activity attention views** — The mobile app exposes two primary activity views: Upcoming (`api.activities.upcoming`, `convex/activities.ts:147`) and Recent (`api.activities.listRecent`, `convex/activities.ts:116`). The agent can only create activities; it cannot list, read, complete, cancel, or reschedule them. Fix: add primitive tools such as `listUpcomingActivities`, `listRecentActivities`, `getActivity`, `completeActivity`, `cancelActivity`, and `rescheduleActivity` that map to the public Convex queries/mutations.
3. **Invoice detail tool is missing fields the mobile screen shows** — `apps/mobile/app/(app)/invoices/[id].tsx:60` renders line items, payments, payment status, notes, internal notes, discount/tax breakdown, and amount due. The existing `getInvoice` tool (`convex/aiTools/definitions.ts:238` → `convex/aiToolInternals.ts:433`) returns only `id`, `number`, `type`, `state`, `totalAmount`, `companyId`, `dueDate` and omits `amountDue`, `paymentStatus`, `lines`, `payments`, `notes`, and `internalNotes`. Fix: extend the internal invoice getter to return the same shape used by `api.invoices.getById`.
4. **Invoice list tool uses different state taxonomy and lacks amount due** — Mobile uses Convex states `draft | posted | paid | cancel` and shows `amountDue`/`dueDate`. The agent's `listInvoices` tool (`convex/aiTools/definitions.ts:226`) exposes statuses `draft | sent | paid | overdue | cancelled`, does not return `amountDue`, and does not support the mobile "overdue/outstanding" classification. Fix: align the tool schema with the mobile data model and return `amountDue`, `currency`, and `dueDate`.

#### Observations
1. **System prompt has no mobile-specific context** — `convex/aiSystemPrompt.ts:3` injects org, user, and date, plus a static capability list. It does not mention the mobile app, the attention model, `mobileOverview`, or that activities created by the agent should appear in the mobile Upcoming list. Consider adding mobile/workspace context and linking each capability to its tool.
2. **No agent entry point in the mobile app** — `apps/mobile/app/(app)/index.tsx` and the tab shell contain no AI chat or assistant surface. This is expected for an MVP scaffold, but it means mobile-only users cannot delegate the actions listed above to the agent at all unless they use the web chat.
3. **Settings/sign-out are intentionally human-only flows** — Authentication, confirmation dialogs, and secure-storage cleanup are not expected to have agent equivalents, so no parity gap is flagged there.
4. **Tool design is mostly primitive-oriented** — `createActivity`, `listInvoices`, `getInvoice`, `searchEntities`, etc. are data primitives rather than workflow tools. The only workflow-ish behavior is `markAttendance` returning an explanation, but that is outside the mobile MVP scope.

### What's Working Well
- **Shared workspace foundation is in place**: both the mobile app and the agent read/write the same Convex tables (`activities`, `invoices`, `companies`, `contacts`, `deals`), so adding parity tools does not require a separate sync layer.
- **Agent integration already exists and is authenticated**: `convex/aiChat.ts` verifies Better Auth sessions, passes `orgId`/`userId` to tool execution, and routes tools through `internal.aiToolInternals` queries/mutations. Extending it is a matter of adding definitions + executor cases.
- **The new backend query is intentionally agent-friendly**: `dashboard.mobileOverview` returns a consolidated, structured payload that is ideal for a single agent tool.
- **Existing primitive tools cover related nouns**: companies, contacts, deals, and (partially) invoices already have agent tools, so the new activity/invoicing parity work can build on established patterns.

### Score
- **2/6 high-priority capabilities are agent-accessible** (dashboard attention/KPIs, upcoming list, recent list, create activity, invoice list, invoice detail). The two partial matches are invoice read (list + detail) and activity creation, but neither fully matches the mobile shape or behavior.
- **Verdict:** NEEDS_WORK
