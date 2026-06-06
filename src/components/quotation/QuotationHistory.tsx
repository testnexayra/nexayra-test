"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import type { QuotationData, QuotationItem } from "./QuotationDocument";
import {
  Download, Pencil, Save, X, History as HistoryIcon,
  FolderPlus, Share2, Trash2, Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { quotationToProjectPayload } from "@/lib/quotation-converters";

type QDoc = QuotationData & { _docId: string; revisionOf?: string; revisionNumber?: number; createdAt?: string };

// ============================================================================
// HELPERS
// ============================================================================

function toNumber(v: string): number {
  const cleaned = String(v).replace(/,/g, "").replace(/\/-/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeAmount(qty: string, unitRate: string): string {
  const q = toNumber(qty);
  const r = toNumber(unitRate);
  const amt = q * r;
  if (!Number.isFinite(amt) || amt === 0) return "";
  return amt.toFixed(2);
}

function normalizeBoq(items: any[] | undefined): QuotationItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ srNo: "1", description: "", unit: "Nos", qty: "", unitRate: "", amount: "" }];
  }
  return items.map((it, i): QuotationItem => ({
    srNo: String(it.srNo ?? i + 1),
    description: String(it.description ?? ""),
    unit: String(it.unit ?? "Nos"),
    qty: String(it.qty ?? ""),
    unitRate: String(it.unitRate ?? ""),
    amount: String(it.amount ?? ""),
  }));
}

