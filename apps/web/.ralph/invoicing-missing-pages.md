## Goal
Create 3 missing frontend pages for the Invoicing & Billing module:
1. Payments page (`/payments`) — list pembayaran
2. Tax settings (`/settings/taxes`) — CRUD pajak
3. Payment terms settings (`/settings/payment-terms`) — CRUD termin pembayaran

Plus add nav entries to sidebar and settings layout.

## Backend status
All backend APIs already exist:
- `convex/taxes.ts` — list, create, update, remove
- `convex/paymentTerms.ts` — list, create, update, remove
- `convex/payments.ts` — list, create, cancel

## Checklist
- [ ] Create `/settings/taxes/page.tsx` — tax CRUD table (follow pricelists pattern)
- [ ] Create `/settings/payment-terms/page.tsx` — payment terms CRUD table
- [ ] Create `/payments/page.tsx` — payments list page with filters
- [ ] Add "Payments" nav item to dashboard sidebar
- [ ] Add "Taxes" and "Payment Terms" tabs to settings layout
- [ ] Commit