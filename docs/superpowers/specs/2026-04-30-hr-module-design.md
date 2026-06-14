# HR Module V1 — Design Spec

**Date**: 2026-04-30
**Change**: `hr-pegawai-absen`
**Status**: Approved (brainstorming + ce-doc-review)

---

## Overview

Modul HR untuk CRM yang akan berkembang menjadi ERP (seperti Odoo). Iterasi 1: manajemen pegawai, absensi, shift, dashboard, laporan. Pegawai clock-in via WhatsApp bot + QR code. HR Admin manage via web dashboard.

### Architecture

```
WhatsApp Bot (OpenClaw)          CRM Dashboard (Web - Next.js)
  /hadir  → scan QR → clock-in     /hr/          → Dashboard
  /pulang → clock-out               /hr/employees → CRUD pegawai
  /izin   → request correction      /hr/attendance → Summary + corrections
  /status → cek kehadiran           /hr/shifts    → Shift management
       ↓                            /hr/reports   → CSV export
  Convex (source of truth)               ↓
                                    Akuntansi (future)
                                    Payroll summary feed
```

### Decisions from ce-doc-review + Brainstorming

| # | Issue | Decision |
|---|-------|----------|
| 1 | Employee-User paradox | **Kombinasi**: WhatsApp (pegawai) + Web (HR Admin). Pegawai tidak perlu akun CRM. |
| 2 | `companies` ≠ branches | **Tabel `branches` baru** — tidak tercampur CRM client data |
| 3 | GPS tidak akurat indoor | **QR code per cabang** — scan via WhatsApp. GPS sebagai info tambahan |
| 4 | Holiday calendar missing | **Basic holiday calendar** — tabel `holidays`, HR input sekali/tahun |
| 5 | Scope | **Core HR lengkap** di Iterasi 1. PDF export, dokumen pegawai, leave management → Iterasi 2 |
| 6 | HR Dashboard no route | **Tambah `/hr/page.tsx`** sebagai landing page |
| 7 | Forgot clock-out | **Auto-close at midnight** + label "lupa clock-out". Pegawai bisa ajukan koreksi. |
| 8 | Branch Manager permissions | **Tambah ke semua specs** — scoped ke branch sendiri |
| 9 | Enum language | **English di DB** (`active`/`on_leave`/`resigned`), Indonesian di display layer |
| 10 | Feature flag | **Ya** — gradual rollout per organisasi |
| 11 | Payroll position | HR export data mentah. Payroll calculation di modul terpisah (future). HR → Akuntansi via payroll summary API. |
| 12 | Notification mechanism | **In-app notification badge** di HR menu. Rejection correction muncul di halaman corrections pegawai. |

---

## Data Model

### branches (NEW)
```
branches
├── name, address, phone?
├── latitude?, longitude?
├── qrCode (string, unique — generated auto)
├── organizationId (→ organization)
├── isActive (boolean, default: true)
└── createdAt, updatedAt
```

### employees
```
employees
├── name, nik (unique per org), email?, phone, address?
├── birthDate?, gender?, position, department?, photoUrl?
├── organizationId (→ organization)
├── branchId (→ branches, sebagai lokasi penugasan)
├── userId? (→ user, optional — hanya yang punya akun CRM)
├── whatsappNumber? (string — untuk bot interaction)
├── status: "active" | "on_leave" | "resigned"
├── hireDate, resignDate?
└── createdAt, updatedAt
```

### shifts
```
shifts
├── name, startTime (HH:mm), endTime (HH:mm)
├── lateToleranceMinutes (default: 15)
├── daysOfWeek: number[] (0=Senin, 6=Minggu)
├── organizationId (→ organization)
├── branchId (→ branches)
└── createdAt, updatedAt
```

### shiftAssignments
```
shiftAssignments
├── employeeId (→ employees)
├── shiftId (→ shifts)
├── specificDate? (untuk sekali)
├── recurrenceType: "once" | "weekly"
├── daysOfWeek? (untuk weekly: [0,1,2,3,4])
├── startDate, endDate? (null = indefinite)
├── organizationId, branchId
└── createdAt
```

