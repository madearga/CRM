/**
 * Re-export the `convex/react` hooks used by mobile screens.
 *
 * This wrapper exists so mobile screens never import `convex/react` directly —
 * keeping a single import surface (`@/hooks/use-convex`) that we can later
 * extend with mobile-specific auth-aware variants (e.g. a `useAuthQuery` that
 * suspends until the Convex token exchange completes) without touching every
 * call site.
 *
 * NOTE: we deliberately do NOT re-export from `@convex-dev/react-query` (web
 * dependency, pulls `convex/browser`). `convex/react` is RN-safe.
 */
export { useQuery, useMutation, useAction, useConvex, usePaginatedQuery } from 'convex/react';
