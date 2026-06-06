"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import type { TaxInvoiceItem, TaxInvoiceData } from "./TaxInvoiceDocument";
import PreviewModal from "@/components/PreviewModal";
import { Eye } from "lucide-react";
import SuggestInput from "@/components/SuggestInput";
import ProjectCodeInput, { type ProjectLookup } from "@/components/ProjectCodeInput";

const DRAFT_KEY = "createTaxInvoiceV2";

// ============================================================================
// HELPERS
// ============================================================================

function formatToday(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, "0")}-${n.toLocaleString("en-US", { month: "long" })}-${n.getFullYear()}`;
}

// Convert a "DD-Month-YYYY" string to "YYYY-MM-DD" for the date input
function toDateInputValue(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

// Convert a "YYYY-MM-DD" date input value back to "DD-Month-YYYY"
function fromDateInputValue(s: string): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${d.toLocaleString("en-US", { month: "long" })}-${d.getFullYear()}`;
}

function convertNumberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];
  if (num === 0) return "Zero";
  const ch = (n: number) => {
    let r = "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    if (h > 0) r += `${ones[h]} Hundred`;
    if (rem >= 20) {
      if (r) r += " ";
      r += tens[Math.floor(rem / 10)];
      if (rem % 10 > 0) r += ` ${ones[rem % 10]}`;
    } else if (rem >= 10) {
      if (r) r += " ";
      r += teens[rem - 10];
    } else if (rem > 0) {
      if (r) r += " ";
      r += ones[rem];
    }
    return r;
  };
  const parts: string[] = [];
  let si = 0;
  let v = num;
  while (v > 0) {
    const c = v % 1000;
    if (c !== 0) parts.unshift(`${ch(c)}${si > 0 ? ` ${scales[si]}` : ""}`);
    v = Math.floor(v / 1000);
    si++;
  }
  return parts.join(" ").trim();
}

function amountToWords(a: number): string {
  const s = Number.isFinite(a) ? a : 0;
  const d = Math.floor(s);
  const f = Math.round((s - d) * 100);
  let r = `${convertNumberToWords(d)} Dirhams`;
  if (f > 0) r += ` and ${convertNumberToWords(f)} Fils`;
  return `${r} Only`;
}

