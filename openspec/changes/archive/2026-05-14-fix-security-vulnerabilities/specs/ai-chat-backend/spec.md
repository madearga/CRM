## MODIFIED Requirements

### Requirement: Rate limiting on AI chat endpoint
AI chat endpoint yang memanggil paid LLM API harus memiliki rate limiting untuk mencegah abuse.

#### Scenario: Rate limited LLM API calls
- **WHEN** user memanggil AI chat endpoint melebihi rate limit
- **THEN** return 429 "rate limit exceeded" — gunakan existing `rateLimitGuard` helper

### Requirement: CORS origin validation fix
`convex/aiChat.ts` CORS validation harus menggunakan exact hostname matching, bukan suffix matching, untuk mencegah bypass.

#### Scenario: CORS bypass via suffix blocked
- **WHEN** request dari `evil-myapp.com` (suffix match attack)
- **THEN** rejected — CORS check harus exact match atau prefix dengan dot separator

### Requirement: AI chat user-scoped access
AI chat history access harus di-scope ke authenticated user, bukan hanya organization.

#### Scenario: User can only access own chat conversations
- **WHEN** user membuka AI chat history
- **THEN** hanya menampilkan conversations yang dimiliki user tersebut di organization context
