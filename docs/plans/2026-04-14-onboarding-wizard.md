# Onboarding Wizard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 2-step onboarding overlay for new users (org name → user name) that appears on first login before dashboard.

**Architecture:** Full-page overlay rendered inside `(dashboard)/layout.tsx`. When `user` has no `activeOrganization`, show `<OnboardingOverlay>` instead of sidebar+content. Single Convex mutation `completeOnboarding` handles org creation + user name update + template seeding atomically.

**Tech Stack:** Next.js App Router, Convex mutation, shadcn/ui Input + Button, Tailwind CSS, Framer Motion (optional fade)

---

### Task 1: Backend — `completeOnboarding` mutation

**Files:**
- Create: `convex/onboarding.ts`

**Step 1: Create the mutation file**

```typescript
// convex/onboarding.ts
import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { mutation } from './_generated/server';
import { getSessionUserWriter, requireUser } from './authHelpers';
import { getCtxWithTable } from './functions';
import { seedDefaultTemplates } from './permissionHelpers';
import { getAuth } from './auth';
import type { Id } from './_generated/dataModel';

const DEFAULT_ORG_CURRENCY = 'USD';

export const completeOnboarding = mutation({
  args: {
    organizationName: z.string().min(2).max(100),
    userName: z.string().min(2).max(100),
  },
  returns: z.object({
    organizationId: zid('organization'),
  }),
  handler: async (_ctx, args) => {
    const ctx = getCtxWithTable(_ctx);
    const user = requireUser(
      await getSessionUserWriter(ctx),
      'Authentication required'
    );

    // Guard: user must not already have an active org
    if (user.activeOrganization?.id) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'User already has an active organization',
      });
    }

    // 1. Update user name
    await user.patch({ name: args.userName });

    // 2. Generate slug from org name
    let slug = args.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (!slug) slug = 'workspace';

    // Ensure slug uniqueness
    let attempt = 0;
    while (attempt < 10) {
      const existing = await ctx.table('organization').get('slug', slug);
      if (!existing) break;
      slug = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
      attempt++;
    }

    // 3. Create organization via Better Auth
    const auth = getAuth(_ctx as any);
    const org = await auth.api.createOrganization({
      body: {
        monthlyCredits: 0,
        name: args.organizationName,
        slug,
      },
      headers: auth.headers ?? new Headers(),
    });

    if (!org) {
      throw new ConvexError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create organization',
      });
    }

    // 4. Patch org settings
    await ctx
      .table('organization')
      .getX(org.id as Id<'organization'>)
      .patch({
        settings: { currency: DEFAULT_ORG_CURRENCY },
      });

    // 5. Seed default permission templates
    await seedDefaultTemplates(
      ctx,
      org.id as Id<'organization'>,
      user._id as Id<'user'>
    );

    // 6. Set as active organization
    await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      headers: auth.headers ?? new Headers(),
    });

    return {
      organizationId: org.id as Id<'organization'>,
    };
  },
});
```

**Step 2: Verify Convex compiles**

Run: `cd /Users/madearga/Desktop/crm && npx convex dev --once 2>&1 | tail -5`
Expected: No errors, function registered.

**Step 3: Commit**

```bash
git add convex/onboarding.ts
git commit -m "feat(onboarding): add completeOnboarding mutation"
```

---

### Task 2: Frontend — `OnboardingOverlay` component

**Files:**
- Create: `apps/web/src/components/onboarding/onboarding-overlay.tsx`

**Step 1: Create the overlay component**