### attendanceRecords
```
attendanceRecords
├── employeeId (→ employees)
├── shiftAssignmentId? (→ shiftAssignments, snapshotted at clock-in)
├── date (YYYY-MM-DD)
├── clockIn, clockOut? (timestamp)
├── clockInSource: "whatsapp" | "web" | "kiosk"
├── clockInQrCode? (string — which QR was scanned)
├── clockInLocation?, clockOutLocation? { lat?, lng?, accuracy? } (info only)
├── status: "present" | "absent" | "on_leave" | "holiday"
├── label: "on_time" | "late" | "early_leave" | "no_shift" | "forgot_clockout" | "outside_area"
├── lateMinutes?, earlyLeaveMinutes?
├── totalWorkHours? (calculated on clock-out or auto-close)
├── organizationId, branchId
└── createdAt, updatedAt
```

### attendanceCorrections
```
attendanceCorrections
├── attendanceRecordId (→ attendanceRecords)
├── requestedBy (→ user atau employee identifier)
├── correctedClockIn?, correctedClockOut?
├── reason
├── status: "pending" | "approved" | "rejected"
├── reviewedBy? (→ user)
├── reviewNote?
└── createdAt, reviewedAt?
```

### holidays (NEW)
```
holidays
├── date (YYYY-MM-DD)
├── name (string — "Hari Raya Idul Fitri", "Natal", dll)
├── organizationId (→ organization)
├── isRecurring (boolean — true untuk tanggal merah tahunan)
└── createdAt
```

### auditLogs (extend existing)
```
Existing table — tambah entityType values:
├── "employee" 
├── "attendance_correction"
└── "shift"
```

---

## Capabilities

### 1. Employee Management
- CRUD data pegawai: nama, NIK, email, telepon, jabatan, department, branch, status
- List + filter: branch, department, status, search nama/NIK
- Profile view: data lengkap + riwayat absensi 30 hari + shift aktif
- Status transitions: active ↔ on_leave ↔ resigned
- Role access: HR Admin = semua, Branch Manager = branch sendiri

### 2. Attendance Tracking (WhatsApp-first)
- **Clock-in via WhatsApp**: pegawai kirim foto QR code di cabang → bot scan → record attendance
- **Clock-out via WhatsApp**: pegawai kirim "/pulang" → system close record
- QR code unique per branch, diganti berkala (configurable)
- Auto-detect shift assignment, calculate on_time/late
- **Forgot clock-out**: auto-close at midnight, label "forgot_clockout"
- **Holiday detection**: jika tanggal = holiday, auto-mark "holiday" (bukan absent)
- **Correction flow**: pegawai kirim "/izin" via WhatsApp atau request di web → HR approve/reject
- Branch Manager: lihat attendance branch sendiri, approve corrections branch sendiri

### 3. Shift Scheduling
- CRUD shift definitions per branch: nama, jam, hari, toleransi keterlambatan
- Assign pegawai ke shift: single day atau recurring weekly (lazy generation)
- Calendar view: mingguan/bulanan, filter per branch/pegawai
- Remove assignment: hanya future, past with attendance = blocked
- Role access: HR Admin = semua, Branch Manager = branch sendiri

### 4. HR Dashboard
- Route: `/hr/page.tsx` — landing page saat klik menu HR
- Today's attendance widget: hadir/terlambat/alpha per branch (real-time)
- Monthly statistics: persentase kehadiran, rata-rata terlambat, top 5 pegawai
- Branch comparison chart
- Late arrival alerts: 30 menit setelah shift start, pegawai belum clock-in
- Branch Manager: hanya data branch sendiri

### 5. Attendance Reports
- Generate report: filter per branch, periode, pegawai, status
- Holiday-aware: hari libur tidak dihitung "alpha"
- **Export CSV** untuk payroll (Iterasi 1)
- Employee monthly summary: hadir, terlambat, alpha, cuti, libur, total jam kerja
- Branch Manager: hanya report branch sendiri

