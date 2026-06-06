"use client";

import { Document, Page, Text, View, StyleSheet, Image, Link } from "@react-pdf/renderer";

// ============================================================================
// TYPES
// ============================================================================

export interface TaxInvoiceItem {
  description: string;
  qty: string;
  uom: string;
  unitPrice: string;
  discount: string;
}

export interface TaxInvoiceData {
  invoiceNo: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  clientTRN: string;
  clientPhone: string;
  project: string;
  poReference: string;
  items: TaxInvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  vatAmount: number;
  total: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  notes: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Column widths for the items table (all percentages — must sum to 100%)
const COL_WIDTHS = {
  sn: "5%",
  description: "33%",
  qty: "7%",
  unit: "7%",
  unitPrice: "12%",
  discount: "8%",
  taxable: "14%",
  vat: "8%",
  total: "14%",
};

// ============================================================================
// HELPERS — Number-to-words conversion
// ============================================================================

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const TEENS = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion"];

function convertChunk(n: number): string {
  let r = "";
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;

  if (hundreds > 0) r += `${ONES[hundreds]} Hundred`;

  if (rem >= 20) {
    if (r) r += " ";
    r += TENS[Math.floor(rem / 10)];
    if (rem % 10 > 0) r += ` ${ONES[rem % 10]}`;
  } else if (rem >= 10) {
    if (r) r += " ";
    r += TEENS[rem - 10];
  } else if (rem > 0) {
    if (r) r += " ";
    r += ONES[rem];
  }

  return r;
}

function convertNumberToWords(num: number): string {
  if (num === 0) return "Zero";
  const parts: string[] = [];
  let scaleIdx = 0;
  let v = num;
  while (v > 0) {
    const chunk = v % 1000;
    if (chunk !== 0) {
      parts.unshift(`${convertChunk(chunk)}${scaleIdx > 0 ? ` ${SCALES[scaleIdx]}` : ""}`);
    }
    v = Math.floor(v / 1000);
    scaleIdx++;
  }
  return parts.join(" ").trim();
}

function amountToWords(a: number): string {
  const safe = Number.isFinite(a) ? a : 0;
  const dirhams = Math.floor(safe);
  const fils = Math.round((safe - dirhams) * 100);
  let result = `${convertNumberToWords(dirhams)} Dirhams`;
  if (fils > 0) result += ` and ${convertNumberToWords(fils)} Fils`;
  return `${result} Only`;
}

// ============================================================================
// HELPERS — Per-item calculation
// ============================================================================

function calcItem(item: TaxInvoiceItem) {
  const qty = Number(item.qty || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const discountPct = Math.max(0, Number(item.discount || 0));
  const gross = qty * unitPrice;
  const disc = gross * (discountPct / 100);
  const taxable = gross - disc;
  const vat = taxable * 0.05;
  return { gross, disc, taxable, vat, total: taxable + vat };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TaxInvoiceDocument({ data }: { data: TaxInvoiceData }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bg = `${origin}/letterhead-bg.png`;

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        {/* Letterhead background */}
        <Image fixed src={bg} style={s.bg} />

        {/* Hidden footer contact links — clickable, invisible text */}
        <View fixed style={s.footerLinks}>
          <Link src="tel:+971551256488" style={s.phoneLink}><Text style={s.hiddenText}>p</Text></Link>
          <Link src="mailto:info@nexayraarc.com" style={s.emailLink}><Text style={s.hiddenText}>e</Text></Link>
          <Link src="https://nexayraarc.com/" style={s.webLink}><Text style={s.hiddenText}>w</Text></Link>
        </View>

        <View style={s.content}>
          {/* ----- Invoice header (title + meta) ----- */}
          <View style={s.headerRow}>
            <View style={{ flex: 1 }} />
            <View style={s.titleBlock}>
              <Text style={s.title}>TAX INVOICE</Text>
              <Text style={s.meta}>Invoice No: {data.invoiceNo}</Text>
              <Text style={s.meta}>Date: {data.date}</Text>
              <Text style={s.meta}>Due Date: {data.dueDate || "-"}</Text>
              {data.poReference ? <Text style={s.meta}>PO Ref: {data.poReference}</Text> : null}
            </View>
          </View>

          {/* ----- From / Bill To ----- */}
          <View style={s.parties}>
            <View style={s.partyBox}>
              <Text style={s.partyHeader}>FROM</Text>
              <Text style={s.bold}>Nexayra Arc General Contracting L.L.C.</Text>
              <Text>Abu Dhabi, UAE</Text>
              <Text>Phone: +971 55 125 6488</Text>
              <Text>TRN: -</Text>
            </View>
            <View style={s.partyBox}>
              <Text style={s.partyHeader}>BILL TO</Text>
              <Text style={s.bold}>{data.clientName || "-"}</Text>
              <Text>{data.clientAddress || "-"}</Text>
              <Text>Phone: {data.clientPhone || "-"}</Text>
              <Text>TRN: {data.clientTRN || "-"}</Text>
              {data.project ? <Text>Project: {data.project}</Text> : null}
            </View>
          </View>

          {/* ----- Items table header ----- */}
          <View style={s.tableHeaderRow}>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.sn }]}>S/N</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.description }]}>Description</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.qty }]}>Qty</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.unit }]}>Unit</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.unitPrice, textAlign: "right" }]}>Unit Price</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.discount, textAlign: "right" }]}>Disc%</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.taxable, textAlign: "right" }]}>Taxable</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.vat, textAlign: "right" }]}>VAT</Text>
            <Text style={[s.tableHeaderCell, { width: COL_WIDTHS.total, textAlign: "right", borderRightWidth: 0 }]}>Total</Text>
          </View>

          {/* ----- Items table rows ----- */}
          {data.items.map((item, i) => {
            const r = calcItem(item);
            return (
              <View key={i} style={s.tableRow} wrap={false}>
                <Text style={[s.tableCell, { width: COL_WIDTHS.sn }]}>{i + 1}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.description }]}>{item.description || "-"}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.qty }]}>{item.qty || "0"}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.unit }]}>{item.uom || "-"}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.unitPrice, textAlign: "right" }]}>{Number(item.unitPrice || 0).toFixed(2)}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.discount, textAlign: "right" }]}>{Number(item.discount || 0).toFixed(2)}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.taxable, textAlign: "right" }]}>{r.taxable.toFixed(2)}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.vat, textAlign: "right" }]}>{r.vat.toFixed(2)}</Text>
                <Text style={[s.tableCell, { width: COL_WIDTHS.total, textAlign: "right", borderRightWidth: 0 }]}>{r.total.toFixed(2)}</Text>
              </View>
            );
          })}

          {/* ----- Totals + words + bank + notes (kept together) ----- */}
          <View wrap={false}>
            <View style={s.totals}>
              <View style={s.totalsRow}><Text>Subtotal</Text><Text>{data.subtotal.toFixed(2)}</Text></View>
              <View style={s.totalsRow}><Text>Total Discount</Text><Text>{data.totalDiscount.toFixed(2)}</Text></View>
              <View style={s.totalsRow}><Text>Taxable Amount</Text><Text>{data.taxableAmount.toFixed(2)}</Text></View>
              <View style={s.totalsRow}><Text>VAT (5%)</Text><Text>{data.vatAmount.toFixed(2)}</Text></View>
              <View style={[s.totalsRow, s.totalsHighlight]}>
                <Text style={s.bold}>TOTAL (AED)</Text>
                <Text style={s.bold}>{data.total.toFixed(2)}</Text>
              </View>
            </View>

            <View style={s.wordsBox}>
              <Text>
                <Text style={s.bold}>Amount in Words: </Text>
                {amountToWords(data.total)}
              </Text>
            </View>

            {data.bankName ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>BANK DETAILS</Text>
                <Text>Bank: {data.bankName}</Text>
                <Text>Account Name: {data.accountName || "-"}</Text>
                <Text>Account No: {data.accountNumber || "-"}</Text>
                {data.iban ? <Text>IBAN: {data.iban}</Text> : null}
                {data.swiftCode ? <Text>SWIFT: {data.swiftCode}</Text> : null}
              </View>
            ) : null}

            {data.notes ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>NOTES</Text>
                <Text>{data.notes}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  // ----- Page + background -----
  page: {
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#1c2143",
    position: "relative",
    backgroundColor: "#fff",
  },
  bg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    objectFit: "fill",
  },

  // ----- Content wrapper — paddingTop controls the gap below the letterhead -----
  content: {
    paddingTop: 20,        // was 88 — pulled everything up
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 90,
  },

  // ----- Typography -----
  bold: { fontWeight: "bold" },

  // ----- Header (title + meta) -----
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,      // was 16 — tighter
  },
  titleBlock: { textAlign: "right" },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#1c2143",
  },
  meta: { fontSize: 9, marginBottom: 2 },

  // ----- Parties (From / Bill To) -----
  parties: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,      // was 12
  },
  partyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#c8d1e6",
    padding: 8,
    borderRadius: 2,
  },
  partyHeader: {
    backgroundColor: "#eef2f8",
    padding: 3,
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 9,
  },

  // ----- Items table -----
  tableHeaderRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#c8d1e6",
    backgroundColor: "#eef2f8",
    marginTop: 6,          // was 8
  },
  tableHeaderCell: {
    padding: 4,
    fontWeight: "bold",
    fontSize: 7.5,
    borderRightWidth: 1,
    borderColor: "#c8d1e6",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#c8d1e6",
  },
  tableCell: {
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderColor: "#c8d1e6",
  },

  // ----- Totals block -----
  totals: {
    width: "40%",
    alignSelf: "flex-end",
    marginTop: 10,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#c8d1e6",
    borderTopWidth: 1,
    padding: 5,
    fontSize: 9,
  },
  totalsHighlight: { backgroundColor: "#eef2f8" },

  // ----- Amount in words -----
  wordsBox: {
    borderWidth: 1,
    borderColor: "#c8d1e6",
    padding: 6,
    marginTop: 8,
  },

  // ----- Bank / Notes section -----
  section: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#c8d1e6",
    padding: 8,
  },
  sectionTitle: {
    fontWeight: "bold",
    backgroundColor: "#eef2f8",
    padding: 3,
    marginBottom: 4,
  },

  // ----- Footer clickable link overlays -----
  footerLinks: {
    position: "absolute",
    left: 20,
    bottom: 12,
    width: 555,
    height: 47,
  },
  hiddenText: { fontSize: 1, color: "#fff", opacity: 0 },
  phoneLink: { position: "absolute", left: 8, top: 18, width: 80, height: 12 },
  emailLink: { position: "absolute", left: 86, top: 18, width: 120, height: 12 },
  webLink: { position: "absolute", left: 248, top: 18, width: 135, height: 12 },
});