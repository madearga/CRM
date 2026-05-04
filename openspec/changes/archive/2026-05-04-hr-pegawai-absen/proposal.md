## Why

CRM saat ini mengelola contacts, deals, invoices, dan sales pipeline — tapi belum ada modul untuk mengelola **pegawai (karyawan)** internal. Setiap organisasi perlu mengelola data pegawai, absensi, dan penjadwalan shift. Tanpa modul HR, tracking kehadiran dan data payroll harus dilakukan manual di luar sistem.

## What Changes

- **Modul HR** di CRM dashboard — data pegawai lengkap (profil, jabatan, department, status kerja)
- **Sistem absensi** — clock-in/clock-out dengan geolocation per branch/lokasi
- **Manajemen shift** — definisi shift per lokasi, penugasan pegawai ke shift
- **Dashboard HR** — ringkasan kehadiran, statistik, pegawai aktif per lokasi
- **Laporan absensi** — filter per lokasi/periode/pegawai, export untuk payroll

## Capabilities

### New Capabilities
- `employee-management`: CRUD data pegawai — profil, jabatan, department, lokasi penugasan, status kerja (aktif/cuti/resign)
- `attendance-tracking`: Clock-in/clock-out dengan geolocation, deteksi keterlambatan, koreksi absen
- `shift-scheduling`: Definisi shift per lokasi, penugasan pegawai ke shift (single/recurring)
- `hr-dashboard`: Ringkasan kehadiran, statistik bulanan, alert keterlambatan
- `attendance-reports`: Laporan absensi dengan filter, export CSV/PDF

### Modified Capabilities
- (tidak ada — modul baru, tidak mengubah existing capabilities)

## Impact

- **Database (Convex)**: 5 tabel baru: `employees`, `attendanceRecords`, `shifts`, `shiftAssignments`, `attendanceCorrections`
- **API**: ~15 new Convex queries/mutations
- **Frontend**: 4 halaman baru — `/hr/employees`, `/hr/attendance`, `/hr/shifts`, `/hr/reports`
- **Navigation**: Tambah menu "HR" di sidebar
- **Permissions**: Extend existing permission system — fitur HR untuk role `hr_admin` dan `branch_manager`
- **Depends on**: existing `organization`, `member`, `permissionTemplates`, `companies` tables