const makeEmpty = (): TaxInvoiceItem => ({ description: "", qty: "1", uom: "Nos", unitPrice: "", discount: "0" });

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateTaxInvoice() {
  // Header
  const [invoiceNo, setInvoiceNo] = useState("(auto)");
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Client
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientTRN, setClientTRN] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Project linkage
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");

  const [poReference, setPoReference] = useState("");
  const [items, setItems] = useState<TaxInvoiceItem[]>([makeEmpty()]);

  // Bank
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [notes, setNotes] = useState("");

  // UI state
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ----- Load draft + set today's date -----
  useEffect(() => {
    setDate(formatToday());
    try {
      const s = localStorage.getItem(DRAFT_KEY);
      if (!s) return;
      const d = JSON.parse(s);
      setClientName(d.clientName ?? "");
      setClientAddress(d.clientAddress ?? "");
      setClientTRN(d.clientTRN ?? "");
      setClientPhone(d.clientPhone ?? "");
      setProjectId(d.projectId ?? "");
      setProjectName(d.projectName ?? "");
      setProjectCode(d.projectCode ?? "");
      setPoReference(d.poReference ?? "");
      setDueDate(d.dueDate ?? "");
      setBankName(d.bankName ?? "");
      setAccountName(d.accountName ?? "");
      setAccountNumber(d.accountNumber ?? "");
      setIban(d.iban ?? "");
      setSwiftCode(d.swiftCode ?? "");
      setNotes(d.notes ?? "");
      if (Array.isArray(d.items) && d.items.length > 0) setItems(d.items);
    } catch {}
  }, []);

  // ----- Save draft on every change -----
  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        clientName, clientAddress, clientTRN, clientPhone,
        projectId, projectName, projectCode, poReference,
        dueDate, items,
        bankName, accountName, accountNumber, iban, swiftCode, notes,
      }),
    );
  });

  // ----- Calculations -----
  const calcItem = (item: TaxInvoiceItem) => {
    const qty = Number(item.qty || 0);
    const up = Number(item.unitPrice || 0);
    const dp = Math.max(0, Number(item.discount || 0));
    const gross = qty * up;
    const disc = gross * (dp / 100);
    const taxable = gross - disc;
    const vat = taxable * 0.05;
    return { gross, disc, taxable, vat, total: taxable + vat };
  };

  const totals = useMemo(() => {
    return items.reduce(
      (a, i) => {
        const r = calcItem(i);
        a.subtotal += r.gross;
        a.totalDiscount += r.disc;
        a.taxableAmount += r.taxable;
        a.vatAmount += r.vat;
        a.total += r.total;
        return a;
      },
      { subtotal: 0, totalDiscount: 0, taxableAmount: 0, vatAmount: 0, total: 0 },
    );
  }, [items]);

  const updateItem = (i: number, f: keyof TaxInvoiceItem, v: string) =>
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));

  // ----- Validation + payload -----
  const validate = () => {
    if (!clientName.trim()) return "Enter client name.";
    if (!items.some(i => i.description.trim() && Number(i.qty) > 0)) return "Add at least one item.";
    return "";
  };

  const buildPayload = () => ({
    date: date.trim(),
    dueDate: dueDate.trim(),
    clientName: clientName.trim(),
    clientAddress: clientAddress.trim(),
    clientTRN: clientTRN.trim(),
    clientPhone: clientPhone.trim(),
    projectId,
    project: projectName.trim(),
    projectCode: projectCode.trim(),
    poReference: poReference.trim(),
    items,
    subtotal: +totals.subtotal.toFixed(2),
    totalDiscount: +totals.totalDiscount.toFixed(2),
    taxableAmount: +totals.taxableAmount.toFixed(2),
    vatAmount: +totals.vatAmount.toFixed(2),
    total: +totals.total.toFixed(2),
    amount: +totals.total.toFixed(2),
    bankName: bankName.trim(),
    accountName: accountName.trim(),
    accountNumber: accountNumber.trim(),
    iban: iban.trim(),
    swiftCode: swiftCode.trim(),
    notes: notes.trim(),
  });

  const reset = () => {
    localStorage.removeItem(DRAFT_KEY);
    setInvoiceNo("(auto)");
    setDate(formatToday());
    setDueDate("");
    setClientName(""); setClientAddress(""); setClientTRN(""); setClientPhone("");
    setProjectId(""); setProjectName(""); setProjectCode("");
    setPoReference("");
    setItems([makeEmpty()]);
    setBankName(""); setAccountName(""); setAccountNumber(""); setIban(""); setSwiftCode("");
    setNotes("");
  };

  // ----- PDF generation + actions -----
  const generatePdfBlob = async (data: TaxInvoiceData) => {
    const [{ pdf }, { default: Doc }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./TaxInvoiceDocument"),
    ]);
    return await pdf(<Doc data={data} />).toBlob();
  };

  const handlePreview = async () => {
    const err = validate();
    if (err) { setMessage({ text: err, type: "error" }); return; }
    try {
      setIsWorking(true);
      setMessage(null);
      const tempData: TaxInvoiceData = { ...buildPayload(), invoiceNo: "PREVIEW" } as any;
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
      const res = await apiCall<{ invoice: TaxInvoiceData }>("/api/tax-invoice", { method: "POST", body: buildPayload() });
      setInvoiceNo(res.invoice.invoiceNo);
      const blob = await generatePdfBlob(res.invoice);
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: `${res.invoice.invoiceNo}.pdf` }).click();
      URL.revokeObjectURL(url);
      setMessage({ text: `${res.invoice.invoiceNo} saved and downloaded.`, type: "success" });
      setPreviewUrl(null);
      reset();
    } catch (e: any) {
      setMessage({ text: e.message || "Failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsWorking(true);
      setMessage(null);
      const res = await apiCall<{ invoice: TaxInvoiceData }>("/api/tax-invoice", { method: "POST", body: buildPayload() });
      const blob = await generatePdfBlob(res.invoice);
      const pdfFile = new File([blob], `${res.invoice.invoiceNo}.pdf`, { type: "application/pdf" });
      const text = [`Invoice: ${res.invoice.invoiceNo}`, `Client: ${res.invoice.clientName}`, `Total: AED ${res.invoice.total.toFixed(2)}`].join("\n");

      if (navigator.share) {
        if (navigator.canShare?.({ files: [pdfFile] })) {
          await navigator.share({ title: res.invoice.invoiceNo, text, files: [pdfFile] });
        } else {
          await navigator.share({ title: res.invoice.invoiceNo, text });
        }
      } else {
        await navigator.clipboard.writeText(text);
      }

      setMessage({ text: `${res.invoice.invoiceNo} saved and shared.`, type: "success" });
      setPreviewUrl(null);
      reset();
    } catch (e: any) {
      setMessage({ text: e.message || "Failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  // ----- Styles -----
  const inp = "w-full px-4 py-3 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white placeholder-navy-300 text-sm transition-all duration-200 hover:border-navy-300";
  const lbl = "block text-navy-500 dark:text-navy-300 text-xs font-bold uppercase tracking-wider mb-1.5";
  const sec = "text-navy dark:text-white font-display text-lg font-bold mt-8 mb-4 pb-2 border-b border-navy-100 dark:border-navy-700";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      <PreviewModal
        pdfUrl={previewUrl}
        title={invoiceNo}
        onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
        onDownload={handleDownload}
        onShare={handleShare}
        isWorking={isWorking}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy dark:text-white">Tax Invoice</h1>
          <p className="mt-1 text-navy-400 text-sm">{invoiceNo} — {date}</p>
        </div>
      </div>

      {message && (
        <div className={`mb-5 p-3.5 rounded-xl text-sm font-medium animate-scale-in ${
          message.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 sm:p-8 shadow-sm hover-lift">

        {/* ----- PROJECT CODE — type code, autofill client info ----- */}
        <h3 className={`${sec} mt-0`}>Project</h3>
        <div className="relative z-30 mb-4">
          <ProjectCodeInput
            label="Project Code (optional)"
            value={projectCode}
            onChange={setProjectCode}
            onProjectFound={(p: ProjectLookup) => {
              setProjectId(p.id);
              setProjectName(p.name);
              setProjectCode(p.code);
              if (!clientName.trim() && p.client) setClientName(p.client);
              if (!clientAddress.trim() && p.clientAddress) setClientAddress(p.clientAddress);
              if (!clientPhone.trim() && p.clientPhone) setClientPhone(p.clientPhone);
              if (!clientTRN.trim() && p.clientTRN) setClientTRN(p.clientTRN);
            }}
            onProjectCleared={() => {
              setProjectId("");
              setProjectName("");
            }}
          />
        </div>

        {/* ----- CLIENT DETAILS ----- */}
        <h3 className={sec}>Client Details</h3>
        <div className="relative z-0 grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Client Name *</label>
            <SuggestInput
              field="clientName"
              value={clientName}
              onChange={setClientName}
              onPick={async (name) => {
                try {
                  const r = await apiCall<{ details: any }>(`/api/suggestions?lookup=client&name=${encodeURIComponent(name)}`);
                  if (r.details) {
                    if (r.details.clientAddress) setClientAddress(r.details.clientAddress);
                    if (r.details.clientPhone) setClientPhone(r.details.clientPhone);
                    if (r.details.clientTRN) setClientTRN(r.details.clientTRN);
                  }
                } catch {}
              }}
              placeholder="Client / Company"
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Client Address</label>
            <input
              value={clientAddress}
              onChange={e => setClientAddress(e.target.value)}
              className={inp}
              placeholder="Address"
            />
          </div>
          <div>
            <label className={lbl}>Client TRN</label>
            <input
              value={clientTRN}
              onChange={e => setClientTRN(e.target.value)}
              className={inp}
              placeholder="Tax Registration Number"
            />
          </div>
          <div>
            <label className={lbl}>Client Phone</label>
            <input
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>PO Reference</label>
            <input
              value={poReference}
              onChange={e => setPoReference(e.target.value)}
              className={inp}
              placeholder="Purchase order ref (optional)"
            />
          </div>
          <div>
            <label className={lbl}>Due Date</label>
            <input
              type="date"
              value={toDateInputValue(dueDate)}
              onChange={e => setDueDate(fromDateInputValue(e.target.value))}
              className={inp}
            />
            {dueDate && (
              <p className="text-xs text-navy-400 mt-1.5">Saves as: {dueDate}</p>
            )}
          </div>
        </div>

        {/* ----- INVOICE ITEMS ----- */}
        <h3 className={sec}>Invoice Items</h3>
        <div className="hidden md:grid grid-cols-[1fr_4rem_5rem_7rem_4rem] gap-2 mb-2 text-navy-400 text-xs font-bold uppercase tracking-wider px-1">
          <div>Description</div>
          <div>Qty</div>
          <div>Unit</div>
          <div>Unit Price</div>
          <div />
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_4rem_5rem_7rem_4rem] gap-2 mb-3 items-start animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <input placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className={inp} />
            <input type="number" min="0" placeholder="Qty" value={item.qty} onChange={e => updateItem(i, "qty", e.target.value)} className={inp} />
            <input placeholder="UOM" value={item.uom} onChange={e => updateItem(i, "uom", e.target.value)} className={inp} />
            <input type="number" min="0" step="0.01" placeholder="Price" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)} className={inp} />
            <button onClick={() => setItems(p => p.length === 1 ? p : p.filter((_, j) => j !== i))} disabled={items.length === 1} className="w-full md:w-16 h-[42px] bg-red-50 hover:bg-red-100 text-red-500 font-semibold rounded-xl text-xs disabled:opacity-30 border border-red-200 btn-press">
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => setItems(p => [...p, makeEmpty()])} className="mt-2 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white text-sm font-semibold hover:bg-navy-100 btn-press">
          + Add Item
        </button>

        {/* ----- BANK DETAILS ----- */}
        <h3 className={sec}>Bank Details (Optional)</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Bank Name</label><input value={bankName} onChange={e => setBankName(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Account Name</label><input value={accountName} onChange={e => setAccountName(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Account Number</label><input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>IBAN</label><input value={iban} onChange={e => setIban(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>SWIFT Code</label><input value={swiftCode} onChange={e => setSwiftCode(e.target.value)} className={inp} /></div>
        </div>

        {/* ----- NOTES ----- */}
        <h3 className={sec}>Notes (Optional)</h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className={`${inp} min-h-[80px] resize-y`}
          placeholder="Additional notes or terms"
        />

        {/* ----- TOTALS ----- */}
        <div className="mt-8 p-5 rounded-xl bg-navy-50 dark:bg-navy-800 border border-navy-100 dark:border-navy-700">
          <div className="flex justify-between text-navy-500 dark:text-navy-300 text-sm mb-2"><span>Subtotal:</span><strong className="text-navy dark:text-white">AED {totals.subtotal.toFixed(2)}</strong></div>
          <div className="flex justify-between text-navy-500 dark:text-navy-300 text-sm mb-3"><span>VAT (5%):</span><strong className="text-navy dark:text-white">AED {totals.vatAmount.toFixed(2)}</strong></div>
          <div className="flex justify-between text-navy dark:text-white text-xl font-bold pt-3 border-t border-navy-200 dark:border-navy-600"><span>Total:</span><span className="text-gold">AED {totals.total.toFixed(2)}</span></div>
          <p className="mt-2 text-navy-400 text-xs">{amountToWords(totals.total)}</p>
        </div>

        {/* ----- PREVIEW BUTTON ----- */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handlePreview}
            disabled={isWorking}
            className="flex items-center gap-2 px-6 py-3 bg-navy hover:bg-navy-700 text-white dark:bg-gold-400 dark:text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-all shadow-lg shadow-navy/20 hover:-translate-y-0.5 btn-press"
          >
            <Eye size={18} />{isWorking ? "Working…" : "Preview & Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}