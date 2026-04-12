# Brainstorm: Implementasi ERM Module-by-Module

## Goal
Brainstorm dan rencanakan implementasi setiap modul ERM (seperti Odoo) ke CRM yang sudah ada, satu per satu. Untuk setiap modul, detailkan:

1. Schema design (tabel Convex baru)
2. API/functions yang perlu dibuat (queries, mutations)
3. UI pages & components
4. Integrasi dengan modul yang sudah ada
5. Urutan implementasi per sprint
6. Edge cases & risiko

## Existing System (sudah ada)
- Auth & Organization (Better Auth)
- Companies (accounts)
- Contacts (leads/people)  
- Deals (pipeline)
- Activities (call/email/meeting/note)
- Audit Logs
- Dashboard
- Search
- Email Digest
- CSV Import

## Target: 12 Core ERM Modules
1. Product Catalog
2. Sales Order
3. Invoicing & Billing
4. Inventory / Stock
5. Purchase Order
6. HR / Employees
7. Project Management
8. Helpdesk / Support
9. Expense Management
10. Accounting / General Ledger
11. Automation / Workflow Engine
12. Reporting & BI

## Checklist
- [x] Module 1: Product Catalog brainstorm → `erm-brainstorm/01-product-catalog.md`
- [x] Module 2: Sales Order brainstorm → `erm-brainstorm/02-sales-order.md`
- [x] Module 3: Invoicing & Billing brainstorm → `erm-brainstorm/03-invoicing-billing.md`
- [x] Module 4: Inventory / Stock brainstorm → `erm-brainstorm/04-inventory-stock.md`
- [x] Module 5: Purchase Order brainstorm → `erm-brainstorm/05-purchase-order.md`
- [x] Module 6: HR / Employees brainstorm → `erm-brainstorm/06-hr-employees.md`
- [x] Module 7: Project Management brainstorm → `erm-brainstorm/07-project-management.md`
- [x] Module 8: Helpdesk / Support brainstorm → `erm-brainstorm/08-helpdesk-support.md`
- [x] Module 9: Expense Management brainstorm → `erm-brainstorm/09-expense-management.md`
- [x] Module 10: Accounting / GL brainstorm → `erm-brainstorm/10-accounting-general-ledger.md`
- [x] Module 11: Automation / Workflow brainstorm → `erm-brainstorm/11-automation-workflow.md`
- [x] Module 12: Reporting & BI brainstorm → `erm-brainstorm/12-reporting-bi.md`
- [x] Master Roadmap → `erm-brainstorm/00-MASTER-ROADMAP.md`

## Next Phase: Writing Plan
- [ ] Create detailed implementation writing plan with:
  - Shared infrastructure (workflow engine, sequence generator, navigation)
  - Per-module: exact file paths, function signatures, component specs
  - Migration strategy (how to add modules without breaking existing CRM)
  - Test strategy per module
  - Priority order & sprint timeline