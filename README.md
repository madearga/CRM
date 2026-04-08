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
