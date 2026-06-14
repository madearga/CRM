## Tasks

### Phase 1: Database Schema
- [x] Tambah tabel `employees` di `convex/schema.ts` — fields, edges ke organization/companies/user, indexes (nik, organizationId, branchId, status)
- [x] Tambah tabel `shifts` — fields, edges ke organization/companies, indexes
- [x] Tambah tabel `shiftAssignments` — fields, edges ke employees/shifts, indexes (employeeId+date, branchId+date)
- [x] Tambah tabel `attendanceRecords` — fields, edges ke employees/shiftAssignments, compound indexes (organizationId+branchId+date, employeeId+date)
- [x] Tambah tabel `attendanceCorrections` — fields, edges ke attendanceRecords/user, indexes (status)
- [x] Tambah field `latitude` dan `longitude` (optional) ke tabel `companies` untuk GPS branch location
- [x] Seed permission entries: `hr_admin` → full access HR features, `branch_manager` → read/write own location only

### Phase 2: Employee Management API
- [x] `convex/hrEmployees.ts` — mutation create employee, validate unique NIK per organization
- [x] `convex/hrEmployees.ts` — mutation update employee fields
- [x] `convex/hrEmployees.ts` — mutation change status (aktif/cuti/resign), handle side effects
- [x] `convex/hrEmployees.ts` — query list with filters (branch, department, status, search), pagination
- [x] `convex/hrEmployees.ts` — query single employee with related data (attendance summary, active shifts)

### Phase 3: Shift Scheduling API
- [x] `convex/hrShifts.ts` — mutation create shift definition per branch
- [x] `convex/hrShifts.ts` — query shifts per branch/organization
- [x] `convex/hrShifts.ts` — CRUD update dan delete shift definitions
- [x] `convex/hrShiftAssignments.ts` — mutation assign employee to shift (single + recurring weekly)
- [x] `convex/hrShiftAssignments.ts` — mutation remove assignment, validate no past attendance
- [x] `convex/hrShiftAssignments.ts` — query schedule by week/month, resolve recurring assignments lazily
- [x] `convex/hrShiftAssignments.ts` — query upcoming shifts for specific employee

### Phase 4: Attendance Tracking API
- [x] `convex/hrAttendance.ts` — mutation clock-in: find active shift, calculate status, validate geolocation (WhatsApp + web source)
- [x] `convex/hrAttendance.ts` — mutation clock-out: calculate duration, detect early leave
- [x] `convex/hrAttendance.ts` — query getDailySummary per branch (hadir/terlambat/alpha)
- [x] `convex/hrAttendance.ts` — query getByEmployee attendance history per employee
- [x] `convex/hrCorrections.ts` — mutation submit correction request
- [x] `convex/hrCorrections.ts` — mutation review approve/reject correction, recalculate if approved

### Phase 5: Reports API
- [x] `convex/hrReports.ts` — query getAttendanceReport filterable report (branch, period, employee, status)
- [x] `convex/hrReports.ts` — query getMonthlySummary rekap per employee per bulan
- [x] `convex/hrReports.ts` — action exportCSV generate CSV download
- [x] `app/api/reports/attendance-pdf/route.ts` — Next.js API route generate PDF (deferred: CSV already works)

### Phase 6: Frontend — Employee Management
- [x] `app/(dashboard)/hr/employees/page.tsx` — list page with filters, search, pagination (194 lines)
- [x] `app/(dashboard)/hr/employees/[id]/page.tsx` — employee detail/profile page (177 lines)
- [x] `app/(dashboard)/hr/employees/create/page.tsx` — create employee form (done via dialog di list page)
- [x] Employee form component — form dengan validasi via dialog create/edit

### Phase 7: Frontend — Shift Scheduling
- [x] `app/(dashboard)/hr/shifts/page.tsx` — shift list + create via dialog
- [x] `app/(dashboard)/hr/shifts/create/page.tsx` — create shift form terpisah (done via dialog di list page)
- [x] `app/(dashboard)/hr/assignments/page.tsx` — assign employee to shift (single/recurring)

### Phase 8: Frontend — Attendance
- [x] `app/(dashboard)/hr/attendance/page.tsx` — daily summary per branch, clock-in/out status
- [x] Clock-in/out widget — location capture, status display, branch validation (QR-based)
- [x] `app/(dashboard)/hr/corrections/page.tsx` — correction requests list, approve/reject for HR

### Phase 9: Frontend — Reports
- [x] `app/(dashboard)/hr/reports/page.tsx` — report generator with filters
- [x] Report results table — sortable, paginated
- [x] Export button — CSV download (PDF belum)

### Phase 10: Frontend — Dashboard & Navigation
- [x] HR Dashboard widgets — attendance overview, monthly stats, late alerts (`/hr/page.tsx`)
- [x] Tambah menu "HR" di sidebar navigasi dengan sub-items: Dashboard, Branches, Employees, Shifts, Assignments, Attendance, Corrections, Holidays, Reports
- [x] Permission guards — restrict HR pages via `usePermission('hr_*', 'view|create|edit|manage|export')` di setiap page

### Bonus (tidak ada di tasks.md awal, tapi sudah diimplementasi)
- [x] `convex/hrBranches.ts` — CRUD branches dengan QR code generation
- [x] `convex/hrHolidays.ts` — holiday management + bulk import
- [x] WhatsApp clock-in source (`clockInFromWhatsApp`, `clockOutFromWhatsApp`)
- [x] Auto-close open records cron (`autoCloseOpenRecords`)
- [x] `convex/hrUtils.ts` — shared timezone helpers (Asia/Jakarta)
- [x] `convex/hrTypes.ts` — centralized Zod schemas
