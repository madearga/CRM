## Design

### Scope

This change tracks fast-follow security findings that are not part of the core storefront access boundary. It intentionally avoids re-opening already-addressed high-risk backend issues from archived changes unless deepsec rediscovers them after re-scan.

### CI/CD hardening

Use explicit `permissions` blocks so `GITHUB_TOKEN` is least-privilege by default. Pinning every action to a commit SHA is ideal but may be noisy; for this fast-follow, either pin high-risk deployment actions/CLIs or document exact version pins for tools that handle secrets.

### CSV/formula injection

Before exporting user-controlled cells to CSV, prefix values that begin with spreadsheet formula metacharacters (`=`, `+`, `-`, `@`, tab, CR) with a single quote. Keep escaping/quoting behavior intact.

### URL rendering

Any user-controlled URL rendered as an `href` must pass through protocol allowlisting (`http:`/`https:`). Invalid or disallowed URLs should render as plain text or be hidden.

### UI bug fixes

- Product tag removal must update form state.
- Activity auto-schedule delay must be sent to backend when the field is present.

### Rate limiting

`storefront-security-boundary` currently requires valid guest session IDs. This follow-up adds true throttling for unauthenticated cart/checkout mutations keyed by `organizationId + sessionId`.
