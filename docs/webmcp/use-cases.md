# Ruang browser tool journeys

Status: backend deployed to development `glorious-eel-222`. `schema.json` defines 10 tools.
`evals.json` contains 12 model-selection cases, not evidence of model success.

## Shared starting states and boundaries

Tools register only with an authenticated Convex session. The server resolves
organization and user identity, and checks each feature's view permission.
The app exposes no approval or execution tool. All four proposal tools record
an operation in `awaiting_approval`; a person must approve and execute it at
`/approvals`. Proposal tools do not use `consequentialHint`, because they do not
commit the business change. Read results exclude notes, activity descriptions,
metadata, ownership, and session identifiers.

Lists return `items`, `page_size`, `next_cursor`, `has_more`, and
`total_count: null` (no exact total is available). A page has at most 5 rows.
Outputs over 1,500 characters fail explicitly, without silent truncation.
The caller can retry reads with limit 1, or open the item in the app.

## G1 — Find a company and read its key facts

Ideal outcome: identify the right company and report its basic facts.
Context: `/companies` or any signed-in page; company name from the person.
Boundary: reads do not navigate or return private notes.

1. Person: “Show the key facts for Nusantara Logistik.”
2. Intent: resolve the name; ask if multiple matches remain.
3. Call: `search_records {entity:"company",query:"Nusantara Logistik"}`.
4. Response: a page with `{id:"c1",name:"Nusantara Logistik"}`.
5. UI: unchanged. Then `get_record {entity:"company",id:"c1"}` reads facts.
6. Answer: summarize only returned facts; do not invent contacts or deals.

Variations: no match → offer spelling correction; multiple matches → ask;
“the second one” → use the exact prior result ID. Deal title search filters
one scanned page, so an empty page with `has_more: true` is not a final miss.

Critique: brief, factual tone; clarify only ambiguity; no autonomous writes.

## G2 — Understand pipeline health

Ideal outcome: see stage counts and values separated by currency.
Context: any signed-in page; optional creation-date range.
Boundary: no stage changes, no mixing currency totals.

1. Person: “Summarise deals created this quarter.”
2. Intent: use the creation-date basis, not close date or stage history.
3. Call: `pipeline_overview {from:"this quarter"}`.
4. Response: stage/currency groups, `partial`, `scanned`, `date_basis`, and
   `stalled_days:14`. Missing currency is a separate `unknown` group.
5. UI: unchanged.
6. Answer: report groups; qualify a partial result as incomplete.

Variations: empty pipeline → no invented totals; unsupported date phrase →
ask for a supported phrase or ISO date; more than 500 active deals → disclose
partial coverage. Dates use UTC. Stalled means a nonterminal deal whose known
`stageEnteredAt` is over 14 days old; unknown timestamps are not classified.

Critique: no unsupported revenue or close-date claims; no model date arithmetic;
no offer to move deals automatically.

## G3 — Record a call

Ideal outcome: queue a correctly linked call for human review.
Context: company or deal resolved by ID, signed-in session with create access.
Boundary: a proposal is not a saved business activity.

1. Person: “Record a Pricing call for company c1; Budi wants pricing by Friday.”
2. Intent: record the completed call and keep the sentence as a note, not
   silently schedule a second activity.
3. Call: `propose_activity {type:"call",title:"Pricing",entity:"company",
   entity_id:"c1",note:"Budi wants pricing by Friday"}`.
4. Response: `{status:"awaiting_approval",operation_id,approval_path:"/approvals"}`.
5. UI: timeline unchanged; the proposal is visible on the approvals page.
6. Answer: “Queued for review. Approve and execute it in Approvals.”

Variations: unresolved target → search or ask; explicit schedule → resolve the
raw date in the app; invalid entity → execution fails without writing.

Critique: distinguish recorded proposal from recorded call; no inferred date;
human approval and execution stay outside the agent tool catalog.

## G4 — Change a deal stage

Ideal outcome: queue the intended legal stage change for review.
Context: signed in; current deal or name known; edit permission.
Boundary: never approve or execute a proposal through a tool.

1. Person: “Move the Nusantara renewal to proposal.”
2. Intent: resolve exactly one deal.
3. Calls: `search_records {entity:"deal",query:"Nusantara renewal"}`, then
   `propose_deal_stage {deal_id:"d1",stage:"proposal"}`.
4. Response: proposal ID and approval path.
5. UI: stage unchanged; the approvals list receives the proposal.
6. Answer: name the target stage and say it is awaiting review.

Variations: several renewals → ask; lost without reason → ask for the reason;
illegal transition at execution → show the error, do not claim success.
Terminal-stage transitions follow the shared domain rules, not this document.

Critique: no silent stage update; ask only for missing target or required reason;
execution revalidates the live deal, even after approval.

## G5 — Add a company and first deal

Ideal outcome: company created after approval, then a linked deal proposed.
Context: company name and opportunity details, with create permissions.
Boundary: do not use an operation ID as a company ID or bypass either approval.

1. Person: “Add PT Sinar Jaya and a warehouse audit deal for IDR 40000000.”
2. Intent: search for duplicates; queue company first.
3. Calls: `search_records`, then `propose_company {name:"PT Sinar Jaya"}`.
4. Response: awaiting-approval operation, not a company ID.
5. UI: no company or deal created yet.
6. Answer: ask the person to approve and execute the company proposal first.

After the person executes it and supplies/resolves the resulting company ID,
propose `propose_deal {title:"Warehouse audit",company_id:"c9",
value:40000000,currency:"IDR"}`. The deal starts in `new`, and needs its own
approval and execution.

Variations: duplicate company → resolve the existing company; foreign company
ID → refuse; wrong currency → refuse and explain organization currency;
missing amount or currency → do not invent it.

Critique: sequence is explicit; no automatic company/deal transaction is
promised; an approval is bound to one exact payload.

## G6 — Check unpaid invoices

Ideal outcome: see posted customer invoices with an outstanding balance.
Context: `/invoices` or another signed-in route; invoice view permission.
Boundary: never issue, pay, cancel, or send an invoice.

1. Person: “Which customer invoices are unpaid?”
2. Intent: include partially paid invoices with an outstanding balance.
3. Call: `list_invoices {status:"unpaid"}`.
4. Response: paged number, balance, currency, due date, and state.
5. UI: unchanged.
6. Answer: show returned amounts; disclose more pages when available.

Variations: overdue → posted, outstanding and due before now; no matches →
say none on this page; long record → explicit budget error and app hand-off.

Critique: use the actual payment/state model, not invented invoice statuses;
pagination is visible; no payment action is exposed.

## Navigation hand-off

`open_record` opens company, contact, deal, and invoice lists/details. It refuses
when inputs differ from their defaults, a dialog is open, an editable region is
present, or an explicit unsaved-change marker exists. It waits for the target
URL and a rendering frame before returning. It is not a pure read, so it has
no `readOnlyHint`. Custom state-only drafts must set `data-unsaved-changes`.
