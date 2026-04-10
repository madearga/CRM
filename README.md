# CRM

Personal CRM built with Convex + Better Auth + Next.js.

## Setup

```bash
pnpm install
pnpm dev
```

## Structure

```
apps/web       — Next.js app
apps/mobile    — Expo placeholder (Phase 4)
packages/
  domain       — enums, validators, types, permissions
  ui           — shared components
  auth         — Better Auth config, session helpers
  config       — env schema, app constants
  utils        — shared utilities
convex/        — Convex backend (at repo root)
```

## Tech Stack

- Next.js 15 (App Router, Turbopack)
- Convex (Cloud)
- Better Auth
- Tailwind CSS + shadcn/ui
- Turborepo + pnpm workspaces

## Risk: convex-ents (Community Library)

The data layer uses [convex-ents](https://github.com/sondregjellestad/convex-ents), a community-maintained library (not official Convex). It provides an entity/edge abstraction over Convex's raw table API.

**Mitigation plan if convex-ents is abandoned or breaks:**

1. convex-ents is used only in `convex/schema.ts` (definitions) and through the `entsTableFactory` helper in `convex/functions.ts`. The surface area is small.
2. All ent definitions use standard Convex value types (`v.string()`, `v.number()`, etc.) — migrating to raw Convex schema would require rewriting `defineEnt` → `defineTable` calls and replacing `ctx.table()` calls with `ctx.db.query()`/`ctx.db.get()`/`ctx.db.insert()`.
3. Estimated migration effort: ~1–2 days for the current schema size (~10 tables, ~30 functions).
4. The `packages/domain` package has no dependency on convex-ents and would survive a migration unchanged.

If the library stops receiving updates after a Convex breaking change, check [convex-ents GitHub issues](https://github.com/sondregjellestad/convex-ents/issues) first. If no fix is forthcoming, begin migration to raw Convex data access.
