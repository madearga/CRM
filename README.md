# Ruang

Business workspace built on the CRM foundation: Convex + Better Auth + Next.js.
Pi agent foundation: Z.AI `glm-5.3-flash`. The durable room runtime is not enabled yet.

## Setup

Use Node.js 22 and pnpm 10.14.0.

```bash
pnpm install --frozen-lockfile
```

Before starting or pushing, create and verify a **dedicated `madearga/ruang` development deployment**. Pin its exact name in `config/deployment-target.json`, then configure the root and `apps/web` `.env.local` files from their examples. The initial pin is deliberately empty: commands must fail closed instead of selecting another application.

```bash
pnpm backend:check
pnpm backend:push
pnpm dev
```

Never reuse a deployment key from another project, and do not run raw `convex dev`/`deploy` commands for Ruang. Development uses an explicitly authenticated Convex account; the guard refuses deployment-key and self-hosted overrides. Next dev binds to loopback; use an SSH tunnel for MacBook access.

## Verification

```bash
pnpm test
pnpm typecheck --force
pnpm exec tsc --noEmit -p convex/tsconfig.json
pnpm lint
pnpm --filter @crm/web build
```

Deployment workflows are manual and disabled unless the owner explicitly enables `RUANG_PRODUCTION_DEPLOY_ENABLED`. Do not enable it before verifying the production targets and secrets. Tests and builds do not prove OAuth or durable crash recovery.

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

- Next.js 16 (App Router, Turbopack)
- Convex 1.48 (Cloud)
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
