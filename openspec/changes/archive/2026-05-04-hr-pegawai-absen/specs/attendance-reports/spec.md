## ADDED Requirements

### Requirement: Generate attendance report
System SHALL generate laporan absensi filter per: lokasi, periode, pegawai, status (hadir/terlambat/alpha/cuti).

#### Scenario: Monthly report per location
- **WHEN** HR Admin generate laporan untuk Lokasi A, periode 1-30 April 2026
- **THEN** menampilkan tabel: nama pegawai, tanggal, jam masuk, jam keluar, status, durasi kerja, keterlambatan (menit)

#### Scenario: Individual employee report
- **WHEN** HR Admin generate laporan untuk pegawai tertentu
- **THEN** menampilkan rekap: total hadir, terlambat, alpha, total jam kerja

### Requirement: Export to CSV
System SHALL allow export laporan ke CSV untuk payroll.

#### Scenario: Export CSV
- **WHEN** HR Admin klik "Export CSV"
- **THEN** download CSV dengan kolom: NIK, Nama, Lokasi, Tanggal, Jam Masuk, Jam Keluar, Status, Durasi, Keterlambatan

### Requirement: Export to PDF
System SHALL allow export laporan ke PDF yang diformat (header organisasi, tabel data, ringkasan).

#### Scenario: Export PDF with summary
- **WHEN** HR Admin klik "Export PDF"
- **THEN** generate PDF dengan logo, periode, tabel absensi, dan ringkasan statistik

### Requirement: Employee monthly summary
System SHALL menampilkan rekap bulanan per pegawai: hadir, terlambat, alpha, cuti, total jam kerja, rata-rata jam/hari.

#### Scenario: Monthly summary
- **WHEN** HR Admin membuka laporan rekap bulanan
- **THEN** menampilkan tabel setiap pegawai: nama, hadir (n), terlambat (n), alpha (n), cuti (n), total jam, rata-rata jam/hari
