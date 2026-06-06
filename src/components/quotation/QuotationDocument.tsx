"use client";

import { Document, Page, Text, View, StyleSheet, Image, Link } from "@react-pdf/renderer";

// ============================================================================
// TYPES
// ============================================================================

export interface QuotationItem {
  srNo: string;
  description: string;
  unit: string;        // UOM, e.g. "Nos", "Mtrs", "Sq.m"
  qty: string;
  unitRate: string;
  amount: string;      // qty × unitRate, stored as string for display flexibility
}

export interface QuotationData {
  quotationNo: string;
  date: string;
  to: string;
  attn: string;
  project: string;
  serviceTitle: string;
  introParagraph: string;
  annexure1Title: string;
  annexure2Title: string;
  annexure3Title: string;
  closingParagraph: string;
  signatoryName: string;
  signatoryDesignation: string;
  inclusionItems: string[];
  exclusionItems: string[];
  boqItems: QuotationItem[];
  totalWithoutVat: number;
  vatPercent: number;
  vatAmount: number;
  totalWithVat: number;
  amountInWords: string;
  paymentTerms: string[];
  validity: string;
  attachmentNames?: string[];
  projectId?: string;
  projectCode?: string;
}

// ============================================================================
// PAGE / LAYOUT CONSTANTS
// ============================================================================

const A4W = 595.28;
const A4H = 841.89;

const SAFE_TOP = 92;
// Single continuous document now. Bottom padding is sized to clear the stamp
// zone on page 1 (stamp top sits ~166pt from the bottom). Using this value
// document-wide guarantees flowing content never collides with the stamp or
// the footer on any page.
const SAFE_BOTTOM = 176;
const SAFE_SIDE = 56;

// ============================================================================
// COLUMN WIDTHS — change these here, applies to header AND rows
// ============================================================================

const COL_WIDTHS = {
  srNo:        "8%",
  description: "44%",
  unit:        "10%",
  qty:         "10%",
  unitRate:    "13%",
  amount:      "15%",
};

// ============================================================================
// HELPERS
// ============================================================================

function fmtMoney(v: number): string {
  return `${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/-`;
}

// ============================================================================
// COMPONENTS — Footer, TableHeader, TableRow, TotalsBlock
// ============================================================================

function Footer() {
  return (
    <View fixed style={s.fll}>
      <Link src="tel:+971551256488" style={s.pl}>
        <Text style={s.ht}>p</Text>
      </Link>
      <Link src="mailto:info@nexayraarc.com" style={s.el}>
        <Text style={s.ht}>e</Text>
      </Link>
      <Link src="https://nexayraarc.com/" style={s.wl}>
        <Text style={s.ht}>w</Text>
      </Link>
      <Link src="https://instagram.com/nexayraarc" style={s.il}>
        <Text style={s.ht}>i</Text>
      </Link>
      <Link src="https://www.linkedin.com/in/nexayra" style={s.ll}>
        <Text style={s.ht}>l</Text>
      </Link>
    </View>
  );
}

function TableHeader() {
  return (
    <View style={s.thr}>
      <Text style={[{ width: COL_WIDTHS.srNo },        s.colCell, s.b, s.cn]}>Sr. no.</Text>
      <Text style={[{ width: COL_WIDTHS.description }, s.colCell, s.b, s.cn]}>Description</Text>
      <Text style={[{ width: COL_WIDTHS.unit },        s.colCell, s.b, s.cn]}>Unit</Text>
      <Text style={[{ width: COL_WIDTHS.qty },         s.colCell, s.b, s.cn]}>Qty</Text>
      <Text style={[{ width: COL_WIDTHS.unitRate },    s.colCell, s.b, s.cn]}>Unit Rate</Text>
      <Text style={[{ width: COL_WIDTHS.amount },      s.colCellLast, s.b, s.cn]}>Amount (AED)</Text>
    </View>
  );
}

