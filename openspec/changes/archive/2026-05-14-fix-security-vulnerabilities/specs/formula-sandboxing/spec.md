## ADDED Requirements

### Requirement: Safe formula evaluation
`convex/pricelists.ts` menggunakan `new Function('return ' + formula)()` untuk mengevaluasi price formulas. Ini memungkinkan arbitrary JavaScript execution (RCE). Harus diganti dengan safe math evaluator.

#### Scenario: Malicious formula blocked
- **WHEN** user memasukkan formula seperti `require('child_process').exec('rm -rf /')` atau `process.exit(1)`
- **THEN** formula evaluation reject input — hanya math expressions yang diizinkan (+, -, *, /, parentheses, variables)

#### Scenario: Legitimate formulas still work
- **WHEN** user memasukkan formula seperti `(price * quantity) * 0.1` atau `subtotal + 1000`
- **THEN** formula dievaluasi dengan benar dan menghasilkan angka yang expected

### Requirement: Pricelist companyId org validation
`convex/pricelists.ts` price resolution harus memvalidasi bahwa `companyId` belongs to active organization untuk mencegah cross-tenant data leak.

#### Scenario: Cross-tenant pricelist access blocked
- **WHEN** user mencoba resolve prices untuk company di organization lain
- **THEN** query throw error — companyId must belong to active org
