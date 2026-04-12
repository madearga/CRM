import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfMoney, pdfDate, colors } from "./styles";

export interface InvoicePDFData {
  number: string;
  type: string;
  state: string;
  invoiceDate: number;
  dueDate: number;
  companyName?: string;
  contactName?: string;
  lines: Array<{
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    discountType?: string;
    taxAmount?: number;
    subtotal: number;
  }>;
  subtotal: number;
  discountAmount?: number;
  discountType?: string;
  taxAmount?: number;
  totalAmount: number;
  amountDue: number;
  currency?: string;
  notes?: string;
  internalNotes?: string;
  paymentTermName?: string;
}

function formatDiscount(line: InvoicePDFData["lines"][0], currency: string): string {
  if (line.discount == null) return "—";
  return line.discountType === "percentage"
    ? `${line.discount}%`
    : pdfMoney(line.discount, currency);
}

export const InvoicePDF: React.FC<{ data: InvoicePDFData }> = ({ data }) => {
  const cur = data.currency ?? "IDR";
  const computedDiscount =
    data.discountAmount != null
      ? data.discountType === "percentage"
        ? data.subtotal * data.discountAmount / 100
        : data.discountAmount
      : 0;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.headerRow}>
          <View style={pdfStyles.headerLeft}>
            <Text style={pdfStyles.docTitle}>INVOICE</Text>
            <Text style={pdfStyles.companyName}>Your Company Name</Text>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.headerMeta}>Invoice Number</Text>
            <Text style={pdfStyles.headerMetaValue}>{data.number}</Text>
            <Text style={pdfStyles.headerMeta}>Date</Text>
            <Text style={pdfStyles.headerMetaValue}>{pdfDate(data.invoiceDate)}</Text>
            <Text style={pdfStyles.headerMeta}>Due Date</Text>
            <Text style={pdfStyles.headerMetaValue}>{pdfDate(data.dueDate)}</Text>
            {data.paymentTermName && (
              <>
                <Text style={pdfStyles.headerMeta}>Payment Terms</Text>
                <Text style={pdfStyles.headerMetaValue}>{data.paymentTermName}</Text>
              </>
            )}
          </View>
        </View>

        <View style={pdfStyles.divider} />

        {/* Customer */}
        <View style={pdfStyles.customerBlock}>
          <Text style={pdfStyles.sectionTitle}>Bill To</Text>
          {data.companyName && <Text style={pdfStyles.customerName}>{data.companyName}</Text>}
          {data.contactName && <Text style={pdfStyles.customerDetail}>{data.contactName}</Text>}
          {!data.companyName && !data.contactName && <Text style={pdfStyles.customerDetail}>—</Text>}
        </View>

        {/* Line items */}
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colNum]}>#</Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colProduct]}>Product</Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colQty]}>Qty</Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colPrice]}>Unit Price</Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colDiscount]}>Discount</Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colTax]}>Tax</Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colSubtotal]}>Subtotal</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={i % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt}>
              <Text style={[pdfStyles.tableCell, pdfStyles.colNum]}>{i + 1}</Text>
              <View style={pdfStyles.colProduct}>
                <Text style={pdfStyles.tableCell}>{line.productName}</Text>
                {line.description && <Text style={pdfStyles.tableCellMuted}>{line.description}</Text>}
              </View>
              <Text style={[pdfStyles.tableCell, pdfStyles.colQty]}>{line.quantity}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.colPrice]}>{pdfMoney(line.unitPrice, cur)}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.colDiscount]}>{formatDiscount(line, cur)}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.colTax]}>
                {line.taxAmount != null ? pdfMoney(line.taxAmount, cur) : "—"}
              </Text>
              <Text style={[pdfStyles.tableCellBold, pdfStyles.colSubtotal]}>{pdfMoney(line.subtotal, cur)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={pdfStyles.totalsContainer}>
          <View style={pdfStyles.totalsBlock}>
            <View style={pdfStyles.totalsRow}>
              <Text style={pdfStyles.totalsLabel}>Subtotal</Text>
              <Text style={pdfStyles.totalsValue}>{pdfMoney(data.subtotal, cur)}</Text>
            </View>
            {computedDiscount > 0 && (
              <View style={pdfStyles.totalsRow}>
                <Text style={pdfStyles.totalsLabel}>
                  Discount{data.discountType === "percentage" ? ` (${data.discountAmount}%)` : ""}
                </Text>
                <Text style={pdfStyles.totalsValue}>-{pdfMoney(computedDiscount, cur)}</Text>
              </View>
            )}
            {data.taxAmount != null && (
              <View style={pdfStyles.totalsRow}>
                <Text style={pdfStyles.totalsLabel}>Tax</Text>
                <Text style={pdfStyles.totalsValue}>{pdfMoney(data.taxAmount, cur)}</Text>
              </View>
            )}
            <View style={pdfStyles.totalsRowFinal}>
              <Text style={pdfStyles.totalsLabelFinal}>Total</Text>
              <Text style={pdfStyles.totalsValueFinal}>{pdfMoney(data.totalAmount, cur)}</Text>
            </View>
            {data.amountDue !== data.totalAmount && (
              <View style={pdfStyles.totalsRow}>
                <Text style={[pdfStyles.totalsLabel, { color: colors.danger }]}>Amount Due</Text>
                <Text style={[pdfStyles.totalsValue, { color: colors.danger, fontFamily: "Helvetica-Bold" }]}>
                  {pdfMoney(data.amountDue, cur)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={pdfStyles.footerDivider} />
        {data.notes && (
          <View style={{ marginBottom: 8 }}>
            <Text style={pdfStyles.sectionTitle}>Notes</Text>
            <Text style={pdfStyles.footerNotes}>{data.notes}</Text>
          </View>
        )}
        {data.paymentTermName && (
          <View style={{ marginBottom: 8 }}>
            <Text style={pdfStyles.sectionTitle}>Payment Terms</Text>
            <Text style={pdfStyles.footerNotes}>{data.paymentTermName}</Text>
          </View>
        )}
        <View>
          <Text style={pdfStyles.sectionTitle}>Bank Details</Text>
          <Text style={pdfStyles.footerNotes}>Bank Name: —</Text>
          <Text style={pdfStyles.footerNotes}>Account Number: —</Text>
          <Text style={pdfStyles.footerNotes}>Account Name: —</Text>
        </View>
        <Text style={pdfStyles.footerThankYou}>Thank you for your business!</Text>
      </Page>
    </Document>
  );
};
