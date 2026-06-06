"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiCall } from "@/lib/api-client";
import type { QuotationData, QuotationItem } from "./QuotationDocument";
import PreviewModal from "@/components/PreviewModal";
import { Eye } from "lucide-react";
import ProjectCodeInput, { type ProjectLookup } from "@/components/ProjectCodeInput";

// ============================================================================
// CONSTANTS
// ============================================================================

const DRAFT_KEY = "createQuotationDraftV6"; // bumped because schema added projectId/projectCode

const DEFAULT_INTRO_PREFIX  = "Pertaining to the above-mentioned project / subject and further to your enquiry we hereby gladly submit our commercial proposal for ";
const DEFAULT_INTRO_SUFFIX  = " in accordance with the annexures given below:";
const DEFAULT_ANNEXURE_1    = "Scope of work, Inclusions and Exclusions";
const DEFAULT_ANNEXURE_2    = "Bill of Quantity";
const DEFAULT_ANNEXURE_3    = "Terms & Conditions";
const DEFAULT_CLOSING       = "We hope that our proposal is in line with your requirements. In case of any required additional information or clarification, you can contact the undersigned.";
const DEFAULT_SIGNATORY_NAME        = "Ashish Dhir";
const DEFAULT_SIGNATORY_DESIGNATION = "Operation Manager";

const DEFAULT_EXCLUSIONS: string[] = [];

const DEFAULT_PAYMENT_TERMS = [
  "Payments in UAE Dirham to be paid in UAE as follows;",
  " 25% advance payment",
  " The balance will be made against progress of works.",
  " Our price doesn't include any item which is not mentioned in this proposal.",
];

// ============================================================================
// HELPERS
// ============================================================================

