import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  primary: "#4f46e5",
  primaryLight: "#eef2ff",
  text: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
  white: "#ffffff",
  altRow: "#f8fafc",
  footer: "#94a3b8",
  danger: "#dc2626",
};

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: colors.text,
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 2,
  },
  headerMetaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 20,
  },
  // Customer
  sectionTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  customerBlock: {
    marginBottom: 20,
  },
  customerName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  customerDetail: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 1,
  },
  // Table
  table: {
    marginBottom: 16,
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
    fontSize: 9,
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  tableCellMuted: {
    fontSize: 8,
    color: colors.muted,
  },
  // Column widths
  colNum: { width: "6%" },
  colProduct: { width: "30%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colDiscount: { width: "12%", textAlign: "right" },
  colTax: { width: "12%", textAlign: "right" },
  colSubtotal: { width: "14%", textAlign: "right" },
  // Totals
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  totalsBlock: {
    width: "45%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    marginTop: 4,
  },
  totalsLabel: {
    fontSize: 10,
    color: colors.muted,
  },
  totalsValue: {
    fontSize: 10,
  },
  totalsLabelFinal: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  totalsValueFinal: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  // Footer
  footerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 20,
    marginBottom: 12,
  },
  footerNotes: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 4,
  },
  footerThankYou: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: 16,
    textAlign: "center",
  },
});

/** Format money for PDF (same logic as format-money.ts but for PDF context) */
export function pdfMoney(amount: number, currency: string = "IDR"): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function pdfDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
