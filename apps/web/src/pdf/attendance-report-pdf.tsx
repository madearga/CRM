import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfStyles, colors } from "./styles";

const reportStyles = StyleSheet.create({
  page: {
    ...pdfStyles.page,
    padding: 30,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryCard: {
    width: "23%",
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
    padding: 10,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 8,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.altRow,
  },
  tableCell: {
    fontSize: 8,
  },
  statusPresent: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
  },
  statusLate: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#d97706",
  },
  statusAbsent: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.danger,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: colors.footer,
  },
  // Column widths
  colNik: { width: "12%" },
  colName: { width: "20%" },
  colBranch: { width: "14%" },
  colDate: { width: "12%" },
  colClockIn: { width: "12%" },
  colClockOut: { width: "12%" },
  colStatus: { width: "10%" },
  colHours: { width: "8%", textAlign: "right" },
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
    status: "present" | "late" | "absent";
    label: string;
    totalWorkHours: number;
  }>;
}

function StatusCell({ status, label }: { status: string; label: string }) {
  if (status === "present") {
    return <Text style={reportStyles.statusPresent}>{label}</Text>;
  }
  if (status === "late") {
    return <Text style={reportStyles.statusLate}>{label}</Text>;
  }
  if (status === "absent") {
    return <Text style={reportStyles.statusAbsent}>{label}</Text>;
  }
  return <Text style={reportStyles.tableCell}>{label}</Text>;
}

export const AttendanceReportPDF: React.FC<{ data: AttendanceReportPDFData }> = ({
  data,
}) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={reportStyles.page}>
        {/* Header */}
        <View style={reportStyles.headerRow}>
          <View style={reportStyles.headerLeft}>
            <Text style={reportStyles.docTitle}>Attendance Report</Text>
            <Text style={reportStyles.metaText}>
              {data.branchName || "All Branches"}
            </Text>
          </View>
          <View style={reportStyles.headerRight}>
            <Text style={reportStyles.metaText}>Month</Text>
            <Text style={reportStyles.metaValue}>{data.month}</Text>
            <Text style={reportStyles.metaText}>Generated</Text>
            <Text style={reportStyles.metaValue}>{data.generatedAt}</Text>
          </View>
        </View>

        <View style={reportStyles.divider} />

        {/* Summary */}
        <View style={reportStyles.summaryRow}>
          <View style={reportStyles.summaryCard}>
            <Text style={reportStyles.summaryLabel}>Total Employees</Text>
            <Text style={reportStyles.summaryValue}>
              {data.summary.totalEmployees}
            </Text>
          </View>
          <View style={reportStyles.summaryCard}>
            <Text style={reportStyles.summaryLabel}>Avg Attendance</Text>
            <Text style={reportStyles.summaryValue}>
              {data.summary.avgAttendance}%
            </Text>
          </View>
          <View style={reportStyles.summaryCard}>
            <Text style={reportStyles.summaryLabel}>Late Days</Text>
            <Text style={reportStyles.summaryValue}>
              {data.summary.lateDays}
            </Text>
          </View>
          <View style={reportStyles.summaryCard}>
            <Text style={reportStyles.summaryLabel}>Total Work Hours</Text>
            <Text style={reportStyles.summaryValue}>
              {data.summary.totalWorkHours}h
            </Text>
          </View>
        </View>

        {/* Table */}
        <View style={reportStyles.table}>
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colNik]}>
              NIK
            </Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colName]}>
              Name
            </Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colBranch]}>
              Branch
            </Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colDate]}>
              Date
            </Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colClockIn]}>
              Clock In
            </Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colClockOut]}>
              Clock Out
            </Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colStatus]}>
              Status
            </Text>
            <Text style={[reportStyles.tableHeaderCell, reportStyles.colHours]}>
              Hours
            </Text>
          </View>
          {data.rows.map((row, i) => (
            <View
              key={i}
              style={i % 2 === 0 ? reportStyles.tableRow : reportStyles.tableRowAlt}
            >
              <Text style={[reportStyles.tableCell, reportStyles.colNik]}>
                {row.nik}
              </Text>
              <Text style={[reportStyles.tableCell, reportStyles.colName]}>
                {row.employeeName}
              </Text>
              <Text style={[reportStyles.tableCell, reportStyles.colBranch]}>
                {row.branchName}
              </Text>
              <Text style={[reportStyles.tableCell, reportStyles.colDate]}>
                {row.date}
              </Text>
              <Text style={[reportStyles.tableCell, reportStyles.colClockIn]}>
                {row.clockIn}
              </Text>
              <Text style={[reportStyles.tableCell, reportStyles.colClockOut]}>
                {row.clockOut}
              </Text>
              <View style={reportStyles.colStatus}>
                <StatusCell status={row.status} label={row.label} />
              </View>
              <Text style={[reportStyles.tableCell, reportStyles.colHours]}>
                {row.totalWorkHours}h
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={reportStyles.footer} fixed>
          <Text style={reportStyles.footerText}>
            Attendance Report — {data.month}
          </Text>
          <Text style={reportStyles.footerText}>
            Page 1 of 1
          </Text>
        </View>
      </Page>
    </Document>
  );
};
