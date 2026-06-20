/**
 * Unit tests for the invoice read IDOR (Insecure Direct Object Reference) guard.
 *
 * The guard lives in @crm/domain/invoiceAccess and is used by
 * convex/invoices.ts `getById`. The Convex function is NOT exercised here
 * (no Convex test harness in the repo); instead we lock the security contract
 * at the pure-helper level so it is reviewable and cannot silently regress.
 *
 * Contract:
 *  - Same org -> invoice returned unchanged.
 *  - Different org -> throws NOT_FOUND (NOT 403, to avoid leaking existence).
 *  - Missing invoice -> throws NOT_FOUND (same code, indistinguishable from
 *    cross-org access).
 *  - Empty / null / undefined callerOrgId -> throws NOT_FOUND.
 *
 * If a real workspace needs cross-org invoice reads (it does not, today),
 * a new opt-in helper should be added and these tests updated.
 */
import { describe, it, expect } from "vitest";
import {
  assertCanReadInvoice,
  InvoiceAccessDeniedError,
} from "@crm/domain";

const ORG_A = "org_aaaaaaaa";
const ORG_B = "org_bbbbbbbb";

function makeInvoice(organizationId: string) {
  return {
    _id: "invoice_123",
    number: "INV-001",
    organizationId,
    amountDue: 1_000_000,
    totalAmount: 1_000_000,
  };
}

describe("assertCanReadInvoice — IDOR guard", () => {
  it("returns the invoice when caller org matches the invoice org", () => {
    const inv = makeInvoice(ORG_A);
    expect(assertCanReadInvoice(inv, ORG_A)).toBe(inv);
  });

  it("throws InvoiceAccessDeniedError with code NOT_FOUND for a different org", () => {
    // This is the actual IDOR scenario: user in org B asks for org A's invoice.
    expect(() => assertCanReadInvoice(makeInvoice(ORG_A), ORG_B)).toThrow(
      InvoiceAccessDeniedError
    );
    try {
      assertCanReadInvoice(makeInvoice(ORG_A), ORG_B);
    } catch (e: any) {
      expect(e).toBeInstanceOf(InvoiceAccessDeniedError);
      expect(e.code).toBe("NOT_FOUND");
    }
  });

  it("throws NOT_FOUND for a null invoice (indistinguishable from wrong org)", () => {
    expect(() => assertCanReadInvoice(null, ORG_A)).toThrow(
      InvoiceAccessDeniedError
    );
    try {
      assertCanReadInvoice(null, ORG_A);
    } catch (e: any) {
      expect(e.code).toBe("NOT_FOUND");
    }
  });

  it("throws NOT_FOUND for an undefined invoice", () => {
    expect(() => assertCanReadInvoice(undefined, ORG_A)).toThrow(
      InvoiceAccessDeniedError
    );
  });

  it("throws NOT_FOUND when callerOrgId is empty", () => {
    expect(() => assertCanReadInvoice(makeInvoice(ORG_A), "")).toThrow(
      InvoiceAccessDeniedError
    );
  });

  it("does not leak which case occurred (message is identical)", () => {
    const wrongOrg = () => {
      try {
        assertCanReadInvoice(makeInvoice(ORG_A), ORG_B);
      } catch (e: any) {
        return e.message;
      }
    };
    const missing = () => {
      try {
        assertCanReadInvoice(null, ORG_A);
      } catch (e: any) {
        return e.message;
      }
    };
    expect(wrongOrg()).toBe(missing());
  });
});
