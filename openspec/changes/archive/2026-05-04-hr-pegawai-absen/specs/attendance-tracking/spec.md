## ADDED Requirements

### Requirement: Clock-in attendance
System SHALL allow pegawai clock-in dengan timestamp otomatis dan geolocation (lat/lng). System mencatat: pegawai ID, timestamp, lokasi, status, dan shift aktif.

#### Scenario: Clock-in on time
- **WHEN** pegawai clock-in pada atau sebelum jam mulai shift
- **THEN** attendance recorded dengan status "hadir" dan label "tepat waktu"

#### Scenario: Clock-in late
- **WHEN** pegawai clock-in setelah jam mulai shift + toleransi keterlambatan
- **THEN** attendance recorded dengan label "terlambat" dan jumlah menit keterlambatan

#### Scenario: Clock-in without shift
- **WHEN** pegawai clock-in tanpa shift assignment untuk hari itu
- **THEN** attendance recorded dengan label "tanpa shift"

### Requirement: Clock-out attendance
System SHALL allow pegawai clock-out. System menghitung durasi kerja.

#### Scenario: Normal clock-out
- **WHEN** pegawai clock-out setelah clock-in hari yang sama
- **THEN** system update record dengan clock-out time dan total jam kerja

#### Scenario: Clock-out without clock-in
- **WHEN** pegawai clock-out tanpa clock-in sebelumnya
- **THEN** system menampilkan error "Belum clock-in hari ini"

#### Scenario: Early leave
- **WHEN** pegawai clock-out sebelum jam selesai shift
- **THEN** labeled "pulang awal" dengan jumlah menit

### Requirement: Geolocation validation
System SHALL capture geolocation saat clock-in/out dan validasi jarak dari lokasi penugasan. Toleransi: 200 meter.

#### Scenario: Within radius
- **WHEN** lokasi GPS dalam 200m dari koordinat lokasi kerja
- **THEN** lokasi tercatat sebagai "valid"

#### Scenario: Outside radius
- **WHEN** lokasi GPS lebih dari 200m dari lokasi kerja
- **THEN** clock-in berhasil tapi ditandai "di luar area", alasan wajib diisi

#### Scenario: GPS unavailable
- **WHEN** device tidak bisa mendapatkan GPS
- **THEN** clock-in berhasil dengan flag "lokasi tidak tersedia", alasan wajib diisi

### Requirement: Attendance correction request
System SHALL allow pegawai mengajukan koreksi absen. HR Admin bisa approve/reject.

#### Scenario: Submit correction
- **WHEN** pegawai mengajukan koreksi waktu clock-in dengan alasan
- **THEN** correction request dibuat dengan status "pending"

#### Scenario: Approve correction
- **WHEN** HR Admin approve
- **THEN** attendance record diupdate dengan waktu koreksi, status di-recalculate

#### Scenario: Reject correction
- **WHEN** HR Admin reject dengan catatan
- **THEN** attendance record tidak berubah, pegawai diberi notifikasi

### Requirement: Daily attendance summary
System SHALL menampilkan ringkasan harian per lokasi: total pegawai, hadir, terlambat, tidak hadir, cuti.

#### Scenario: Today's summary
- **WHEN** user membuka halaman attendance
- **THEN** menampilkan tabel summary per lokasi real-time
