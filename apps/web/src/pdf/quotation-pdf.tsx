import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfMoney, pdfDate, colors } from "./styles";

export interface QuotationPDFData {
  number: string;
  state: string;
  orderDate: number;
  validUntil?: number;
  deliveryDate?: number;
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
  currency?: string;
  customerNotes?: string;
  internalNotes?: string;
  terms?: string;
}

function formatDiscount(line: QuotationPDFData["lines"][0], currency: string): string {
  if (line.discount == null) return "—";
  return line.discountType === "percentage"
    ? `${line.discount}%`
    : pdfMoney(line.discount, currency);
}

export const QuotationPDF: React.FC<{ data: QuotationPDFData }> = ({ data }) => {
  const cur = data.currency ?? "IDR";
  const computedDiscount =
    data.discountAmount != null
      ? data.discountType === "percentage"
        ? data.subtotal * data.discountAmount / 100
        : data.discountAmount
      : 0;

  const docLabel = data.state === "draft" ? "QUOTATION" : "SALE ORDER";

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.headerRow}>
          <View style={pdfStyles.headerLeft}>
            <Text style={pdfStyles.docTitle}>{docLabel}</Text>
            <Text style={pdfStyles.companyName}>Your Company Name</Text>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.headerMeta}>Order Number</Text>
            <Text style={pdfStyles.headerMetaValue}>{data.number}</Text>
            <Text style={pdfStyles.headerMeta}>Order Date</Text>
            <Text style={pdfStyles.headerMetaValue}>{pdfDate(data.orderDate)}</Text>
            {data.validUntil && (
              <>
                <Text style={pdfStyles.headerMeta}>Valid Until</Text>
                <Text style={pdfStyles.headerMetaValue}>{pdfDate(data.validUntil)}</Text>
              </>
            )}
            {data.deliveryDate && (
              <>
                <Text style={pdfStyles.headerMeta}>Delivery Date</Text>
                <Text style={pdfStyles.headerMetaValue}>{pdfDate(data.deliveryDate)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={pdfStyles.divider} />

        {/* Customer */}
        <View style={pdfStyles.customerBlock}>
          <Text style={pdfStyles.sectionTitle}>Customer</Text>
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
          </View>
        </View>

        {/* Footer */}
        <View style={pdfStyles.footerDivider} />
        {data.customerNotes && (
          <View style={{ marginBottom: 8 }}>
            <Text style={pdfStyles.sectionTitle}>Customer Notes</Text>
            <Text style={pdfStyles.footerNotes}>{data.customerNotes}</Text>
          </View>
        )}
        {data.terms && (
          <View style={{ marginBottom: 8 }}>
            <Text style={pdfStyles.sectionTitle}>Terms & Conditions</Text>
            <Text style={pdfStyles.footerNotes}>{data.terms}</Text>
          </View>
        )}
        <Text style={pdfStyles.footerThankYou}>Thank you for your business!</Text>
      </Page>
    </Document>
  );
};