### 6. Branch Management
- CRUD branch: nama, alamat, GPS coordinates (optional), QR code (auto-generated)
- QR code generation: unique per branch, bisa regenerate
- Active/inactive toggle
- HR Admin only

### 7. Holiday Calendar
- CRUD holidays: tanggal, nama, recurring (tahunan)
- Auto-apply: attendance di hari libur = status "holiday"
- Import: bulk add dari template (Indonesia national holidays)
- HR Admin only

---

## WhatsApp Bot Commands (OpenClaw Skills)

| Command | Action | Response |
|---------|--------|----------|
| `/hadir` + foto QR | Clock-in | "✅ Clock-in berhasil. [Shift Pagi] 08:02 — Tepat waktu" |
| `/hadir` + foto QR (late) | Clock-in (late) | "⚠️ Clock-in berhasil. [Shift Pagi] 08:32 — Terlambat 32 menit" |
| `/pulang` | Clock-out | "✅ Clock-out berhasil. Total kerja: 8 jam 30 menit" |
| `/izin [alasan]` | Request correction | "📝 Koreksi dikirim. Menunggu approval HR." |
| `/status` | Check today | "📅 Hari ini: Clock-in 08:02 (tepat waktu). Shift Pagi." |
| `/jadwal` | Upcoming shifts | "📋 Shift minggu ini: Senin-Jumat Pagi (08:00-16:00)" |

---

## Permissions

| Feature | HR Admin | Branch Manager | Pegawai (via WA) |
|---------|----------|----------------|------------------|
| employees | CRUD all | Read/Update own branch | - |
| attendance | View all, approve corrections | View/approve own branch | Clock-in/out, request correction |
| shifts | CRUD all, assign all | View/assign own branch | - |
| reports | View all, export all | View/export own branch | - |
| branches | CRUD all | Read own | - |
| holidays | CRUD | Read | - |
| dashboard | View all | View own branch | - |

---

## Iterasi 1 Scope

### In Scope (Iterasi 1)
- Branch management + QR code generation
- Employee CRUD
- Shift scheduling (single + recurring)
- Attendance tracking via WhatsApp (QR scan)
- Holiday calendar (basic)
- HR Dashboard (widgets + alerts)
- Reports + CSV export
- Attendance corrections (request/approve)
- Role-based access (HR Admin + Branch Manager)
- Audit log (extend existing)
- Feature flag for rollout

### Out of Scope (Iterasi 2+)
- PDF export (formatted reports)
- Dokumen pegawai (contracts, KTP upload, dll)
- Leave management (cuti request workflow)
- Payroll calculation
- Payroll → Akuntansi integration
- Mobile app / PWA
- Biometric attendance
- Night shift / cross-midnight handling (defer until needed)

---

## Key Technical Notes

1. **QR Code**: Generate via library (qrcode npm). Unique per branch, stored di `branches.qrCode`. Bisa regenerate. Printed dan ditempel di setiap cabang.
2. **WhatsApp → Convex**: Via OpenClaw skill yang sudah ada. Bot terima command → panggil Convex mutation → response ke user.
3. **Lazy recurring shifts**: Recurring assignment stored as rule, expanded at query time. `shiftAssignmentId` pada attendance snapshotted at clock-in.
4. **Holiday-aware reports**: Query check `holidays` table. If date = holiday, attendance status = "holiday" (not "absent").
5. **Auto-close forgot clock-out**: Convex cron job runs at midnight. Find records where `clockOut = null` and `date = today` → set clockOut = shift endTime, label = "forgot_clockout".
6. **Frontend paths**: Base path `apps/web/src/app/(dashboard)/hr/...`
7. **Permission integration**: Add HR features to `FEATURES` and `FEATURE_ACTIONS` in `permissionHelpers.ts`
8. **Feature flag**: Config flag `hr_module_enabled` per organization. Nav guard checks flag before showing HR menu.