function TableRow({ item }: { item: QuotationItem }) {
  return (
    <View style={s.tbr} wrap={false}>
      <Text style={[{ width: COL_WIDTHS.srNo },        s.colCell, s.cn]}>{item.srNo || "-"}</Text>
      <Text style={[{ width: COL_WIDTHS.description }, s.colCell]}>{item.description || "-"}</Text>
      <Text style={[{ width: COL_WIDTHS.unit },        s.colCell, s.cn]}>{item.unit || "-"}</Text>
      <Text style={[{ width: COL_WIDTHS.qty },         s.colCell, s.cn]}>{item.qty || "-"}</Text>
      <Text style={[{ width: COL_WIDTHS.unitRate },    s.colCell, s.rt]}>{item.unitRate || "-"}</Text>
      <Text style={[{ width: COL_WIDTHS.amount },      s.colCellLast, s.rt]}>{item.amount || "-"}</Text>
    </View>
  );
}

// Totals block. marginTop: -1 overlaps the bottom border of the BOQ row
// directly above it so the table and totals read as one connected grid.
function TotalsBlock({ q }: { q: QuotationData }) {
  return (
    <View style={{ marginTop: -1 }}>
      <View style={[s.tr, s.trFirst]}>
        <Text style={s.tlw}>Total Amount without Vat (AED)</Text>
        <Text style={s.tvn}>{fmtMoney(q.totalWithoutVat)}</Text>
      </View>
      <View style={s.tr}>
        <Text style={s.tlw}>Vat@{q.vatPercent}%</Text>
        <Text style={s.tvn}>{fmtMoney(q.vatAmount)}</Text>
      </View>
      <View style={s.tr}>
        <Text style={s.tlw}>Total Amount with Vat</Text>
        <Text style={s.tvn}>{fmtMoney(q.totalWithVat)}</Text>
      </View>
      <View style={s.wr}>
        <Text style={s.wrl}>In Words (AED):</Text>
        <Text style={s.wrv}>{q.amountInWords || "-"}</Text>
      </View>
    </View>
  );
}

// Renders the BOQ table with the totals block kept attached to the LAST row.
// - 1 item:  header + row + totals are one non-breaking unit.
// - 2+ items: header+first row stay together; middle rows flow freely;
//             the last row + totals stay together so totals never orphan.
function BoqTable({ q }: { q: QuotationData }) {
  const items = q.boqItems;
  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <View wrap={false} minPresenceAhead={90}>
        <TableHeader />
        <TableRow item={items[0]} />
        <TotalsBlock q={q} />
      </View>
    );
  }

  const lastIndex = items.length - 1;

  return (
    <>
      {/* Header always sits with at least the first row */}
      <View wrap={false} minPresenceAhead={90}>
        <TableHeader />
        <TableRow item={items[0]} />
      </View>

      {/* Middle rows flow naturally and may break across pages */}
      {items.slice(1, lastIndex).map((item, i) => (
        <TableRow key={`${item.srNo}-${i + 1}`} item={item} />
      ))}

      {/* Last row + totals stay glued together */}
      <View wrap={false}>
        <TableRow item={items[lastIndex]} />
        <TotalsBlock q={q} />
      </View>
    </>
  );
}

// ============================================================================
// MAIN DOCUMENT
// ============================================================================

