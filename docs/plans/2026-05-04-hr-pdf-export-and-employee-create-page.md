# HR: PDF Export + Employee Create Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add PDF attendance report export and a dedicated employee create page to the HR module.

**Architecture:** PDF uses `@react-pdf/renderer` (already installed, used for quotation/invoice PDFs). Create page follows existing pattern: `/hr/employees/create/page.tsx` with form, validation, and redirect. Both are additive — no existing code modified.

**Tech Stack:** @react-pdf/renderer, React, Convex, Next.js App Router, existing `pdf/styles.ts` shared styles

---

### Task 1: Create Attendance PDF Component

**Files:**
- Create: `apps/web/src/pdf/attendance-report-pdf.tsx`

**Step 1: Create the PDF component**

Follow the same pattern as `quotation-pdf.tsx` and `invoice-pdf.tsx`. Use shared styles from `pdf/styles.ts`.

```tsx
import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, colors } from "./styles";
import { StyleSheet } from "@react-pdf/renderer";

const reportStyles = StyleSheet.create({
  ...pdfStyles,
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: 8,
    color: colors.muted,
    textTransform: "uppercase",
  },
  colNIK: { width: "12%" },
  colName: { width: "20%" },
  colBranch: { width: "14%" },
  colDate: { width: "12%" },
  colClockIn: { width: "12%", textAlign: "right" },
  colClockOut: { width: "12%", textAlign: "right" },
  colStatus: { width: "10%", textAlign: "center" },
  colHours: { width: "8%", textAlign: "right" },
  statusPresent: { color: "#16a34a" },
  statusLate: { color: "#d97706" },
  statusAbsent: { color: "#dc2626" },
});

export interface AttendanceReportPDFData {
  month: string;
  branchName?: string;
  generatedAt: string;
  summary: {
    totalEmployees: number;
    avgAttendance: number;
    lateDays: number;
    totalWorkHours: number;
  };
  rows: Array<{
    nik: string;
    employeeName: string;
    branchName: string;
    date: string;
    clockIn: string;
    clockOut: string;
    status: string;
    label: string;
    totalWorkHours: string;
  }>;
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style =
    status === "present"
      ? reportStyles.statusPresent
      : status === "absent"
        ? reportStyles.statusAbsent
        : reportStyles.statusLate;
  const text = label === "late" ? "Terlambat" : status === "present" ? "Hadir" : status === "absent" ? "Alpha" : status === "on_leave" ? "Cuti" : status === "holiday" ? "Libur" : status;
  return <Text style={[reportStyles.tableCell, style]}>{text}</Text>;
}

export function AttendanceReportPDF({ data }: { data: AttendanceReportPDFData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={reportStyles.page}>
        {/* Header */}
        <View style={reportStyles.headerRow}>
          <View style={reportStyles.headerLeft}>
            <Text style={reportStyles.docTitle}>Attendance Report</Text>
            <Text style={reportStyles.companyName}>
              {data.branchName ?? "All Branches"} — {data.month}
            </Text>
            <Text style={reportStyles.headerMeta}>
              Generated: {data.generatedAt}
            </Text>
          </View>
          <View style={reportStyles.headerRight}>
            <Text style={reportStyles.sectionTitle}>Summary</Text>
            <Text style={reportStyles.headerMetaValue}>
              {data.summary.totalEmployees} Employees
            </Text>
            <Text style={reportStyles.headerMetaValue}>
              {data.summary.avgAttendance}% Attendance
            </Text>
            <Text style={reportStyles.headerMetaValue}>
              {data.summary.lateDays} Late Days
            </Text>
          </View>
        </View>

        <View style={reportStyles.divider} />

        {/* Table Header */}
        <View style={reportStyles.table}>
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colNIK]}>NIK</Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colName]}>Name</Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colBranch]}>Branch</Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colDate]}>Date</Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colClockIn]}>Clock In</Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colClockOut]}>Clock Out</Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colStatus]}>Status</Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colHours]}>Hours</Text>
          </View>

          {data.rows.map((row, i) => (
            <View
              key={`${row.nik}-${row.date}`}
              style={i % 2 === 0 ? reportStyles.tableRow : reportStyles.tableRowAlt}
            >
              <Text style={[reportStyles.tableCell, reportStyles.colNIK]}>{row.nik}</Text>
              <Text style={[reportStyles.tableCellBold, reportStyles.colName]}>{row.employeeName}</Text>
              <Text style={[reportStyles.tableCell, reportStyles.colBranch]}>{row.branchName}</Text>
              <Text style={[reportStyles.tableCell, reportStyles.colDate]}>{row.date}</Text>
              <Text style={[reportStyles.tableCell, reportStyles.colClockIn]}>{row.clockIn || "—"}</Text>
              <Text style={[reportStyles.tableCell, reportStyles.colClockOut]}>{row.clockOut || "—"}</Text>
              <View style={reportStyles.colStatus}>
                <StatusBadge status={row.status} label={row.label} />
              </View>
              <Text style={[reportStyles.tableCell, reportStyles.colHours]}>
                {row.totalWorkHours || "—"}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={reportStyles.footerDivider} />
        <Text style={reportStyles.footerThankYou}>Attendance Report — {data.month}</Text>
      </Page>
    </Document>
  );
}
```

