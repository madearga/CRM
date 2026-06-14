## Context

The app combines CRM/admin workflows with a public online shop. CRM users should authenticate with org membership and permissions. Storefront buyers may be anonymous guests, so post-checkout actions cannot rely on `ctx.userId`. Existing findings cluster around this missing boundary: guest order access, cross-tenant cart lookup, checkout stock manipulation, webhook order ambiguity, public data exposure, and broken UI actions.

## Goals / Non-Goals

**Goals:**
- Preserve guest checkout.
- Make guest access secure through scoped session and order tokens.
- Make admin access permission-based.
- Make webhook access signature-based and org-scoped.
- Centralize repeated security logic in reusable helpers.

**Non-Goals:**
- Force every buyer to create an account.
- Redesign the storefront UI.
- Implement a full fraud/risk engine.

## Decisions

### 1. Three Access Boundaries

- **CRM/Admin**: authenticated user + active organization + permission.
- **Storefront Guest**: organization slug + sessionId for cart, then order access token for post-checkout order actions.
- **Webhook**: provider signature + provider transaction/order identifier + organization scope.

### 2. Guest Order Token

At order creation, generate a high-entropy token. Store only a hash on the order. Return the raw token once to the frontend and include it in order links or client-side storage. For order detail, payment status, and guest cancellation, require `orderNumber + token + organizationSlug`.

### 3. Cart Access Helper

Create `requireCartAccess(ctx, { orgId, sessionId, cartId? })`:
- Auth user: verify org membership and customer mapping.
- Guest user: verify cart.sessionId and cart.organizationId.

Cart lookup must always include `organizationId` and not use sessionId globally.

### 4. Order State Machine

Create `transitionOrderStatus(ctx, order, nextStatus, actor)`:
- validates allowed transitions,
- prevents repeated cancel/expire stock returns,
- centralizes stock changes,
- appends timeline events,
- distinguishes guest vs admin actor.

### 5. Public Data DTOs

Public storefront product/company responses use explicit DTO builders. Internal fields like cost, notes, SKU, barcode, internal IDs, and unsafe URLs are excluded unless caller is an org member.

## Risks / Trade-offs

- Token flow adds schema and frontend changes, but avoids forcing login.
- Session cart remains public-ish, so rate limiting and org scoping are mandatory.
- Webhook provider APIs may not provide orgId directly; we may need provider config lookup by transaction metadata.
