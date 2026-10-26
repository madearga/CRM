> Superseded for WebMCP: the ten tools in `docs/webmcp/schema.json` are the
> current contract for the browser layer. This file remains the wider draft,
> including writes that need new operation kinds.

# Ruang agent tool contract (draft v0)

The tools an agent can call against Ruang, whether it reaches them through the
HTTP MCP endpoint or through WebMCP in the browser. One contract, two adapters.

Status: draft for review. Nothing here is implemented yet.

## Rules that hold for every tool

- The organization always comes from the session or the token. No tool takes an
  `organizationId` argument, so a call cannot cross an organization border.
- A tool never accepts a user id from the caller either. The owner of a write is
  the caller.
- Ids are opaque strings from an earlier read. Tool descriptions say which read
  produces them, the way the espresso store says "use the slugs from
  `search_products`".
- Dates and times are ISO 8601 strings in the tool arguments and the results.
  Convex stores epoch milliseconds; the adapter converts.
- Money is a number in major units plus a currency code. `value: 15000000`,
  `currency: "IDR"`.
- Lists take `limit` (default 20, max 50) and `cursor` for pagination. A result
  reports `hasMore` and `nextCursor`.
- Every error is a result, not an exception: `{ ok: false, code, message }`.
  Codes: `not_found`, `forbidden`, `invalid_argument`, `conflict`, `rate_limited`.
- Reads run directly. Writes never run directly: they create a proposal in
  `agentOperations` and wait for a person to approve it.
- Tool names are `verb_noun`, lowercase, one namespace, no prefix.

## Read tools (7)

### `search_companies`
Find companies by name or domain. Returns ids for `get_company`.

| argument | type | required | note |
| --- | --- | --- | --- |
| `query` | string | no | Name or domain fragment |
| `limit` | number | no | Default 20, max 50 |

Returns: `{ id, name, domain, industry, location, updatedAt }[]`.

### `get_company`
One company with its contacts and open deals.

| argument | type | required |
| --- | --- | --- |
| `companyId` | string | yes |

Returns: company fields, `contacts[]`, `openDeals[]`, `recentActivities[]`.

### `list_deals`
Pipeline rows, filtered and paginated.

| argument | type | required | note |
| --- | --- | --- | --- |
| `stage` | enum | no | `new`, `contacted`, `proposal`, `won`, `lost` |
| `companyId` | string | no | |
| `ownerId` | string | no | |
| `query` | string | no | Title search |
| `limit` | number | no | Default 20, max 50 |
| `cursor` | string | no | |

Returns: `{ id, title, stage, value, currency, companyId, ownerId, expectedCloseDate, updatedAt }[]`.

### `get_deal`
One deal with its company, contact, activities and stage history.

| argument | type | required |
| --- | --- | --- |
| `dealId` | string | yes |

Returns: deal fields, `company`, `primaryContact`, `activities[]`,
`stageEnteredAt`.

### `pipeline_summary`
Aggregates for the pipeline, not a list of rows.

| argument | type | required | note |
| --- | --- | --- | --- |
| `from` | string | no | ISO date; defaults to 90 days ago |
| `to` | string | no | ISO date; defaults to now |

Returns: `{ byStage: { stage, count, value }[], wonValue, lostValue, currency }`.
Value is summed per currency and the result carries the dominant currency.

### `list_activities`
Recent activity, optionally scoped to one entity.

| argument | type | required | note |
| --- | --- | --- | --- |
| `entityType` | enum | no | `company`, `contact`, `deal` |
| `entityId` | string | no | Required when `entityType` is set |
| `type` | enum | no | `call`, `email`, `meeting`, `note`, `status_change` |
| `limit` | number | no | Default 20, max 50 |

Returns: `{ id, type, title, entityType, entityId, status, scheduledAt, completedAt }[]`.

### `list_invoices`
Invoice status for a company or a deal.

| argument | type | required | note |
| --- | --- | --- | --- |
| `companyId` | string | no | |
| `status` | enum | no | `draft`, `sent`, `paid`, `overdue`, `void` |
| `limit` | number | no | Default 20, max 50 |

Returns: `{ id, number, status, amountDue, currency, dueAt, companyId }[]`.

## Write tools (3 proposals + 2 navigation)

Writes become operations. The existing registry allows two kinds today:
`create_activity` and `update_deal_stage`. The two other writes below need new
kinds before they can ship.

### `propose_create_deal`
| argument | type | required | note |
| --- | --- | --- | --- |
| `title` | string | yes | |
| `companyId` | string | no | |
| `primaryContactId` | string | no | |
| `value` | number | no | Major units |
| `currency` | string | no | `IDR` or `USD` |
| `stage` | enum | no | Defaults to `new` |
| `expectedCloseDate` | string | no | ISO date |
| `reason` | string | yes | Why the agent proposes this |

Needs a new operation kind: `create_deal`.

### `propose_update_deal_stage`
| argument | type | required | note |
| --- | --- | --- | --- |
| `dealId` | string | yes | |
| `stage` | enum | yes | Must be a legal transition |
| `note` | string | no | Added as an activity note |
| `reason` | string | yes | |

Operation kind: `update_deal_stage` (exists).

### `propose_log_activity`
| argument | type | required | note |
| --- | --- | --- | --- |
| `type` | enum | yes | `call`, `email`, `meeting`, `note` |
| `title` | string | yes | |
| `entityType` | enum | yes | `company`, `contact`, `deal` |
| `entityId` | string | yes | |
| `scheduledAt` | string | no | ISO date |
| `description` | string | no | |
| `reason` | string | yes | |

Operation kind: `create_activity` (exists).

### `propose_create_company`
| argument | type | required | note |
| --- | --- | --- | --- |
| `name` | string | yes | |
| `domain` | string | no | |
| `industry` | string | no | |
| `location` | string | no | |
| `reason` | string | yes | |

Needs a new operation kind: `create_company`.

### `open_company` and `open_deal` (WebMCP only)

These change which view is open. They write nothing, so they never become
operations and they do not exist on the HTTP MCP endpoint.

| argument | type | required |
| --- | --- | --- |
| `companyId` / `dealId` | string | yes |

## Shape of a proposal result

Every `propose_*` tool returns the same envelope, so an agent can tell a person
what will happen without another read:

```
{
  ok: true,
  operationId: "...",
  status: "awaiting_approval",
  summary: "Create deal \"Renewal Q1\" for PT Contoh, Rp 15.000.000, stage new",
  expiresAt: "2026-10-27T12:00:00Z"
}
```

A proposal that was already approved under the same operation key returns the
same `operationId`, never a second write.

## What this contract deliberately leaves out

- Deleting or archiving anything.
- Sending invoices or email.
- Reading another person's private notes.
- Bulk writes. An agent that needs 50 changes proposes 50 times, or a person
  does it in the UI.

## Where each tool lives

- Reads call the existing queries: `deals.list`, `deals.getById`,
  `companies.list`, `companies.getById`, `activities.listRecent`,
  `invoices.*`.
- Proposals call `agentOperations.propose`, which already binds approval to the
  canonical payload hash.
- The HTTP adapter lives at `apps/web/src/app/api/mcp/route.ts`; the WebMCP
  adapter lives in `apps/web/src/webmcp/` and reuses the same argument schemas.
