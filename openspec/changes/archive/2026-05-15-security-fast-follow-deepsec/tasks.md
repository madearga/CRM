## 1. CI/CD Supply Chain

- [x] 1.1 Add explicit least-privilege `permissions` blocks to CI/deploy workflows
- [x] 1.2 Replace floating deploy CLI/action versions with pinned versions where secrets are used
- [x] 1.3 Verify workflows still run expected jobs locally via YAML/static checks

## 2. Frontend Safety

- [x] 2.1 Add shared CSV cell sanitizer for formula-prefix values
- [x] 2.2 Apply sanitizer to product CSV export path
- [x] 2.3 Ensure company website href rendering uses `http`/`https` allowlist only

## 3. Product and Activity UI Bugs

- [x] 3.1 Fix product `removeTag` no-op so tag removal updates state
- [x] 3.2 Include auto-schedule delay value in schedule activity submission when present

## 4. Commerce Throttling

- [x] 4.1 Add real guest cart mutation rate limiting keyed by `orgId + sessionId`
- [x] 4.2 Add guest checkout rate limiting keyed by `orgId + sessionId`
- [x] 4.3 Return actionable errors when rate limits are exceeded

## 5. Verification

- [x] 5.1 Run `pnpm typecheck`
- [x] 5.2 Run `pnpm lint`
- [ ] 5.3 Re-run/refresh deepsec findings for affected files

> **Note**: deepsec re-run requires running the deepsec tool. Mark as pending operational task.
