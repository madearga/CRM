## ADDED Requirements

### Requirement: Create shift definition
System SHALL allow HR Admin membuat definisi shift per lokasi: nama, jam mulai, jam selesai, hari berlaku, toleransi keterlambatan (menit).

#### Scenario: Create shift
- **WHEN** HR Admin membuat shift "Pagi" untuk Lokasi A, jam 08:00-16:00, toleransi 15 menit, Senin-Jumat
- **THEN** shift tersimpan dan muncul di daftar shift lokasi tersebut

#### Scenario: Overlapping shift times
- **WHEN** HR Admin membuat shift yang jamnya overlap dengan shift existing
- **THEN** system menampilkan warning tapi tetap memperbolehkan

### Requirement: Assign employee to shift
System SHALL allow HR Admin menugaskan pegawai ke shift — single day atau recurring mingguan.

#### Scenario: Single day assignment
- **WHEN** HR Admin assign pegawai ke shift untuk tanggal tertentu
- **THEN** pegawai tercatat di shift pada tanggal tersebut

#### Scenario: Recurring weekly assignment
- **WHEN** HR Admin assign pegawai ke shift recurring setiap Senin-Jumat
- **THEN** system generates assignment untuk setiap hari yang dipilih ke depan

#### Scenario: Double shift conflict
- **WHEN** HR Admin assign pegawai ke 2 shift di hari yang sama
- **THEN** system menampilkan warning konflik dan meminta konfirmasi

### Requirement: View shift schedule
System SHALL menampilkan jadwal shift dalam kalender (mingguan/bulanan) dan daftar. Filter per lokasi dan per pegawai.

#### Scenario: Weekly calendar view
- **WHEN** user membuka halaman shift view "mingguan"
- **THEN** menampilkan kalender 7 hari dengan pegawai per shift slot

#### Scenario: Filter by employee
- **WHEN** user memilih pegawai di filter
- **THEN** hanya menampilkan shift pegawai tersebut

### Requirement: Remove shift assignment
System SHALL allow HR Admin menghapus assignment. Assignment yang sudah ada attendance tidak bisa dihapus.

#### Scenario: Remove future assignment
- **WHEN** HR Admin menghapus assignment untuk tanggal yang belum lewat
- **THEN** assignment terhapus

#### Scenario: Cannot remove past assignment with attendance
- **WHEN** HR Admin mencoba menghapus assignment yang sudah ada absensi
- **THEN** system rejects "Tidak bisa menghapus shift yang sudah ada absensi"
