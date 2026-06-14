## ADDED Requirements

### Requirement: CI workflows shall use least privilege token permissions

GitHub Actions workflows that run with repository tokens SHALL declare explicit `permissions` blocks with the minimum permissions needed by each workflow or job.

#### Scenario: deployment workflow uses secrets
- **WHEN** a workflow deploys to Convex or Vercel using repository secrets
- **THEN** its token permissions are explicitly constrained instead of relying on repository defaults

### Requirement: deployment tooling versions shall not float silently

Workflows that handle deployment secrets SHALL avoid floating tool versions such as `@latest` where a stable pinned version is available.

#### Scenario: Vercel deploy runs in CI
- **WHEN** the workflow installs or runs the Vercel CLI
- **THEN** the version is pinned to a known version or the risk is documented with a mitigation