```tsx
'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2 } from 'lucide-react';

const STEPS = ['organization', 'user'] as const;
type Step = (typeof STEPS)[number];

export function OnboardingOverlay() {
  const [step, setStep] = useState<Step>('organization');
  const [orgName, setOrgName] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);

  const handleSubmit = async () => {
    if (step === 'organization') {
      if (orgName.trim().length < 2) return;
      setStep('user');
      return;
    }

    // Final step — submit to backend
    setIsSubmitting(true);
    setError(null);
    try {
      await completeOnboarding({
        organizationName: orgName.trim(),
        userName: userName.trim(),
      });
      // Page will re-render — user now has activeOrganization, overlay disappears
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-md space-y-8 px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Building2 className="size-6 text-white" />
          </div>
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            CRM
          </span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                STEPS.indexOf(step) >= i
                  ? 'w-8 bg-white'
                  : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 'organization' ? (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Name your workspace
            </h1>
            <p className="text-sm text-neutral-400">
              This is your company or team name
            </p>
            <Input
              placeholder="e.g. Acme Inc."
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-12 border-white/10 bg-white/5 text-white placeholder:text-neutral-500"
            />
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              What should we call you?
            </h1>
            <p className="text-sm text-neutral-400">
              Your name will appear on invoices and to team members
            </p>
            <Input
              placeholder="e.g. John Doe"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-12 border-white/10 bg-white/5 text-white placeholder:text-neutral-500"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            (step === 'organization' && orgName.trim().length < 2) ||
            (step === 'user' && userName.trim().length < 2)
          }
          className="h-12 w-full bg-white text-black hover:bg-neutral-200"
        >
          {isSubmitting
            ? 'Setting up...'
            : step === 'organization'
              ? 'Continue'
              : 'Get started'}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/onboarding/onboarding-overlay.tsx
git commit -m "feat(onboarding): add OnboardingOverlay component"
```

---

### Task 3: Frontend — Wire overlay into dashboard layout

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

**Step 1: Add onboarding check to layout**

In the layout component, before the `return` statement, add the onboarding guard:

```tsx
// After line: const permsLoaded = Object.keys(perms).length > 0;

// Show onboarding overlay if user is logged in but has no active org
const needsOnboarding = user && user.id && user.id !== '0' && !user.activeOrganization;

if (needsOnboarding) {
  return <OnboardingOverlay />;
}
```

Also add the import at the top of the file:

```tsx
import { OnboardingOverlay } from '@/components/onboarding/onboarding-overlay';
```

**Step 2: Verify typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/layout.tsx
git commit -m "feat(onboarding): wire overlay into dashboard layout"
```

---

### Task 4: Post-wizard success toast

**Files:**
- Modify: `apps/web/src/components/onboarding/onboarding-overlay.tsx`

**Step 1: Add toast on success**

In the `handleSubmit` function, after the successful mutation call, add:

```tsx
import { toast } from 'sonner';

// Inside handleSubmit, after completeOnboarding:
toast.success('Setup complete! Start by adding your first contact');
```

**Step 2: Verify toast is available**

Check that `sonner` is already installed and `<Toaster>` is in the root layout:
Run: `cd /Users/madearga/Desktop/crm && grep -r "Toaster\|sonner" apps/web/src/app/layout.tsx`

If not present, add `<Toaster />` to `apps/web/src/app/layout.tsx` and install sonner if needed.

**Step 3: Commit**

```bash
git add apps/web/src/components/onboarding/onboarding-overlay.tsx
git commit -m "feat(onboarding): add success toast after wizard completion"
```

---

### Task 5: Verification

**Step 1: Typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: Clean.

**Step 2: Lint**

Run: `cd /Users/madearga/Desktop/crm && pnpm lint`
Expected: Clean.

**Step 3: Convex deploy**

Run: `cd /Users/madearga/Desktop/crm && npx convex deploy`
Expected: Functions deployed, no errors.

**Step 4: Push**

```bash
git push
```

---

## File Summary

| Task | Action | File |
|------|--------|------|
| 1 | Create | `convex/onboarding.ts` |
| 2 | Create | `apps/web/src/components/onboarding/onboarding-overlay.tsx` |
| 3 | Modify | `apps/web/src/app/(dashboard)/layout.tsx` |
| 4 | Modify | `apps/web/src/components/onboarding/onboarding-overlay.tsx` |
| 5 | Verify | typecheck + lint + deploy |
