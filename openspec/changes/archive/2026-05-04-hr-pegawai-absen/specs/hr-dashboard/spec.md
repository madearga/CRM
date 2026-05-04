## ADDED Requirements

### Requirement: Attendance overview widget
System SHALL menampilkan widget: kehadiran hari ini (total, hadir, terlambat, tidak hadir, cuti) per lokasi.

#### Scenario: Real-time attendance count
- **WHEN** HR Admin membuka dashboard pada hari kerja
- **THEN** widget menampilkan jumlah clock-in, terlambat, dan belum clock-in per lokasi

### Requirement: Monthly attendance statistics
System SHALL menampilkan statistik bulanan: rata-rata kehadiran, keterlambatan, pegawai dengan absensi terburuk (top 5).

#### Scenario: View monthly stats
- **WHEN** user memilih periode bulan
- **THEN** menampilkan persentase kehadiran, rata-rata menit terlambat, top 5 pegawai paling sering terlambat/alpha

### Requirement: Location comparison
System SHALL menampilkan perbandingan kehadiran antar lokasi dalam chart.

#### Scenario: Compare locations
- **WHEN** user memilih beberapa lokasi untuk dibandingkan
- **THEN** menampilkan bar chart persentase kehadiran per lokasi

### Requirement: Late arrival alerts
System SHALL menampilkan alert untuk pegawai yang belum clock-in 30 menit setelah shift dimulai.

#### Scenario: Alert for absent employees
- **WHEN** sudah 30 menit lewat dari jam mulai shift dan pegawai belum clock-in
- **THEN** dashboard menampilkan alert dengan nama pegawai dan lokasi
