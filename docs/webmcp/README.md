# Ruang WebMCP implementation

The browser adapter is `apps/web/src/components/webmcp-tools.tsx`, mounted by
`components/providers.tsx`. It uses `use-webmcp-tool@0.3.0`. Signed-out sessions
register no tools. A browser without `document.modelContext` continues normally.

Read endpoints live in `convex/webmcp.ts`. They derive the active organization
from the authenticated session and check feature permissions. Explicit field
projections exclude notes and internal/session fields.

Writes use the existing `agentOperations.propose` ledger, never direct business
mutations. `create_company` and `create_deal` extend the shared operation kinds,
permissions, HTTP bridge, and claim-bound idempotent execution handlers.
Human approval and execution remain on `/approvals`, outside the tool catalog.

## Verification

Run from `/root/dev/CRM`:

```sh
NODE_ENV=test pnpm exec vitest run
pnpm exec tsc --noEmit -p convex/tsconfig.json
pnpm --filter @crm/web typecheck
cd apps/web
NODE_ENV=test pnpm exec vitest run src/__tests__/webmcp-tools.test.tsx
pnpm exec eslint src/components/webmcp-tools.tsx src/lib/webmcp/inputs.ts src/__tests__/webmcp-tools.test.tsx
```

Verified locally on 2026-10-26: 501 backend tests passed, including 13 WebMCP
query tests. The frontend tool suite has 15 tests. Backend and frontend
TypeScript checks and targeted ESLint passed. Session transport is mocked in
backend tests; browser registration is mocked in React tests. These are not
live authentication or native browser protocol tests.

The 12 cases in `evals.json` are model-selection specifications. They have not
run: no supported evaluation credentials exist in the process or project env
files. Static local evaluations do not require a live browser. After configuring
a provider, run from this directory:

```sh
npx webmcp-evals local -b gemini -m gemini-3.5-flash-lite -t schema.json -e evals.json
```

Current browser check: `/welcome` returned HTTP 200 with no JavaScript errors.
Chrome 156 reported `document.modelContext` as undefined. Enable WebMCP, then
sign in and inspect Application > WebMCP. Execute reads and proposals manually;
verify that proposals cannot approve or execute themselves. Run Lighthouse's
Agentic browsing audit separately. Neither native execution nor Lighthouse has
been verified here. Auth still warns that its development database adapter is
in memory; authenticated end-to-end tests remain blocked.

Backend deployed successfully on 2026-10-26 using the existing credential in
`.local/ruang-deploy.env`, with both `backend:check` and `backend:push` passing
the unchanged target guard. Target: `dev:glorious-eel-222`. The ambient process
credential had targeted another deployment; it was overridden only for this
command. Convex CLI identifies the remote project as `madearga:kukaboard`,
although local configuration labels the application project `ruang`.
No production deployment or data reset was performed.

## Known bounds

- Date-only inputs and supported phrases use UTC. Unknown phrases fail rather
  than guess. Pipeline date ranges refer to deal creation.
- Pipeline scans at most 500 active deals and exposes `partial: true` beyond
  that bound. Currency totals stay separate; missing currency is `unknown`.
- Deal title matching filters a scanned tenant page. Continue while `has_more`
  is true, including empty result pages. Exact totals are not claimed.
- Output above 1,500 characters fails explicitly. Nothing silently truncates.
- Identical proposals reuse one operation for the mounted tab. Reloading clears
  this retry cache, so inspect Approvals before retrying an interrupted request.
- Convex requests cannot be cancelled after dispatch. Cancellation does not
  roll back a proposal; no business write occurs without human execution.
- Navigation refuses dirty native inputs, dialogs and editable content.
  State-only custom drafts must set `data-unsaved-changes="true"`.
