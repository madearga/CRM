/**
 * Re-export of the Convex generated `api` for the mobile app.
 *
 * `convex/_generated/api.js` only imports from `convex/server` (pure, RN-safe),
 * so it can be bundled by Metro without pulling any web-only deps. We import
 * it via a relative path here so no extra Metro alias is required; consumers
 * import from `@/lib/api` (resolved via the `@/*` tsconfig path).
 *
 * NOTE: `@/*` is a tsconfig-only alias today. Metro resolution of `@/*` is set
 * up in U1/U2; the spike imports this module via a relative path to avoid that
 * dependency for now.
 */
export { api } from '../../../../convex/_generated/api';

/**
 * Convex generated types re-exported so mobile screens can type route params
 * (e.g. `Id<'invoices'>`) and document shapes without a deep relative import.
 * Pure type re-export — zero runtime cost, RN-safe.
 */
export type { Id, Doc } from '../../../../convex/_generated/dataModel';
