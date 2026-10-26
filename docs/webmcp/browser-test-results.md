# Live browser and development backend checks

Date: 2026-10-26. Target: `glorious-eel-222`.

## Passed

- Launched isolated Chromium 156 with `--enable-features=WebMCP` through
  `npx agent-browser`, session `ruang-webmcp`. Native `document.modelContext`
  exists and exposes `getTools`, `executeTool`, and `registerTool`.
- Native `getTools()` returned an empty array while signed out on `/login`,
  `/companies`, `/deals`, and `/invoices`. This verifies signed-out gating,
  not authenticated registration.
- Real unauthenticated requests to the development backend were rejected for
  all 5 read endpoints: searchRecords, getRecord, pipelineOverview,
  listActivities, and listInvoices.
- An unauthenticated `agentOperations.propose` request was rejected before
  recording a company proposal. No approval or execution endpoint was called.
- The shared browser reached Google's sign-in page from the Ruang login button
  on the Tailscale HTTPS origin. OAuth callback completion is not yet tested.

## Pending

The shared browser has no authenticated Google/Ruang session. A person must
complete sign-in. The shared browser also lacks native WebMCP; only the
isolated browser above currently has the feature enabled. Do not count one
browser's state as evidence about the other.

Authenticated discovery of all 10 tools, native tool execution against real
records, proposal appearance in Approvals, cross-route authenticated checks,
Lighthouse, and model-selection evaluations remain pending.

The backend emitted Better Auth's memory-adapter warning during rejection
checks. These checks do not establish persistence across restarts.

## Native browser fixture follow-up

An isolated Vite page at loopback port 3006 imports the real `WebMCPTools`
component and real `use-webmcp-tool` package. Only the session, Convex client,
and router adapter are replaced by fixtures. Server authentication remains
unchanged. Fixture files are ignored local files in
`apps/web/.local/webmcp-browser/`, not an application authentication bypass.

The native Chromium `document.modelContext.executeTool` checks passed: 21/21.
They cover discovery of all 10 tools, successful invocation of all 10,
proposal-only mutations, identical-proposal deduplication, missing loss reason,
invalid limit, caller identity rejection, output budget errors, dirty-form
navigation protection, route synchronization, and unregistering on logout.
No approval or execution tool exists. Four proposals were stored only in
fixture memory; none reached the real backend.

Reproduction: start `serve.mjs` with Node in development mode, open port 3006
in the `ruang-webmcp` browser session with the WebMCP feature enabled, then
run `agent-browser --session ruang-webmcp eval --stdin < check.js` from the
fixture directory. Reload the page before repeating the check.

This verifies native browser integration with simulated data. Authenticated
real-data end-to-end testing, model evaluations, and Lighthouse remain pending.

## 2026-10-26 — Authenticated end-to-end (real session, real Convex data)

- Session: real Google login (owner), injected via session cookie into agent-browser `ruang-webmcp` (Chromium 156, `--enable-features=WebMCP`), origin `https://vmi3311790.taila50457.ts.net:8452`.
- Data: seeded CRM data in `dev:glorious-eel-222` (5 companies, 10 contacts, 15 deals, 29 activities, 2 invoices).
- Script: `.local/webmcp-browser/check-real.js` — **25/25 passed**.
- Covers: 10 tools registered; no approve/execute tool; search/get/pipeline/activities/invoices on real records; notes never returned; 4 proposals queued (idempotent `propose_company` dedupe); loss-reason, limit, injected `userId`, unknown-id rejections; `open_record` route sync.
- Verified in UI: `/approvals` shows the 4 proposals, all "Menunggu", human-only decision.
