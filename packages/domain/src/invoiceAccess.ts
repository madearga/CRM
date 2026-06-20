// Pure access-control helpers for invoice reads.
//
// These functions encode the IDOR guard used by convex/invoices.ts `getById`.
// Extracting the check to a named, pure function makes the security contract
// visible in code review, easy to test, and hard to remove by accident.
//
// Why this matters: `getById` uses Convex's `createOrgQuery` wrapper which
// injects `orgId` from the authenticated session (`user.activeOrganization.id`),
// not from client input. The handler must still compare the fetched invoice's
// `organizationId` against the caller's `orgId` and throw NOT_FOUND on mismatch
// — otherwise a user in org A could pass any invoice id (e.g. an id leaked
// from org B) and read it. We assert the match here so the check is testable
// without a running Convex deployment.
//
// The function throws a plain Error with a `.code` property. Convex's
// `ConvexError` wraps this at the call site if needed; the domain layer
// intentionally stays free of Convex imports.

export type InvoiceOwner = {
  /** Organization that owns the invoice. */
  organizationId: string;
};

/** Error shape thrown when an invoice is not visible to the caller. */
export class InvoiceAccessDeniedError extends Error {
  readonly code: "NOT_FOUND" = "NOT_FOUND";
  constructor(message = "Invoice not found") {
    super(message);
    this.name = "InvoiceAccessDeniedError";
  }
}

/**
 * Assert the caller (identified by their `callerOrgId`) is allowed to read the
 * given invoice. Throws `InvoiceAccessDeniedError` (code: NOT_FOUND) when the
 * invoice does not exist or belongs to a different organization.
 *
 * Returning the invoice on success lets callers chain: `const inv =
 * assertCanReadInvoice(await db.get(id), ctx.orgId);`.
 *
 * We intentionally use the same NOT_FOUND code for "missing" and
 * "wrong org" so an attacker cannot distinguish the two cases via the
 * response.
 */
export function assertCanReadInvoice<T extends InvoiceOwner>(
  invoice: T | null | undefined,
  callerOrgId: string
): T {
  if (!invoice || invoice.organizationId !== callerOrgId) {
    throw new InvoiceAccessDeniedError("Invoice not found");
  }
  return invoice;
}