**Step 2: Verify no import errors**

Read `apps/web/src/pdf/styles.ts` and confirm `pdfStyles`, `colors`, and the helper functions exist. The component uses spread `...pdfStyles` into `reportStyles` and adds report-specific column widths and status colors.

**Step 3: Commit**

```bash
git add apps/web/src/pdf/attendance-report-pdf.tsx
git commit -m "feat(hr): add attendance report PDF component"
```

---

### Task 2: Add PDF Export Button to Reports Page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/hr/reports/page.tsx`

**Step 1: Read the current reports page**

Read `apps/web/src/app/(dashboard)/hr/reports/page.tsx` in full. Understand:
- It already calls `getMonthlySummary` for the table view
- It already has `exportCSV` button
- It has `month` and `branchFilter` state
- Permission check: `canExport` controls button visibility

**Step 2: Add imports**

Add after existing imports:

```tsx
import { AttendanceReportPDF, type AttendanceReportPDFData } from "@/pdf/attendance-report-pdf";
import { PdfDownloadButton } from "@/components/pdf-download-button";
```

**Step 3: Add PDF data memo**

After the `totals` useMemo block, add:

```tsx
const pdfData: AttendanceReportPDFData | null = useMemo(() => {
  if (!filteredSummary.length) return null;
  // We need the detailed report rows for PDF — use getAttendanceReport
  // For now, build from monthly summary (lighter weight)
  return {
    month,
    branchName: branchFilter !== "all"
      ? (branches ?? []).find((b: any) => b.id === branchFilter)?.name
      : undefined,
    generatedAt: new Date().toLocaleDateString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
    }),
    summary: {
      totalEmployees: totals.totalEmployees,
      avgAttendance: totals.totalEmployees > 0
        ? Math.round(totals.avgAttendance / totals.totalEmployees)
        : 0,
      lateDays: totals.lateDays,
      totalWorkHours: Math.round(totals.totalWorkHours * 100) / 100,
    },
    rows: filteredSummary.map((s: any) => ({
      nik: s.nik,
      employeeName: s.employeeName,
      branchName: (branches ?? []).find((b: any) => b.id === s.branchId)?.name ?? "-",
      date: month,
      clockIn: "-",
      clockOut: "-",
      status: "present",
      label: s.late > 0 ? "late" : "",
      totalWorkHours: String(Math.round((s.totalWorkHours ?? 0) * 100) / 100),
    })),
  };
}, [filteredSummary, branches, month, branchFilter, totals]);
```

**IMPORTANT NOTE:** The monthly summary is aggregated per employee (not per day). For a detailed PDF with per-day rows, we would need to also call `getAttendanceReport`. For MVP, the PDF shows monthly summary per employee. A follow-up can add detailed daily rows.

**Step 4: Add PDF button next to CSV button**

Find the existing Export CSV button and add PDF button next to it:

```tsx
{canExport && (
  <div className="flex gap-2">
    <PdfDownloadButton
      doc={<AttendanceReportPDF data={pdfData!} />}
      fileName={`attendance-report-${month}.pdf`}
      label="Export PDF"
      disabled={!pdfData}
    />
    <Button size="sm" onClick={handleExport} disabled={exportCsv.isPending}>
      <Download className="mr-1 h-4 w-4" />Export CSV
    </Button>
  </div>
)}
```

**Step 5: Verify**

- Read the final file, confirm no syntax errors
- Ensure `PdfDownloadButton` and `AttendanceReportPDF` are correctly imported

**Step 6: Commit**

```bash
git add apps/web/src/app/(dashboard)/hr/reports/page.tsx
git commit -m "feat(hr): add PDF export button to attendance reports page"
```

---

### Task 3: Create Employee Create Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/hr/employees/create/page.tsx`

**Step 1: Read the existing create dialog for reference**

