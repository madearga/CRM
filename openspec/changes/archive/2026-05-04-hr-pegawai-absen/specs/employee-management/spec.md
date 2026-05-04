## ADDED Requirements

### Requirement: Create employee record
System SHALL allow HR Admin to create employee record with: nama lengkap, NIK/KTP, email, nomor telepon, alamat, tanggal lahir, jenis kelamin, jabatan, department, lokasi penugasan (branch), tanggal masuk, status kerja (aktif/cuti/resign), dan foto profil.

#### Scenario: Create employee successfully
- **WHEN** HR Admin submits employee form dengan data lengkap dan valid
- **THEN** system creates employee record dengan status "aktif" dan menampilkan di daftar pegawai

#### Scenario: Duplicate NIK detected
- **WHEN** HR Admin submits form dengan NIK yang sudah terdaftar di organisasi yang sama
- **THEN** system rejects submission dan menampilkan error "NIK sudah terdaftar"

#### Scenario: Branch Manager cannot create employee in other location
- **WHEN** Branch Manager Lokasi A mencoba membuat pegawai untuk Lokasi B
- **THEN** system rejects dengan error permission denied

### Requirement: Update employee record
System SHALL allow HR Admin to update semua field employee record. Branch Manager hanya bisa update pegawai di lokasinya.

#### Scenario: HR Admin updates jabatan
- **WHEN** HR Admin mengubah jabatan pegawai
- **THEN** system menyimpan perubahan dan mencatat di audit log

#### Scenario: Branch Manager updates own location employee
- **WHEN** Branch Manager Lokasi A mengubah data pegawai di Lokasi A
- **THEN** system menyimpan perubahan

### Requirement: Change employee status
System SHALL allow HR Admin to mengubah status kerja: aktif → cuti, aktif → resign, cuti → aktif, resign → aktif (re-hire).

#### Scenario: Resign employee
- **WHEN** HR Admin mengubah status ke "resign" dan mengisi tanggal resign
- **THEN** status berubah, tanggal resign tersimpan, pegawai tidak lagi muncul di shift assignment aktif

#### Scenario: Reactivate employee
- **WHEN** HR Admin mengubah status resign → aktif
- **THEN** tanggal resign di-reset, pegawai bisa di-assign ke shift lagi

### Requirement: List and filter employees
System SHALL menampilkan daftar pegawai dengan filter: lokasi, department, jabatan, status kerja, dan search by nama/NIK. Support pagination.

#### Scenario: Filter by department
- **WHEN** user memilih filter department "Sales"
- **THEN** hanya pegawai di department Sales yang ditampilkan

#### Scenario: Search by name
- **WHEN** user mengetik "budi" di search box
- **THEN** menampilkan pegawai yang namanya mengandung "budi" (case-insensitive)

### Requirement: Employee profile view
System SHALL menampilkan halaman detail pegawai: profil lengkap, riwayat absensi 30 hari terakhir, shift aktif, dan dokumen terkait.

#### Scenario: View profile
- **WHEN** user klik nama pegawai dari daftar
- **THEN** menampilkan halaman detail dengan semua informasi pegawai
