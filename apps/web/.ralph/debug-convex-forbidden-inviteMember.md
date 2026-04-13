# Debug: Convex FORBIDDEN on organization:inviteMember

## Error
```
[CONVEX M(organization:inviteMember)] Server Error
Uncaught ConvexError: {"code":"FORBIDDEN","message":"Insufficient permissions for this action"}
    at hasPermission (convex/authHelpers.ts:220:8)
    at async handler (convex/organization.ts:818:4)
```

## Root Cause Investigation

### Evidence Gathered (Phase 1)
1. **Error location**: `hasPermission()` in `authHelpers.ts:220` throws when `canUpdate.success` is false
2. **Caller**: `organization.ts:818` — `await hasPermission(ctx, { permissions: { invitation: ['create'] } })`
3. **Mechanism**: Calls `ctx.auth.api.hasPermission({ body: { permissions: { invitation: ['create'] } }, headers })` — this is Better Auth's organization plugin API
4. **User context**: `ctx.user.activeOrganization?.role` determines what permissions the user has

### Investigation Checklist
- [ ] Find Better Auth config — check `invitation` permission setup
- [ ] Check how `ctx.auth` is constructed (what client, what plugin options)
- [ ] Check organization plugin options — default role permissions
- [ ] Check if the user's role (owner/member) has `invitation: ['create']` permission
- [ ] Check if `invitation` permission is a built-in Better Auth permission or custom
- [ ] Verify the auth context middleware passes correct headers
- [ ] Determine fix

## Phases
1. Phase 1: Root Cause Investigation (in progress)
2. Phase 2: Fix Planning
3. Phase 3: Implementation
4. Phase 4: Verification