function recalcTotals(items: QuotationItem[]) {
  const total = items.reduce((s, it) => s + toNumber(it.amount || "0"), 0);
  const vat = total * 0.05;
  return {
    totalWithoutVat: +total.toFixed(2),
    vatAmount: +vat.toFixed(2),
    totalWithVat: +(total + vat).toFixed(2),
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QuotationHistory() {
  const [items, setItems] = useState<QDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<QDoc>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const fetch_ = async () => {
    try {
      const r = await apiCall<{ quotations: QDoc[] }>("/api/quotation");
      setItems(r.quotations || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch_(); }, []);

  // Group revisions
  const grouped = useMemo(() => {
    const g = new Map<string, QDoc[]>();
    items.forEach(q => {
      const root = q.revisionOf || q._docId;
      if (!g.has(root)) g.set(root, []);
      g.get(root)!.push(q);
    });
    g.forEach(arr => arr.sort((a, b) => (b.revisionNumber || 0) - (a.revisionNumber || 0)));
    return Array.from(g.values()).sort((a, b) => String(b[0].createdAt).localeCompare(String(a[0].createdAt)));
  }, [items]);

  // ----- Actions -----

  const handleDownload = async (q: QDoc) => {
    const [{ pdf }, { default: Doc }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./QuotationDocument"),
    ]);
    const blob = await pdf(<Doc quotationData={q} />).toBlob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${q.quotationNo}.pdf` }).click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (q: QDoc) => {
    try {
      const [{ pdf }, { default: Doc }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./QuotationDocument"),
      ]);
      const blob = await pdf(<Doc quotationData={q} />).toBlob();
      const pdfFile = new File([blob], `${q.quotationNo}.pdf`, { type: "application/pdf" });
      const text = [
        `Quotation: ${q.quotationNo}`,
        `Client: ${q.to}`,
        `Total: ${fmtAED(q.totalWithVat || 0)}`,
      ].join("\n");

      if (navigator.share) {
        if (navigator.canShare?.({ files: [pdfFile] })) {
          await navigator.share({ title: q.quotationNo, text, files: [pdfFile] });
        } else {
          await navigator.share({ title: q.quotationNo, text });
        }
      } else {
        await navigator.clipboard.writeText(text);
        alert("Quotation details copied to clipboard.");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "Share failed.");
    }
  };

  const handleDelete = async (q: QDoc) => {
    if (!confirm(`Delete quotation ${q.quotationNo}? This cannot be undone.`)) return;
    try {
      setDeletingId(q._docId);
      await apiCall("/api/quotation", { method: "DELETE", body: { _docId: q._docId } });
      await fetch_();
    } catch (e: any) {
      alert(e.message || "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  // ----- Edit handlers -----

  const startEdit = (q: QDoc) => {
    setEditing(q._docId);
    setEditData({
      ...q,
      boqItems: normalizeBoq(q.boqItems as any[]),
      inclusionItems: Array.isArray(q.inclusionItems) ? [...q.inclusionItems] : [""],
      exclusionItems: Array.isArray(q.exclusionItems) ? [...q.exclusionItems] : [],
      paymentTerms: Array.isArray(q.paymentTerms) ? [...q.paymentTerms] : [""],
    });
  };

  const cancel = () => { setEditing(null); setEditData({}); };

  const save = async () => {
    try {
      const boq = normalizeBoq(editData.boqItems as any[]);
      const totals = recalcTotals(boq);
      await apiCall("/api/quotation", {
        method: "PUT",
        body: {
          _docId: editing,
          ...editData,
          boqItems: boq,
          totalWithoutVat: totals.totalWithoutVat,
          vatAmount: totals.vatAmount,
          totalWithVat: totals.totalWithVat,
        },
      });
      cancel();
      fetch_();
    } catch (e: any) { setError(e.message); }
  };

  // BOQ row mutators
  const updateBoqItem = (rowIdx: number, field: keyof QuotationItem, value: string) => {
    setEditData(prev => {
      const items = normalizeBoq(prev.boqItems as any[]);
      const updated = { ...items[rowIdx], [field]: value };
      if (field === "qty" || field === "unitRate") {
        updated.amount = computeAmount(updated.qty, updated.unitRate);
      }
      items[rowIdx] = updated;
      return { ...prev, boqItems: items };
    });
  };

  const addBoqRow = () => {
    setEditData(prev => {
      const items = normalizeBoq(prev.boqItems as any[]);
      items.push({ srNo: String(items.length + 1), description: "", unit: "Nos", qty: "", unitRate: "", amount: "" });
      return { ...prev, boqItems: items };
    });
  };

  const removeBoqRow = (rowIdx: number) => {
    setEditData(prev => {
      const items = normalizeBoq(prev.boqItems as any[]);
      if (items.length === 1) return prev;
      const next = items.filter((_, i) => i !== rowIdx).map((r, i) => ({ ...r, srNo: String(i + 1) }));
      return { ...prev, boqItems: next };
    });
  };

  // Inclusion / exclusion / payment term list mutators (generic)
  const updateListItem = (field: "inclusionItems" | "exclusionItems" | "paymentTerms", idx: number, v: string) => {
    setEditData(prev => {
      const arr = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : [];
      arr[idx] = v;
      return { ...prev, [field]: arr };
    });
  };
  const addListItem = (field: "inclusionItems" | "exclusionItems" | "paymentTerms") => {
    setEditData(prev => {
      const arr = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : [];
      arr.push("");
      return { ...prev, [field]: arr };
    });
  };
  const removeListItem = (field: "inclusionItems" | "exclusionItems" | "paymentTerms", idx: number) => {
    setEditData(prev => {
      const arr = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : [];
      if (field !== "exclusionItems" && arr.length === 1) return prev; // keep at least 1 for inclusions/payment
      return { ...prev, [field]: arr.filter((_, i) => i !== idx) };
    });
  };

  // ----- UI -----

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin" /></div>;

  const inp = "px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm w-full";
  const lbl = "text-xs text-navy-400 font-semibold mb-1 block";
  const taArea = "px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm w-full min-h-[70px] resize-y";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      {grouped.length === 0 ? (
        <div className="text-center py-16 text-navy-300">No quotations yet.</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => {
            const q = group[0];
            const older = group.slice(1);

            // ============================ EDIT VIEW ============================
            if (editing === q._docId) {
              const boq = normalizeBoq(editData.boqItems as any[]);
              const totals = recalcTotals(boq);
              const inclusions = (editData.inclusionItems as string[]) || [];
              const exclusions = (editData.exclusionItems as string[]) || [];
              const payments = (editData.paymentTerms as string[]) || [];

              return (
                <div key={q._docId} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-navy dark:text-white">Editing {q.quotationNo}</h3>
                    <div className="flex gap-2">
                      <button onClick={save} className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl btn-press">
                        <Save size={14} /> Save as new revision
                      </button>
                      <button onClick={cancel} className="flex items-center gap-1 px-3 py-2 text-navy-400 text-sm">
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg mb-4">
                    ⚠ Saving creates a new revision. Old version stays in history.
                  </p>

                  {/* HEADER FIELDS */}
                  <div className="grid sm:grid-cols-2 gap-3 mb-5">
                    <div>
                      <label className={lbl}>To</label>
                      <input value={editData.to || ""} onChange={e => setEditData(p => ({ ...p, to: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Attn</label>
                      <input value={editData.attn || ""} onChange={e => setEditData(p => ({ ...p, attn: e.target.value }))} className={inp} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={lbl}>Project</label>
                      <textarea value={editData.project || ""} onChange={e => setEditData(p => ({ ...p, project: e.target.value }))} className={taArea} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={lbl}>Service Title (Subject)</label>
                      <input value={editData.serviceTitle || ""} onChange={e => setEditData(p => ({ ...p, serviceTitle: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Date</label>
                      <input value={editData.date || ""} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Validity</label>
                      <input value={editData.validity || ""} onChange={e => setEditData(p => ({ ...p, validity: e.target.value }))} className={inp} />
                    </div>
                  </div>

                  {/* INCLUSIONS */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className={lbl}>Inclusions</label>
                      <button onClick={() => addListItem("inclusionItems")} className="flex items-center gap-1 px-2 py-1 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-lg text-xs font-semibold btn-press">
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {inclusions.map((it, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <textarea value={it} onChange={e => updateListItem("inclusionItems", i, e.target.value)} className={taArea} />
                          <button onClick={() => removeListItem("inclusionItems", i)} disabled={inclusions.length === 1} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* EXCLUSIONS */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className={lbl}>Exclusions</label>
                      <button onClick={() => addListItem("exclusionItems")} className="flex items-center gap-1 px-2 py-1 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-lg text-xs font-semibold btn-press">
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    {exclusions.length === 0 ? (
                      <p className="text-xs text-navy-400 italic">No exclusions. Click "Add" if you want to add some.</p>
                    ) : (
                      <div className="space-y-2">
                        {exclusions.map((it, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <textarea value={it} onChange={e => updateListItem("exclusionItems", i, e.target.value)} className={taArea} />
                            <button onClick={() => removeListItem("exclusionItems", i)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BOQ */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className={lbl}>BOQ Items (Schedule of Prices)</label>
                      <button onClick={addBoqRow} className="flex items-center gap-1 px-2 py-1 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-lg text-xs font-semibold btn-press">
                        <Plus size={12} /> Add row
                      </button>
                    </div>
                    <div className="space-y-3">
                      {boq.map((row, i) => (
                        <div key={i} className="border border-navy-100 dark:border-navy-700 rounded-xl p-3 bg-navy-50/40 dark:bg-navy-900/20">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-navy dark:text-white">Row {row.srNo}</p>
                            <button onClick={() => removeBoqRow(i)} disabled={boq.length === 1} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30">
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="grid sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-5">
                              <label className={lbl}>Description</label>
                              <textarea value={row.description} onChange={e => updateBoqItem(i, "description", e.target.value)} className={taArea} />
                            </div>
                            <div className="sm:col-span-1">
                              <label className={lbl}>Unit</label>
                              <input value={row.unit} onChange={e => updateBoqItem(i, "unit", e.target.value)} className={inp} />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={lbl}>Qty</label>
                              <input type="number" step="any" value={row.qty} onChange={e => updateBoqItem(i, "qty", e.target.value)} className={inp} />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={lbl}>Unit Rate</label>
                              <input type="number" step="any" value={row.unitRate} onChange={e => updateBoqItem(i, "unitRate", e.target.value)} className={inp} />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={lbl}>Amount (auto)</label>
                              <input value={row.amount} readOnly className={`${inp} bg-navy-50 dark:bg-navy-900 text-navy-500 font-semibold text-right`} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Live totals */}
                    <div className="mt-3 p-3 rounded-xl bg-navy-50 dark:bg-navy-900/40 text-sm">
                      <div className="flex justify-between"><span className="text-navy-400">Subtotal</span><span className="font-semibold">{fmtAED(totals.totalWithoutVat)}</span></div>
                      <div className="flex justify-between"><span className="text-navy-400">VAT (5%)</span><span className="font-semibold">{fmtAED(totals.vatAmount)}</span></div>
                      <div className="flex justify-between pt-1 mt-1 border-t border-navy-200 dark:border-navy-700"><span className="font-bold text-navy dark:text-white">Total with VAT</span><span className="font-bold text-gold">{fmtAED(totals.totalWithVat)}</span></div>
                    </div>
                  </div>

                  {/* PAYMENT TERMS */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={lbl}>Payment Terms</label>
                      <button onClick={() => addListItem("paymentTerms")} className="flex items-center gap-1 px-2 py-1 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-lg text-xs font-semibold btn-press">
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {payments.map((it, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <textarea value={it} onChange={e => updateListItem("paymentTerms", i, e.target.value)} className={taArea} />
                          <button onClick={() => removeListItem("paymentTerms", i)} disabled={payments.length === 1} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // ============================ DISPLAY VIEW ============================
            return (
              <div key={q._docId} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover-lift">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-navy dark:text-white">{q.quotationNo}</h3>
                      {older.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">
                          {older.length} older revision{older.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-navy-400 text-sm">{q.to}</p>
                    <p className="text-navy-300 text-xs">{q.project}</p>
                  </div>
                  <p className="text-gold font-bold text-lg shrink-0">{fmtAED(q.totalWithVat || 0)}</p>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-navy-50 dark:border-navy-700">
                  <button onClick={() => handleDownload(q)} className="flex items-center gap-2 px-4 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white text-sm font-semibold btn-press">
                    <Download size={14} /> Download
                  </button>
                  <button onClick={() => handleShare(q)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 rounded-xl text-indigo-600 dark:text-indigo-400 text-sm font-semibold btn-press">
                    <Share2 size={14} /> Share
                  </button>
                  <button onClick={() => startEdit(q)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl text-blue-600 text-sm font-semibold btn-press">
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      const payload = quotationToProjectPayload(q);
                      sessionStorage.setItem("prefillProject", JSON.stringify(payload));
                      router.push("/dashboard/accounts/projects?prefill=1");
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 rounded-xl text-teal-700 dark:text-teal-400 text-sm font-semibold btn-press"
                  >
                    <FolderPlus size={14} /> Convert to Project
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    disabled={deletingId === q._docId}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl text-red-600 text-sm font-semibold btn-press disabled:opacity-60"
                  >
                    <Trash2 size={14} /> {deletingId === q._docId ? "Deleting…" : "Delete"}
                  </button>
                </div>

                {older.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-navy-400 text-xs flex items-center gap-1 hover:text-navy dark:hover:text-white">
                      <HistoryIcon size={12} /> View revision history ({older.length})
                    </summary>
                    <div className="mt-2 pl-4 border-l-2 border-navy-100 dark:border-navy-700 space-y-1">
                      {older.map(o => (
                        <div key={o._docId} className="flex justify-between text-xs text-navy-400 py-1">
                          <span>{o.quotationNo}</span>
                          <button onClick={() => handleDownload(o)} className="text-navy dark:text-gold font-semibold hover:underline">Download</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
