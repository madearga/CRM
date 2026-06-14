## ADDED Requirements

### Requirement: Guest user payment status access
Guest users harus bisa mengecek payment status mereka via order-specific token atau session ID.

#### Scenario: Guest checks payment status
- **WHEN** guest user mengakses payment status dengan valid order token
- **THEN** system return payment status — tidak perlu full auth

### Requirement: Guest user order detail access
Guest users harus bisa melihat order detail mereka sendiri.

#### Scenario: Guest views own order
- **WHEN** guest user mengakses order detail dengan valid token
- **THEN** system return order details (disamarkan untuk non-sensitive fields)

### Requirement: Guest user order cancellation
Guest users harus bisa cancel order mereka sendiri.

#### Scenario: Guest cancels own order
- **WHEN** guest user request cancel dengan valid token dan order masih dalam state yang diizinkan
- **THEN** order di-cancel dan stock dikembalikan