export default function QuotationDocument({
  quotationData: q,
}: {
  quotationData: QuotationData;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bg = `${origin}/letterhead-bg.png`;
  const stamp = `${origin}/approved-stamp.png`;
  const sig = `${origin}/quotation-signature.png`;

  const subject = `Quotation & Proposal for ${q.serviceTitle || "-"}`;

  return (
    <Document>
      {/* ====================================================================
          ONE CONTINUOUS PAGE
          The cover content and the annexures live in a single flowing page.
          If the cover content overflows, Annexure-1 continues on that same
          spillover page rather than starting a brand-new page. If the cover
          fits, the annexure simply flows after it.
          ==================================================================== */}
      <Page size="A4" style={s.page} wrap>
        {/* Letterhead background — every page */}
        <Image fixed src={bg} style={s.bg} />

        {/* Approved stamp — page 1 only (decorative, bottom-right) */}
        <View
          fixed
          style={s.ps}
          render={({ pageNumber }) =>
            pageNumber === 1 ? (
              <Image src={stamp} style={s.psImg} />
            ) : null
          }
        />

        {/* Hidden footer contact links — every page */}
        <Footer />

        {/* -------------------- COVER CONTENT -------------------- */}
        <View style={s.ct}>
          <Text style={s.ln}><Text style={s.b}>Date:</Text> {q.date || "-"}</Text>
          <Text style={s.ln}><Text style={s.b}>To:</Text> {q.to || "-"}</Text>
          <Text style={s.ln}><Text style={s.b}>Attn:</Text> {q.attn || "-"}</Text>
          <Text style={s.ln}><Text style={s.b}>Project:</Text> {q.project || "-"}</Text>
          <Text style={s.ln}><Text style={s.b}>Subject:</Text> {subject}</Text>

          <Text style={[s.p, { marginTop: 24 }]}>Dear Sir,</Text>
          <Text style={s.p}>{q.introParagraph || "-"}</Text>

          <View style={s.ar}>
            <Text style={s.al}>ANNEXURE – 1</Text>
            <Text style={s.av}>{q.annexure1Title}</Text>
          </View>
          <View style={s.ar}>
            <Text style={s.al}>ANNEXURE – 2</Text>
            <Text style={s.av}>{q.annexure2Title}</Text>
          </View>
          <View style={s.ar}>
            <Text style={s.al}>ANNEXURE – 3</Text>
            <Text style={s.av}>{q.annexure3Title}</Text>
          </View>

          <Text style={[s.p, { marginTop: 28 }]}>{q.closingParagraph}</Text>

          <View style={s.sb} wrap={false}>
            <Text>Truly yours,</Text>
            <Text>For Nexayra Arc General Contracting L.L.C</Text>
            <Image src={sig} style={s.si} />
            <Text>{q.signatoryName}</Text>
            <Text>{q.signatoryDesignation}</Text>
          </View>
        </View>

        {/* -------------------- ANNEXURE CONTENT --------------------
            Flows immediately after the cover. Continues on the cover's
            spillover page when the cover is long. */}
        <View style={[s.ct, { marginTop: 28 }]}>
          {/* ANNEXURE-1: Inclusions and Exclusions */}
          <Text style={s.cuh} minPresenceAhead={40}>ANNEXURE-1:</Text>
          <Text style={s.uh}>OUR PROPOSAL INCLUDES THE FOLLOWING:</Text>

          <View style={s.bw}>
            {q.inclusionItems.map((it, i) => (
              <View key={`inc-${i}`} style={s.br}>
                <Text style={s.bs}>•</Text>
                <Text style={s.bt}>{it}</Text>
              </View>
            ))}
          </View>

          {/* Only render exclusions block if there are exclusions to show */}
          {q.exclusionItems && q.exclusionItems.length > 0 && (
            <>
              <Text style={[s.uh, { marginTop: 12 }]} minPresenceAhead={30}>EXCLUSIONS:</Text>
              <View style={s.bw}>
                {q.exclusionItems.map((it, i) => (
                  <View key={`exc-${i}`} style={s.br}>
                    <Text style={s.bs}>•</Text>
                    <Text style={s.bt}>{it}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ANNEXURE-2: Schedule of Prices */}
          <Text style={[s.cuh, { marginTop: 16 }]} minPresenceAhead={55}>ANNEXURE-2:</Text>
          <Text style={s.uh}>SCHEDULE OF PRICES</Text>
          <Text style={s.p}>
            Our price for the execution of the above-mentioned scope of works is as follows:
          </Text>

          {/* BOQ table with totals glued to the last row */}
          <BoqTable q={q} />

          {/* ANNEXURE-3: Terms and Conditions */}
          <Text style={[s.cuh, { marginTop: 16 }]} minPresenceAhead={40}>ANNEXURE-3:</Text>
          <Text style={s.uh}>TERMS AND CONDITIONS</Text>

          <Text style={[s.uh, { marginTop: 20 }]} minPresenceAhead={30}>PAYMENT TERMS:</Text>
          <View style={s.bw}>
            {q.paymentTerms.map((t, i) => (
              <View key={`pt-${i}`} style={s.br}>
                <Text style={s.bs}>•</Text>
                <Text style={s.bt}>{t}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.uh, { marginTop: 20 }]} minPresenceAhead={20}>VALIDITY:</Text>
          <Text style={s.stl}>{q.validity}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  // -------- page --------
  page: {
    fontSize: 12,
    fontFamily: "Times-Roman",
    color: "#111827",
    backgroundColor: "#fff",
    position: "relative",
    paddingTop: SAFE_TOP,
    paddingBottom: SAFE_BOTTOM,
    paddingLeft: SAFE_SIDE,
    paddingRight: SAFE_SIDE,
  },
  bg: { position: "absolute", top: 0, left: 0, width: A4W, height: A4H, objectFit: "fill" },
  // Stamp wrapper is fixed + absolutely positioned bottom-right; the render
  // callback fills it with the image on page 1 only.
  ps: { position: "absolute", bottom: 74, right: 52, width: 92, height: 92 },
  psImg: { width: "100%", height: "100%", objectFit: "contain" },

  // -------- text --------
  ct: { flexDirection: "column" },
  ln: { marginBottom: 10, lineHeight: 1.35 },
  b:  { fontWeight: 700, fontFamily: "Times-Bold" },
  cn: { textAlign: "center" },
  rt: { textAlign: "right" },
  p:  { lineHeight: 1.35, marginBottom: 10, textAlign: "left" },

  // -------- annexure label rows --------
  ar: { flexDirection: "row", marginTop: 16 },
  al: { width: 130, fontSize: 14, fontWeight: 700, fontFamily: "Times-Bold" },
  av: { flex: 1, fontSize: 14, fontWeight: 700, fontFamily: "Times-Bold" },

  // -------- signature block --------
  sb: { marginTop: 28, lineHeight: 1.35 },
  si: { width: 90, height: 34, objectFit: "contain", marginTop: 8, marginBottom: 4 },

  // -------- centered underlined heading --------
  cuh: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "Times-Bold",
    textDecoration: "underline",
    textAlign: "center",
    marginBottom: 16,
  },
  uh: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "Times-Bold",
    textDecoration: "underline",
    marginBottom: 10,
  },

  // -------- bullets --------
  bw: { marginLeft: 18 },
  br: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  bs: { width: 12, fontSize: 13, lineHeight: 1.25 },
  bt: { flex: 1, fontSize: 12, lineHeight: 1.25 },

  // -------- BOQ table --------
  thr: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#d8e4f2",
    minHeight: 28,
  },
  tbr: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    minHeight: 34,
    alignItems: "stretch",
    marginTop: -1,
  },
  // Generic column cell — applies to all columns except the last.
  // Width comes from inline { width: COL_WIDTHS.X } applied at usage site.
  colCell: {
    borderRightWidth: 1,
    borderColor: "#111827",
    padding: 6,
    fontSize: 12,
    lineHeight: 1.2,
  },
  colCellLast: {
    padding: 6,
    fontSize: 12,
    lineHeight: 1.2,
  },

  // -------- totals rows --------
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#111827",
    minHeight: 26,
    alignItems: "center",
  },
  trFirst: { borderTopWidth: 1 },
  tlw: {
    width: "82%",
    padding: 6,
    fontSize: 12,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#111827",
    fontWeight: "bold",
  },
  tvn: {
    width: "18%",
    padding: 6,
    fontSize: 12,
    textAlign: "right",
    fontWeight: "bold",
  },

  // -------- words row --------
  wr: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    minHeight: 28,
    alignItems: "center",
  },
  wrl: { width: "22%", padding: 6, fontSize: 12, borderRightWidth: 1, borderColor: "#111827", fontWeight: "bold" },
  wrv: { width: "78%", padding: 6, fontSize: 12, fontWeight: "bold" },

  // -------- terms / validity --------
  stb: { marginTop: 4 },
  stl: { fontSize: 12, lineHeight: 1.3, marginBottom: 2 },

  // -------- footer link hotspots (invisible) --------
  fll: { position: "absolute", left: 20, bottom: 12, width: 555, height: 47 },
  ht:  { fontSize: 1, color: "#fff", opacity: 0 },
  pl:  { position: "absolute", left: 8, top: 18, width: 80, height: 12 },
  el:  { position: "absolute", left: 86, top: 18, width: 120, height: 12 },
  wl:  { position: "absolute", left: 248, top: 18, width: 135, height: 12 },
  il:  { position: "absolute", left: 385, top: 15, width: 85, height: 10 },
  ll:  { position: "absolute", left: 385, top: 27, width: 145, height: 10 },
});