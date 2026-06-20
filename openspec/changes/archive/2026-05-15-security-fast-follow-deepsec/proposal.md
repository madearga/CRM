## Why

Deepsec lanjutan menemukan beberapa findings baru di luar scope `storefront-security-boundary`: supply-chain hardening pada GitHub Actions, CSV/formula injection, frontend stored-XSS surface, dan bug UI kecil yang berdampak pada operasional produk. Findings ini lebih cocok sebagai fast-follow kecil daripada dicampur ke perubahan storefront boundary yang sudah fokus pada cart/checkout/order security.

## What Changes

- Harden GitHub Actions by adding least-privilege `permissions` blocks and replacing floating tool/action versions where practical.
- Sanitize CSV exports to prevent spreadsheet formula injection.
- Keep frontend URL rendering constrained to `http`/`https` safe links.
- Fix low-risk product UI bugs found by deepsec (tag removal no-op, auto-schedule delay not submitted).
- Add explicit guest checkout/cart rate-limit follow-up to close the gap between required valid session and real rate limiting.

## Impact

- CI/CD workflows: `.github/workflows/*.yml`
- Frontend utilities and product/activity UI components.
- Commerce backend: guest cart/checkout mutation throttling.
- Verification: typecheck/lint plus targeted manual checks.
