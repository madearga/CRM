## Context

CRM generik multi-organisasi yang dibangun dengan Convex (database + business logic) dan Next.js (dashboard). CRM mengelola contacts, deals, invoices, dan sales pipeline. Database menggunakan `convex-ents` dengan existing tables: `organization`, `member`, `user`, `companies`, `contacts`, `deals`, dll. Permission system sudah ada via `permissionTemplates` dan `permissionEntries`. Belum ada modul HR.

## Goals / Non-Goals

**Goals:**
- Modul HR untuk manajemen pegawai dan absensi — berlaku untuk organisasi apapun
- Clock-in/out dengan geolocation validation per lokasi kerja
- Laporan absensi exportable untuk payroll
- Role-based access: HR Admin (semua lokasi) dan Branch Manager (lokasi sendiri)

**Non-Goals:**
- Payroll calculation (hanya export data)
- Leave management/cuti request (future phase)
- Performance review/KPI (future phase)
- Mobile app (responsive web dulu)
- Biometric attendance (GPS dulu)

## Decisions

### Decision 1: Employee terpisah dari User
**Choice**: Table `employees` terpisah, optional link ke `user` via `userId`
**Rationale**: Tidak semua pegawai perlu akun CRM (security, cleaner). Tidak semua user adalah pegawai (client, vendor). Decoupling = fleksibel.
**Alternative**: Extend `user` table — ditolak karena coupling.

### Decision 2: Geolocation via browser API
**Choice**: `navigator.geolocation` + coordinates lokasi kerja di DB
**Rationale**: Zero infra, works di semua smartphone browser. Radius 200m cukup untuk GPS accuracy.
**Alternative**: WiFi-based presence — ditolak butuh hardware tambahan.

### Decision 3: Recurring shift assignments
**Choice**: `shiftAssignments` dengan `recurrenceType: "once" | "weekly"` + `daysOfWeek`. Lazy generation saat query.
**Rationale**: Satu record recurring > 365 materialized records per pegawai per tahun.
**Alternative**: Materialize semua — ditolak karena data bloat.

### Decision 4: Correction via request/approval
**Choice**: Table `attendanceCorrections` dengan `pending → approved/rejected`
**Rationale**: Pegawai bisa salah, tapi koreksi butuh approval untuk accountability.
**Alternative**: Auto-correction — ditolak karena tidak ada audit trail.

### Decision 5: Export via server-side
**Choice**: CSV di Convex action, PDF di Next.js API route
**Rationale**: CSV simple di Convex. PDF butuh layout library yang tidak ada di Convex runtime.
**Alternative**: All client-side — ditolak karena bisa hang untuk data besar.

## Data Model

```
employees
├── name, nik, email, phone, address
├── birthDate, gender, position, department, photoUrl
├── organizationId (→ organization)
├── branchId (→ companies, sebagai lokasi kerja)
├── userId? (→ user, optional)
├── status: "active" | "on_leave" | "resigned"
├── hireDate, resignDate?
└── createdAt, updatedAt

shifts
├── name, startTime (HH:mm), endTime (HH:mm)
├── lateToleranceMinutes (default: 15)
├── daysOfWeek: number[] (0=Senin, 6=Minggu)
├── organizationId (→ organization)
├── branchId (→ companies)
└── createdAt, updatedAt

shiftAssignments
├── employeeId (→ employees)
├── shiftId (→ shifts)
├── specificDate? (untuk sekali)
├── recurrenceType: "once" | "weekly"
├── daysOfWeek? (untuk weekly)
├── startDate, endDate? (null = indefinite)
├── organizationId, branchId
└── createdAt

attendanceRecords
├── employeeId (→ employees)
├── shiftAssignmentId? (→ shiftAssignments)
├── date (YYYY-MM-DD)
├── clockIn, clockOut? (timestamp)
├── clockInLocation?, clockOutLocation? { lat, lng, valid }
├── status: "present" | "absent" | "on_leave"
├── label: "on_time" | "late" | "early_leave" | "no_shift" | "outside_area"
├── lateMinutes?, earlyLeaveMinutes?
├── totalWorkHours? (calculated)
├── organizationId, branchId
└── createdAt, updatedAt

attendanceCorrections
├── attendanceRecordId (→ attendanceRecords)
├── requestedBy (→ user)
├── correctedClockIn?, correctedClockOut?
├── reason
├── status: "pending" | "approved" | "rejected"
├── reviewedBy? (→ user)
├── reviewNote?
└── createdAt, reviewedAt?
```

## Risks / Trade-offs

- **[GPS spoofing]** → Mitigation: flag "outside area" visible, HR review. Tidak mencegah tapi mendeteksi.
- **[GPS tidak akurat indoor]** → Mitigation: radius 200m toleran + manual override dengan alasan.
- **[Data volume besar]** → Mitigation: compound index (organizationId + branchId + date), pagination, streaming export.
- **[Timezone multi-lokasi]** → Mitigation: simpan UTC, display sesuai timezone organisasi. Default WIB untuk Indonesia.

## Migration Plan

1. Deploy tabel baru — backward compatible, tidak modify existing
2. Seed `permissionEntries` untuk role HR
3. Tambah nav menu "HR" — feature flag untuk gradual rollout
4. Tambah koordinat GPS ke `companies` records yang jadi lokasi kerja
5. Rollback: remove nav + feature flag, data tetap tersimpan

## Open Questions

- Apakah lokasi kerja (`companies`) sudah punya koordinat GPS? Perlu di-input manual?
- Apakah ada holiday calendar yang perlu di-support?
- Retention policy untuk data absensi?