Read `apps/web/src/app/(dashboard)/hr/employees/page.tsx` lines 60-120 (the dialog with form fields). The dialog has these fields:
- `name` (required)
- `nik` (required)
- `position`
- `department`
- `phone`
- `email`
- `whatsappNumber`
- `branchId` (select from branches)

The create page should have the same fields but as a full page form with better UX (more spacing, validation feedback, breadcrumb).

**Step 2: Create the page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery, useAuthMutation } from "@/lib/convex/hooks";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input';
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { usePermission } from "@/lib/permissions/use-permission";

export default function CreateEmployeePage() {
  const router = useRouter();
  const canCreate = usePermission("hr_employees", "create");

  const [form, setForm] = useState({
    name: "",
    nik: "",
    position: "",
    department: "",
    phone: "",
    email: "",
    whatsappNumber: "",
    branchId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: branches } = useAuthQuery((api as any).hrBranches.list, {});
  const createEmployee = useAuthMutation((api as any).hrEmployees.create);

  if (!canCreate) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        You don&apos;t have permission to create employees.
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.nik.trim()) e.nik = "NIK is required";
    if (!form.branchId) e.branchId = "Branch is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createEmployee.mutateAsync({
        name: form.name.trim(),
        nik: form.nik.trim(),
        position: form.position.trim() || undefined,
        department: form.department.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        whatsappNumber: form.whatsappNumber.trim() || undefined,
        branchId: form.branchId as any,
      } as any);
      toast.success("Employee created");
      router.push("/hr/employees");
    } catch (err: any) {
      toast.error(err.data?.message ?? "Failed to create employee");
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/hr/employees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Add New Employee</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the employee details below.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4" />
            Employee Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="John Doe"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nik">NIK *</Label>
                <Input
                  id="nik"
                  value={form.nik}
                  onChange={(e) => updateField("nik", e.target.value)}
                  placeholder="Employee ID number"
                />
                {errors.nik && (
                  <p className="text-xs text-destructive">{errors.nik}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={form.position}
                  onChange={(e) => updateField("position", e.target.value)}
                  placeholder="e.g. Physiotherapist"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  placeholder="e.g. Rehabilitation"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="0812xxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input
                  id="whatsapp"
                  value={form.whatsappNumber}
                  onChange={(e) => updateField("whatsappNumber", e.target.value)}
                  placeholder="0812xxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch *</Label>
                <Select
                  value={form.branchId}
                  onValueChange={(v) => updateField("branchId", v)}
                >
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.branchId && (
                  <p className="text-xs text-destructive">{errors.branchId}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/hr/employees")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createEmployee.isPending}>
                {createEmployee.isPending ? "Creating..." : "Create Employee"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Verify**

- Read the file back, check for syntax errors
- Ensure all imports exist (`Label` from `@/components/ui/label` — verify it exists)
- Ensure `(api as any).hrEmployees.create` matches the mutation signature in `convex/hrEmployees.ts`

**Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/hr/employees/create/page.tsx
git commit -m "feat(hr): add dedicated employee create page"
```

---

### Task 4: Wire "Create Employee" Navigation

**Files:**
- Modify: `apps/web/src/app/(dashboard)/hr/employees/page.tsx`

**Step 1: Read the current employees page**

Find the "Add Employee" button that currently opens the dialog. We'll keep the dialog for quick-add BUT also support navigation to the dedicated create page via command palette `?action=create`.

**Step 2: Add auto-open create support**

Add to the employees page (after existing state declarations):

```tsx
import { useSearchParams } from 'next/navigation';
// ... in component:
const searchParams = useSearchParams();

// Auto-open create dialog when arriving via ?action=create
// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only effect
useEffect(() => {
  if (searchParams.get('action') === 'create') {
    setDialogOpen(true);
    router.replace('/hr/employees', { scroll: false });
  }
}, []);
```

This follows the exact same pattern already used in contacts, deals, and activities pages.

**Step 3: Verify**

Read the file, confirm no issues.

**Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/hr/employees/page.tsx
git commit -m "feat(hr): support ?action=create auto-open on employees page"
```

---

## Summary

| Task | Description | Files | New/Edit |
|------|-------------|-------|----------|
| 1 | Attendance PDF component | `pdf/attendance-report-pdf.tsx` | New |
| 2 | PDF export button on reports | `hr/reports/page.tsx` | Edit |
| 3 | Employee create page | `hr/employees/create/page.tsx` | New |
| 4 | Auto-open create support | `hr/employees/page.tsx` | Edit |

**Dependencies:** Task 2 depends on Task 1. Tasks 3-4 are independent.
**Estimated time:** ~15 min total