function formatToday(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, "0")}-${n.toLocaleString("en-US", { month: "long" })}-${n.getFullYear()}`;
}

function toNumber(v: string): number {
  const cleaned = String(v).replace(/,/g, "").replace(/\/-/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtMoney(v: number): string {
  return `${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/-`;
}

function convertNumberToWords(num: number): string {
  const ones   = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens  = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens   = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];

  if (num === 0) return "Zero";

  const chunkToWords = (n: number) => {
    let result = "";
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    if (hundred > 0) result += `${ones[hundred]} Hundred`;
    if (remainder >= 20) {
      if (result) result += " ";
      result += tens[Math.floor(remainder / 10)];
      if (remainder % 10 > 0) result += ` ${ones[remainder % 10]}`;
    } else if (remainder >= 10) {
      if (result) result += " ";
      result += teens[remainder - 10];
    } else if (remainder > 0) {
      if (result) result += " ";
      result += ones[remainder];
    }
    return result;
  };

  const parts: string[] = [];
  let scaleIndex = 0;
  let value = num;
  while (value > 0) {
    const chunk = value % 1000;
    if (chunk !== 0) {
      parts.unshift(`${chunkToWords(chunk)}${scaleIndex > 0 ? ` ${scales[scaleIndex]}` : ""}`);
    }
    value = Math.floor(value / 1000);
    scaleIndex++;
  }
  return parts.join(" ").trim();
}

function amountToWords(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const dirhams = Math.floor(safeAmount);
  const fils = Math.round((safeAmount - dirhams) * 100);
  let result = `${convertNumberToWords(dirhams)} Dirhams`;
  if (fils > 0) result += ` and ${convertNumberToWords(fils)} Fils`;
  return `${result} Only`;
}

function computeAmount(qty: string, unitRate: string): string {
  const q = toNumber(qty);
  const r = toNumber(unitRate);
  const amt = q * r;
  if (!Number.isFinite(amt) || amt === 0) return "";
  return amt.toFixed(2);
}

function makeEmptyBoqRow(srNo: number): QuotationItem {
  return {
    srNo: String(srNo),
    description: "",
    unit: "Nos",
    qty: "",
    unitRate: "",
    amount: "",
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateQuotation() {
  // -------- header fields --------
  const [quotationNo, setQuotationNo] = useState("(auto)");
  const [date, setDate] = useState("");
  const [to, setTo] = useState("");
  const [attn, setAttn] = useState("");
  const [project, setProject] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");

  // -------- annexure-1 lists --------
  const [inclusionItems, setInclusionItems] = useState<string[]>([""]);
  const [exclusionItems, setExclusionItems] = useState<string[]>(DEFAULT_EXCLUSIONS);

  // -------- annexure-2 BOQ --------
  const [items, setItems] = useState<QuotationItem[]>([makeEmptyBoqRow(1)]);

  // -------- annexure-3 --------
  const [paymentTerms, setPaymentTerms]   = useState<string[]>(DEFAULT_PAYMENT_TERMS);
  const [validityMode, setValidityMode]   = useState("30");
  const [customValidityDays, setCustomValidityDays] = useState("");

  // -------- attachments + UI --------
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // DRAFT PERSISTENCE
  // ------------------------------------------------------------------

  useEffect(() => {
    setDate(formatToday());
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (!stored) return;
      const draft = JSON.parse(stored);
      setTo(draft.to ?? "");
      setAttn(draft.attn ?? "");
      setProject(draft.project ?? "");
      setProjectId(draft.projectId ?? "");
      setProjectCode(draft.projectCode ?? "");
      setServiceTitle(draft.serviceTitle ?? "");
      if (Array.isArray(draft.inclusionItems) && draft.inclusionItems.length > 0) setInclusionItems(draft.inclusionItems);
      if (Array.isArray(draft.exclusionItems)) setExclusionItems(draft.exclusionItems);
      if (Array.isArray(draft.items) && draft.items.length > 0) {
        const migrated = draft.items.map((it: any, i: number): QuotationItem => ({
          srNo:        String(it.srNo ?? i + 1),
          description: String(it.description ?? ""),
          unit:        String(it.unit ?? "Nos"),
          qty:         String(it.qty ?? ""),
          unitRate:    String(it.unitRate ?? ""),
          amount:      String(it.amount ?? ""),
        }));
        setItems(migrated);
      }
      setValidityMode(draft.validityMode ?? "30");
      setCustomValidityDays(draft.customValidityDays ?? "");
      if (Array.isArray(draft.paymentTerms) && draft.paymentTerms.length > 0) setPaymentTerms(draft.paymentTerms);
    } catch {
      /* corrupted draft, ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        to, attn, project, projectId, projectCode, serviceTitle,
        inclusionItems, exclusionItems, items,
        validityMode, customValidityDays, paymentTerms,
      }),
    );
  });

  // ------------------------------------------------------------------
  // DERIVED VALUES
  // ------------------------------------------------------------------

  const totals = useMemo(() => {
    const total = items.reduce((sum, it) => sum + toNumber(it.amount || "0"), 0);
    const vat = total * 0.05;
    return {
      totalWithoutVat: total,
      vatPercent: 5,
      vatAmount: vat,
      totalWithVat: total + vat,
    };
  }, [items]);

  const autoWords = useMemo(() => amountToWords(totals.totalWithVat), [totals.totalWithVat]);

  const resolvedDays = validityMode === "custom" ? (customValidityDays.trim() || "30") : validityMode;
  const validityText = `${resolvedDays} Days from the date of this offer subject to written confirmation thereafter.`;
  const introParagraph = `${DEFAULT_INTRO_PREFIX}${serviceTitle || "________________"}${DEFAULT_INTRO_SUFFIX}`;

  // ------------------------------------------------------------------
  // BOQ ROW HANDLERS
  // ------------------------------------------------------------------

  const updateItem = (rowIndex: number, field: keyof QuotationItem, value: string) => {
    setItems(prev => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const updated = { ...row, [field]: value };
      if (field === "qty" || field === "unitRate") {
        updated.amount = computeAmount(updated.qty, updated.unitRate);
      }
      return updated;
    }));
  };

  const addRow = () => setItems(prev => [...prev, makeEmptyBoqRow(prev.length + 1)]);

  const removeRow = (rowIndex: number) => setItems(prev => {
    if (prev.length === 1) return prev;
    return prev
      .filter((_, i) => i !== rowIndex)
      .map((row, i) => ({ ...row, srNo: String(i + 1) }));
  });

  // ------------------------------------------------------------------
  // INCLUSION / EXCLUSION / PAYMENT TERM HANDLERS
  // ------------------------------------------------------------------

  const updateInclusion = (i: number, v: string) =>
    setInclusionItems(prev => prev.map((x, j) => j === i ? v : x));
  const addInclusion = () => setInclusionItems(prev => [...prev, ""]);
  const removeInclusion = (i: number) =>
    setInclusionItems(prev => prev.length === 1 ? prev : prev.filter((_, j) => j !== i));

  const updateExclusion = (i: number, v: string) =>
    setExclusionItems(prev => prev.map((x, j) => j === i ? v : x));
  const addExclusion = () => setExclusionItems(prev => [...prev, ""]);
  const removeExclusion = (i: number) =>
    setExclusionItems(prev => prev.filter((_, j) => j !== i));

  const updatePaymentTerm = (i: number, v: string) =>
    setPaymentTerms(prev => prev.map((x, j) => j === i ? v : x));
  const addPaymentTerm = () => setPaymentTerms(prev => [...prev, ""]);
  const removePaymentTerm = (i: number) =>
    setPaymentTerms(prev => prev.length === 1 ? prev : prev.filter((_, j) => j !== i));

  // ------------------------------------------------------------------
  // VALIDATION + PAYLOAD
  // ------------------------------------------------------------------

  const validate = () => {
    if (!serviceTitle.trim()) return "Please enter the service title.";
    if (!items.some(i => i.description.trim() || i.amount.trim())) return "Please enter at least one BOQ row.";
    if (!inclusionItems.some(i => i.trim())) return "Please enter at least one inclusion.";
    if (!paymentTerms.some(i => i.trim())) return "Please enter at least one payment term.";
    return "";
  };

  const buildPayload = (): Omit<QuotationData, "quotationNo"> => ({
    date: date.trim(),
    to: to.trim(),
    attn: attn.trim(),
    project: project.trim(),
    projectId,
    projectCode: projectCode.trim(),
    serviceTitle: serviceTitle.trim(),
    introParagraph,
    annexure1Title: DEFAULT_ANNEXURE_1,
    annexure2Title: DEFAULT_ANNEXURE_2,
    annexure3Title: DEFAULT_ANNEXURE_3,
    closingParagraph: DEFAULT_CLOSING,
    signatoryName: DEFAULT_SIGNATORY_NAME,
    signatoryDesignation: DEFAULT_SIGNATORY_DESIGNATION,
    inclusionItems: inclusionItems.filter(i => i.trim()),
    exclusionItems: exclusionItems.filter(i => i.trim()),
    boqItems: items,
    totalWithoutVat: +totals.totalWithoutVat.toFixed(2),
    vatPercent: totals.vatPercent,
    vatAmount: +totals.vatAmount.toFixed(2),
    totalWithVat: +totals.totalWithVat.toFixed(2),
    amountInWords: autoWords,
    paymentTerms: paymentTerms.filter(i => i.trim()),
    validity: validityText,
    attachmentNames: attachments.map(f => f.name),
  });

  const reset = () => {
    localStorage.removeItem(DRAFT_KEY);
    setQuotationNo("(auto)");
    setDate(formatToday());
    setTo(""); setAttn(""); setProject(""); setProjectId(""); setProjectCode(""); setServiceTitle("");
    setInclusionItems([""]);
    setExclusionItems(DEFAULT_EXCLUSIONS);
    setItems([makeEmptyBoqRow(1)]);
    setValidityMode("30");
    setCustomValidityDays("");
    setPaymentTerms(DEFAULT_PAYMENT_TERMS);
    setAttachments([]);
  };

  // ------------------------------------------------------------------
  // PDF generation
  // ------------------------------------------------------------------

  const generatePdfBlob = async (data: QuotationData) => {
    const [{ pdf }, { default: QDoc }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./QuotationDocument"),
    ]);
    return await pdf(<QDoc quotationData={data} />).toBlob();
  };

  const handlePreview = async () => {
    const err = validate();
    if (err) { setMessage({ text: err, type: "error" }); return; }

    try {
      setIsWorking(true);
      setMessage(null);
      const payload = buildPayload();
      const tempData: QuotationData = { ...payload, quotationNo: "PREVIEW" } as QuotationData;
      const blob = await generatePdfBlob(tempData);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setMessage({ text: e.message || "Failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsWorking(true);
      setMessage(null);
      const res = await apiCall<{ quotation: QuotationData }>("/api/quotation", { method: "POST", body: buildPayload() });
      setQuotationNo(res.quotation.quotationNo);
      const blob = await generatePdfBlob(res.quotation);
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: `${res.quotation.quotationNo}.pdf` }).click();
      URL.revokeObjectURL(url);
      setMessage({ text: `${res.quotation.quotationNo} saved and downloaded.`, type: "success" });
      setPreviewUrl(null);
      reset();
    } catch (e: any) {
      setMessage({ text: e.message || "Download failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsWorking(true);
      setMessage(null);
      const res = await apiCall<{ quotation: QuotationData }>("/api/quotation", { method: "POST", body: buildPayload() });
      setQuotationNo(res.quotation.quotationNo);
      const blob = await generatePdfBlob(res.quotation);
      const pdfFile = new File([blob], `${res.quotation.quotationNo}.pdf`, { type: "application/pdf" });
      const text = [
        `Quotation: ${res.quotation.quotationNo}`,
        `Total: AED ${res.quotation.totalWithVat.toFixed(2)}`,
      ].join("\n");

      if (navigator.share) {
        const files = [pdfFile, ...attachments];
        if (navigator.canShare?.({ files })) {
          await navigator.share({ title: res.quotation.quotationNo, text, files });
        } else {
          await navigator.share({ title: res.quotation.quotationNo, text });
        }
      } else {
        await navigator.clipboard.writeText(text);
      }

      setMessage({ text: `${res.quotation.quotationNo} saved and shared.`, type: "success" });
      setPreviewUrl(null);
      reset();
    } catch (e: any) {
      setMessage({ text: e.message || "Share failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  // ------------------------------------------------------------------
  // STYLE OBJECTS
  // ------------------------------------------------------------------

  const paper: CSSProperties = {
    background: "rgb(var(--c-surface))",
    border: "1px solid rgb(var(--c-border))",
    borderRadius: "10px",
    padding: "24px 26px",
    marginBottom: "18px",
    boxShadow: "0 8px 22px rgba(0,0,0,0.06)",
    fontFamily: "'Times New Roman',Georgia,serif",
    color: "rgb(var(--c-fg))",
  };
  const ulH: CSSProperties = { fontSize: "16px", fontWeight: 700, textDecoration: "underline", marginBottom: "10px" };
  const ulHC: CSSProperties = { ...ulH, textAlign: "center", fontSize: "18px", marginBottom: "16px" };
  const bodyP: CSSProperties = { fontSize: "16px", lineHeight: 1.4, margin: "10px 0" };

  const inputBase: CSSProperties = {
    width: "100%",
    border: "none",
    outline: "none",
    padding: "8px 6px",
    fontSize: "15px",
    fontFamily: "'Times New Roman',Georgia,serif",
    background: "#fff",
    color: "#111827",
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="max-w-[1160px] mx-auto animate-fade-in-up">
      <PreviewModal
        pdfUrl={previewUrl}
        title={quotationNo}
        onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
        onDownload={handleDownload}
        onShare={handleShare}
        isWorking={isWorking}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display text-3xl font-bold text-navy m-0">Quotation Draft</h2>
          <p className="mt-2 text-navy-400 text-sm max-w-[840px]">
            Quotation number assigned automatically. Preview before generating.
          </p>
        </div>
        
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium animate-scale-in ${
          message.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* ====================================================================
          PAGE 1 — Cover letter
          ==================================================================== */}
      <div style={paper} className="hover-lift">
        <div style={{ fontSize: "26px", fontWeight: 700, color: "rgb(var(--c-fg))", lineHeight: 1 }}>
          NEXAYRA ARC
        </div>
        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "22px" }}>
          GENERAL CONTRACTING LLC
        </div>

        <div className="grid gap-2.5">
          <RowLabelInput label="Quotation No:" value={quotationNo} readOnly />
          <RowLabelInput label="Date:" value={date} readOnly />

          {/* Project code with autofill — sits above the rest so dropdown floats over */}
          <div style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: "12px", alignItems: "start", position: "relative", zIndex: 30 }}>
            <div style={{ fontSize: "16px", lineHeight: 1.4, paddingTop: "8px" }}>Code:</div>
            <div style={{ width: "100%" }}>
              <ProjectCodeInput
                label=""
                value={projectCode}
                onChange={setProjectCode}
                onProjectFound={(p: ProjectLookup) => {
                  setProjectId(p.id);
                  setProjectCode(p.code);
                  // Autofill blanks only — preserve user input
                  if (!to.trim() && p.client) setTo(p.client);
                  if (!project.trim() && p.name) setProject(p.name);
                  if (!attn.trim() && p.projectManager) setAttn(p.projectManager);
                }}
                onProjectCleared={() => {
                  setProjectId("");
                }}
              />
            </div>
          </div>

          <RowLabelInput label="To:" value={to} onChange={setTo} />
          <RowLabelInput label="Attn:" value={attn} onChange={setAttn} />
          <RowLabelInput label="Project:" value={project} onChange={setProject} multiline />
          <RowSubjectInput label="Subject:" prefix="Quotation & Proposal for " value={serviceTitle} onChange={setServiceTitle} />
        </div>

        <p style={bodyP}>Dear Sir,</p>
        <p style={bodyP}>{introParagraph}</p>

        <div style={{ display: "grid", gridTemplateColumns: "165px 1fr", gap: "8px", marginTop: "18px", fontSize: "18px" }}>
          <span>ANNEXURE – 1</span><span>{DEFAULT_ANNEXURE_1}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "165px 1fr", gap: "8px", marginTop: "18px", fontSize: "18px" }}>
          <span>ANNEXURE – 2</span><span>{DEFAULT_ANNEXURE_2}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "165px 1fr", gap: "8px", marginTop: "18px", fontSize: "18px" }}>
          <span>ANNEXURE – 3</span><span>{DEFAULT_ANNEXURE_3}</span>
        </div>

        <p style={{ ...bodyP, marginTop: 24 }}>{DEFAULT_CLOSING}</p>

        <div style={{ marginTop: "34px" }}>
          <p style={bodyP}>Truly yours,</p>
          <p style={bodyP}>For Nexayra Arc General Contracting L.L.C</p>
          <div style={{ width: "120px", height: "36px", border: "1px dashed #94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#64748b", margin: "10px 0 6px" }}>
            signature
          </div>
          <p style={bodyP}>{DEFAULT_SIGNATORY_NAME}</p>
          <p style={bodyP}>{DEFAULT_SIGNATORY_DESIGNATION}</p>
        </div>
      </div>

      {/* ====================================================================
          PAGE 2 — Annexure 1 (Inclusions / Exclusions) + BOQ
          ==================================================================== */}
      <div style={paper} className="hover-lift">
        <div style={ulHC}>ANNEXURE-1:</div>
        <div style={ulH}>OUR PROPOSAL INCLUDES THE FOLLOWING:</div>

        <div className="grid gap-2.5">
          {inclusionItems.map((item, i) => (
            <div key={i} className="flex gap-2.5 items-start animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <textarea
                value={item}
                onChange={e => updateInclusion(i, e.target.value)}
                style={{ flex: 1, minHeight: "76px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", fontFamily: "'Times New Roman',Georgia,serif", resize: "vertical", boxSizing: "border-box", background: "#fff", color: "#111827" }}
              />
              <button
                onClick={() => removeInclusion(i)}
                disabled={inclusionItems.length === 1}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50 btn-press"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <button
            onClick={addInclusion}
            style={{ background: "#fff", color: "#1c2143", border: "1px solid #1c2143" }}
            className="px-4 py-2 rounded-lg font-semibold text-sm btn-press"
          >
            Add Inclusion
          </button>
        </div>

        <div style={ulH}>EXCLUSIONS:</div>
        {exclusionItems.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#64748b", fontStyle: "italic", marginBottom: 10 }}>
            No exclusions added. Click below to add one.
          </p>
        ) : (
          <div className="grid gap-2.5">
            {exclusionItems.map((item, i) => (
              <div key={i} className="flex gap-2.5 items-start animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <textarea
                  value={item}
                  onChange={e => updateExclusion(i, e.target.value)}
                  style={{ flex: 1, minHeight: "76px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", fontFamily: "'Times New Roman',Georgia,serif", resize: "vertical", boxSizing: "border-box", background: "#fff", color: "#111827" }}
                />
                <button
                  onClick={() => removeExclusion(i)}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 btn-press"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <button
            onClick={addExclusion}
            style={{ background: "#fff", color: "#1c2143", border: "1px solid #1c2143" }}
            className="px-4 py-2 rounded-lg font-semibold text-sm btn-press"
          >
            Add Exclusion
          </button>
        </div>

        {/* ----- BOQ TABLE ----- */}
        <div style={ulHC}>ANNEXURE-2:</div>
        <div style={ulH}>SCHEDULE OF PRICES</div>
        <p style={bodyP}>Our price for the execution of the above-mentioned scope of works is as follows:</p>

        <div style={{ border: "1px solid #111827", marginTop: "10px" }}>
          <div style={{ display: "flex", background: "#d8e4f2", borderBottom: "1px solid #111827" }}>
            <div style={{ width: "8%",  padding: "8px 6px", fontSize: "14px", fontWeight: 700, textAlign: "center", borderRight: "1px solid #111827" }}>Sr. no.</div>
            <div style={{ width: "44%", padding: "8px 6px", fontSize: "14px", fontWeight: 700, textAlign: "center", borderRight: "1px solid #111827" }}>Description</div>
            <div style={{ width: "10%", padding: "8px 6px", fontSize: "14px", fontWeight: 700, textAlign: "center", borderRight: "1px solid #111827" }}>Unit</div>
            <div style={{ width: "10%", padding: "8px 6px", fontSize: "14px", fontWeight: 700, textAlign: "center", borderRight: "1px solid #111827" }}>Qty</div>
            <div style={{ width: "13%", padding: "8px 6px", fontSize: "14px", fontWeight: 700, textAlign: "center", borderRight: "1px solid #111827" }}>Unit Rate</div>
            <div style={{ width: "15%", padding: "8px 6px", fontSize: "14px", fontWeight: 700, textAlign: "center" }}>Amount (AED)</div>
          </div>

          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", borderBottom: "1px solid #111827", minHeight: "58px" }}>
              <div style={{ width: "8%",  borderRight: "1px solid #111827", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#111827" }}>
                {item.srNo}
              </div>
              <div style={{ width: "44%", borderRight: "1px solid #111827", display: "flex", alignItems: "stretch" }}>
                <textarea
                  value={item.description}
                  onChange={e => updateItem(i, "description", e.target.value)}
                  style={{ ...inputBase, minHeight: "56px", resize: "vertical", lineHeight: 1.25 }}
                />
              </div>
              <div style={{ width: "10%", borderRight: "1px solid #111827", display: "flex", alignItems: "stretch" }}>
                <input
                  value={item.unit}
                  onChange={e => updateItem(i, "unit", e.target.value)}
                  placeholder="Nos"
                  style={inputBase}
                />
              </div>
              <div style={{ width: "10%", borderRight: "1px solid #111827", display: "flex", alignItems: "stretch" }}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={item.qty}
                  onChange={e => updateItem(i, "qty", e.target.value)}
                  placeholder="0"
                  style={inputBase}
                />
              </div>
              <div style={{ width: "13%", borderRight: "1px solid #111827", display: "flex", alignItems: "stretch" }}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={item.unitRate}
                  onChange={e => updateItem(i, "unitRate", e.target.value)}
                  placeholder="0.00"
                  style={inputBase}
                />
              </div>
              <div style={{ width: "15%", display: "flex", alignItems: "stretch" }}>
                <input
                  value={item.amount}
                  readOnly
                  placeholder="auto"
                  title="Calculated automatically as Qty × Unit Rate"
                  style={{ ...inputBase, background: "#f8fafc", color: "#475569", textAlign: "right", fontWeight: 600 }}
                />
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: "10px", padding: "10px 8px", borderTop: "1px solid #111827" }}>
            <button
              onClick={addRow}
              style={{ background: "#fff", color: "#1c2143", border: "1px solid #1c2143" }}
              className="px-4 py-2 rounded-lg font-semibold text-sm btn-press"
            >
              Add BOQ Row
            </button>
            <button
              onClick={() => removeRow(items.length - 1)}
              disabled={items.length === 1}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50 btn-press"
            >
              Remove Last
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          PAGE 3 — Totals + Payment Terms + Validity + Attachments
          ==================================================================== */}
      <div style={paper} className="hover-lift">
        <div style={{ border: "1px solid #111827" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #111827" }}>
            <div style={{ width: "82%", padding: "6px 8px", textAlign: "center", fontSize: "16px", borderRight: "1px solid #111827" }}>Total Amount without Vat (AED)</div>
            <div style={{ width: "18%", padding: "6px 8px", textAlign: "right",  fontSize: "16px" }}>{fmtMoney(totals.totalWithoutVat)}</div>
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #111827" }}>
            <div style={{ width: "82%", padding: "6px 8px", textAlign: "center", fontSize: "16px", borderRight: "1px solid #111827" }}>Vat@5%</div>
            <div style={{ width: "18%", padding: "6px 8px", textAlign: "right",  fontSize: "16px" }}>{fmtMoney(totals.vatAmount)}</div>
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #111827" }}>
            <div style={{ width: "82%", padding: "6px 8px", textAlign: "center", fontSize: "16px", borderRight: "1px solid #111827" }}>Total Amount with Vat</div>
            <div style={{ width: "18%", padding: "6px 8px", textAlign: "right",  fontSize: "16px" }}>{fmtMoney(totals.totalWithVat)}</div>
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ width: "22%", padding: "6px 8px", fontSize: "16px", fontWeight: 700, borderRight: "1px solid #111827" }}>In Words (AED):</div>
            <div style={{ width: "78%", padding: "6px 8px", fontSize: "16px", fontWeight: 700 }}>{autoWords}</div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={ulH}>PAYMENT TERMS:</div>
          <div className="grid gap-2.5">
            {paymentTerms.map((item, i) => (
              <div key={i} className="flex gap-2.5 items-start animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <textarea
                  value={item}
                  onChange={e => updatePaymentTerm(i, e.target.value)}
                  style={{ flex: 1, minHeight: "76px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", fontFamily: "'Times New Roman',Georgia,serif", resize: "vertical", boxSizing: "border-box", background: "#fff", color: "#111827" }}
                />
                <button
                  onClick={() => removePaymentTerm(i)}
                  disabled={paymentTerms.length === 1}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50 btn-press"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, marginBottom: 14 }}>
            <button
              onClick={addPaymentTerm}
              style={{ background: "#fff", color: "#1c2143", border: "1px solid #1c2143" }}
              className="px-4 py-2 rounded-lg font-semibold text-sm btn-press"
            >
              Add Payment Term
            </button>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={ulH}>VALIDITY:</div>
          <div className="flex gap-2.5 items-center mb-2.5">
            <select
              value={validityMode}
              onChange={e => setValidityMode(e.target.value)}
              style={{ minHeight: "40px", minWidth: "180px", padding: "8px 10px", fontSize: "15px", fontFamily: "'Times New Roman',Georgia,serif", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#111827" }}
            >
              <option value="15">15 Days</option>
              <option value="30">30 Days</option>
              <option value="45">45 Days</option>
              <option value="60">60 Days</option>
              <option value="90">90 Days</option>
              <option value="custom">Custom</option>
            </select>
            {validityMode === "custom" && (
              <input
                placeholder="Custom days"
                value={customValidityDays}
                onChange={e => setCustomValidityDays(e.target.value)}
                style={{ minHeight: "40px", width: "140px", padding: "8px 10px", fontSize: "15px", fontFamily: "'Times New Roman',Georgia,serif", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#111827" }}
              />
            )}
          </div>
          <div style={{ fontSize: "16px", lineHeight: 1.4 }}>{validityText}</div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={ulH}>ATTACHMENTS:</div>
          <input
            type="file"
            multiple
            onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]); }}
            style={{ color: "#111827", fontFamily: "'Times New Roman',serif" }}
          />
          {attachments.length > 0 && (
            <div className="grid gap-2 mt-3">
              {attachments.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex justify-between items-center gap-3 p-2.5 rounded-lg bg-navy-50 border border-navy-100 animate-scale-in">
                  <span>{f.name}</span>
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold btn-press"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
       {/* ----- PREVIEW BUTTON ----- */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handlePreview}
            disabled={isWorking}
            style={{ fontFamily: "Lato, sans-serif" }}
            className="flex items-center gap-2 px-6 py-3 bg-navy hover:bg-navy-700 text-white dark:bg-gold-400 dark:text-white font-display font-bold rounded-xl text-sm disabled:opacity-50 transition-all shadow-lg shadow-navy/20 hover:shadow-xl hover:-translate-y-0.5 btn-press"
          >
            <Eye size={18} /> {isWorking ? "Working…" : "Preview & Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS — RowLabelInput / RowSubjectInput
// ============================================================================

function RowLabelInput({
  label,
  value,
  onChange,
  readOnly = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  multiline?: boolean;
}) {
  const base: CSSProperties = {
    width: "100%",
    minHeight: multiline ? "62px" : "38px",
    padding: "8px 10px",
    fontSize: "16px",
    fontFamily: "'Times New Roman',Georgia,serif",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    boxSizing: "border-box" as any,
    resize: multiline ? "vertical" : "none" as any,
    background: "#fff",
    color: "#111827",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: "12px", alignItems: "start" }}>
      <div style={{ fontSize: "16px", lineHeight: 1.4, paddingTop: "8px" }}>{label}</div>
      <div style={{ width: "100%" }}>
        {multiline
          ? <textarea value={value} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} style={base} />
          : <input    value={value} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} style={base} />
        }
      </div>
    </div>
  );
}

function RowSubjectInput({
  label,
  prefix,
  value,
  onChange,
}: {
  label: string;
  prefix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: "12px", alignItems: "start" }}>
      <div style={{ fontSize: "16px", lineHeight: 1.4, paddingTop: "8px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: "16px", whiteSpace: "nowrap" }}>{prefix}</span>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, minHeight: "38px", padding: "8px 10px", fontSize: "16px", fontFamily: "'Times New Roman',Georgia,serif", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#111827" }}
        />
      </div>
    </div>
  );
}