## ADDED Requirements

### Requirement: Activity entity IDs scoped to active organization
`convex/activities.ts` mutations yang menerima entity IDs (contactId, dealId, dll) harus memvalidasi bahwa entity tersebut belongs to active organization.

#### Scenario: Cross-tenant activity creation blocked
- **WHEN** user mencoba membuat activity dengan `contactId` dari organization lain
- **THEN** mutation throw error — entity must belong to active org

#### Scenario: Activity assignee writes scoped
- **WHEN** upcoming activity lookup dan assignee writes dijalankan
- **THEN** query scoped ke active organization, bukan global

### Requirement: AI chat history user-scoped
`convex/aiChatHistory.ts` queries dan mutations harus di-scope ke active user dalam organization, bukan hanya organization-level.

#### Scenario: User cannot read other user's chat history
- **WHEN** user A membaca chat history di org X
- **THEN** hanya menampilkan conversations milik user A, bukan semua user di org X

### Requirement: Attendance organization ownership validation
`convex/hrAttendance.ts` `clockOutFromWhatsApp` harus validate bahwa `organizationId` dari request adalah organization tempat employee bekerja.

#### Scenario: Cross-tenant clock out blocked
- **WHEN** attacker mengirim `organizationId` yang berbeda via WhatsApp
- **THEN** mutation reject — organizationId harus derived dari employee record, bukan client input

#### Scenario: autoCloseOpenRecords scoped to org
- **WHEN** `autoCloseOpenRecords` dijalankan
- **THEN** hanya memproses records untuk organization yang di-parameter, dengan pagination yang benar (tidak hard limit 1000)

### Requirement: Organization member role scoped
`convex/organization.ts` role update mutations harus memvalidasi bahwa target user adalah member dari active organization.

#### Scenario: Cross-tenant role update blocked
- **WHEN** admin org A mencoba update role user di org B
- **THEN** mutation throw error — target must be member of active org

### Requirement: Invitation templates org-scoped
`convex/organization.ts` invitation role template queries harus filter by active organization.

#### Scenario: Cross-tenant template access blocked
- **WHEN** user mencoba akses invitation template dari org lain
- **THEN** return empty atau error — template scoped ke active org

### Requirement: Invitation overview access check
`convex/organization.ts` invitation overview harus verify bahwa requester adalah recipient atau org manager.

#### Scenario: Non-recipient cannot view invitation details
- **WHEN** user yang bukan recipient atau manager melihat invitation overview
- **THEN** return filtered results — hanya invitations yang relevan

### Requirement: Employee userId org validation
`convex/hrEmployees.ts` create/update mutations yang menerima `userId` harus verify bahwa user belongs to organization.

#### Scenario: Cross-org userId rejected
- **WHEN** mutation menerima `userId` dari user yang bukan member org
- **THEN** mutation throw error — user must be org member

### Requirement: Payment companyId org validation
`convex/payments.ts` payment creation harus validate bahwa `companyId` belongs to active organization.

#### Scenario: Cross-tenant payment blocked
- **WHEN** user mencoba membuat payment untuk company di org lain
- **THEN** mutation throw error — companyId must belong to active org

### Requirement: Subscription foreign key org validation
`convex/subscriptions.ts` create/update mutations yang menerima foreign key IDs harus verify bahwa IDs tersebut belongs to active organization.

#### Scenario: Cross-tenant subscription blocked
- **WHEN** user mencoba membuat subscription dengan foreign key IDs dari org lain
- **THEN** mutation throw error — semua foreign keys must belong to active org
