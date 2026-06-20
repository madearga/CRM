## ADDED Requirements

### Requirement: Invoice duplicate prevention
`convex/invoices.ts` `createFromSaleOrder` harus mengecek apakah invoice sudah ada untuk sale order tersebut sebelum membuat baru.

#### Scenario: Duplicate invoice creation blocked
- **WHEN** `createFromSaleOrder` dipanggil untuk SO yang sudah punya invoice
- **THEN** throw error "invoice already exists for this sale order" — tidak membuat duplicate

### Requirement: Invoice line item recalculation
`convex/invoices.ts` `createFromSaleOrder` harus recalculate line item amounts, bukan copy dari SO line subtotals.

#### Scenario: Invoice amounts independent from SO
- **WHEN** invoice dibuat dari sale order
- **THEN** line item amounts dihitung dari invoice's own pricing, bukan copy SO subtotals

### Requirement: Invoice date parameter
`convex/invoices.ts` `createFromSaleOrder` harus pass `invoiceDate` ke `nextSequence` call.

#### Scenario: Invoice sequence uses correct date
- **WHEN** invoice sequence number generated
- **THEN** menggunakan `invoiceDate` sebagai parameter, bukan undefined

### Requirement: Payment cancellation amountDue recalculation
`convex/payments.ts` payment cancellation harus recalculate `amountDue` dengan benar ketika multiple payments exist.

#### Scenario: Correct amountDue after payment cancellation
- **WHEN** salah satu payment dari multiple payments di-cancel
- **THEN** `amountDue` = `amountDue` + cancelled payment amount (bukan full invoice amount)

### Requirement: Shift conflict check pagination
`convex/hrShiftAssignments.ts` conflict check harus paginate melewati `.take(200)` limit.

#### Scenario: All shift conflicts detected
- **WHEN** employee punya >200 shift assignments
- **THEN** conflict check tetap menemukan semua conflicts via pagination or `.collect()`

### Requirement: Template deletion pagination
`convex/permissionTemplates.ts` `deleteTemplate` harus paginate melewati `.take(500)` limit untuk membersihkan semua member references.

#### Scenario: All members cleaned up on template deletion
- **WHEN** template punya >500 members
- **THEN** deletion tetap menghapus semua member references, tidak ada yang skip

### Requirement: publicSlug uniqueness verification
`convex/plugins.ts` `publicSlug` update harus verify uniqueness setelah patch (post-write check) untuk mencegah race condition.

#### Scenario: Slug uniqueness guaranteed
- **WHEN** concurrent updates mencoba set same publicSlug
- **THEN** post-write verification detect conflict dan throw error

### Requirement: Subscription billing date recalculation on schedule change
`convex/subscriptions.ts` update mutation harus recalculate `nextBillingDate` ketika billing schedule (interval/frequency) berubah.

#### Scenario: nextBillingDate updates with billing schedule
- **WHEN** user mengubah billing schedule (misal monthly ke quarterly)
- **THEN** `nextBillingDate` direcalculate berdasarkan schedule baru, bukan tetap pada tanggal lama
