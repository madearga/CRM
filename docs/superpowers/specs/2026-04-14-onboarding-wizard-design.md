# Onboarding Wizard — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Problem

User baru yang signup langsung masuk dashboard kosong tanpa context. Tidak ada org name, user name kosong, dan tidak ada guidance. Perlu pengalaman first-time yang singkat tapi jelas.

## Solution

Full-page overlay wizard 2 step yang muncul hanya saat user membuat organisasi baru (first login). Setelah selesai, redirect ke dashboard dengan success toast.

## Flow

```
User signup via Google OAuth
  → Backend check: does user have an organization?
    → YES: skip onboarding, go to dashboard
    → NO: show onboarding overlay
      → Step 1: Organization name (required)
      → Step 2: User display name (required)
      → Submit → create org + update user → redirect dashboard + toast
```

## Trigger Logic

- **When:** After first successful login where user has no organization
- **Who:** Only the org creator (owner). Invited users skip entirely.
- **How:** Frontend checks `user.organizations` — if empty or `activeOrganizationId` is null, show overlay

## Step 1: Organization Name

- Full-page overlay, dark/solid background (`#0a0a0a` or theme-matched)
- CRM logo centered di atas
- Heading: "Name your workspace"
- Subtext: "This is your company or team name"
- Single text input: organization name (required, min 2 chars)
- "Continue" button, disabled until input valid

## Step 2: Your Name

- Same full-page overlay style
- Heading: "What should we call you?"
- Subtext: "Your name will appear on invoices and to team members"
- Single text input: display name (required, min 2 chars)
- "Get started" button

## Post-Wizard

- Backend: create organization, create member (owner role), set `activeOrganizationId`, seed default permission templates (Owner/Admin/Member)
- Frontend: redirect to `/` (dashboard)
- Toast: "Setup complete! Start by adding your first contact"

## Schema Changes

None. Existing schema already supports:
- `organization.name` — set in step 1
- `user.name` — set in step 2
- `member.role` — defaults to `owner`
- `permissionTemplates` — seeded via `seedDefaultTemplates()`

## Backend Changes

### `convex/onboarding.ts` (new)

```typescript
// Single mutation that creates org + member + seeds templates
export const completeOnboarding = mutation({
  args: {
    organizationName: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    // 1. Update user name
    // 2. Create organization
    // 3. Create member (role: owner)
    // 4. Seed default permission templates
    // 5. Return org id
  }
});
```

## Frontend Changes

### `apps/web/src/components/onboarding/onboarding-overlay.tsx` (new)

- Full-screen overlay component with step state
- 2 steps: org name → user name
- Animated step transitions (fade)
- Calls `completeOnboarding` mutation on submit

### `apps/web/src/app/(dashboard)/layout.tsx`

- Add onboarding check: if user has no active org, render `<OnboardingOverlay />` instead of sidebar + content
- After onboarding completes, normal dashboard renders

### Edge cases

- **User refreshes mid-wizard:** No org created yet, so overlay shows again — safe
- **User navigates away:** Same — no org = overlay persists
- **Multiple tabs:** First tab to submit wins. Other tab gets org on next query refresh
- **Network error on submit:** Show error toast, user retries

## What This Does NOT Include

- Logo upload → settings page later
- Industry/sector → settings page later
- Team size → settings page later
- Data import → separate feature
- Invited user onboarding → not needed (go straight to dashboard)

## Success Criteria

1. User baru signup → lihat onboarding overlay, bukan dashboard kosong
2. 2 step selesai dalam < 30 detik
3. Org + member + templates tercipta di backend
4. Invited users tidak lihat onboarding
5. Dashboard muncul dengan success toast setelah wizard
