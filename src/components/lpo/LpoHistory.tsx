"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { auth } from "@/lib/firebase";
import { fmtAED } from "@/lib/format";
import type { LpoItem, LpoPdfData } from "./LpoDocument";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { Download, Pencil, Save, X, CheckCircle, Stamp, History as HistoryIcon, Plus, Trash2, Filter, Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

type LpoDoc = LpoPdfData & { _docId: string; revisionOf?: string; revisionNumber?: number; createdAt?: string };
type ItemField = keyof Pick<LpoItem, "description" | "qty" | "uom" | "amount" | "discount">;
type StatusFilter = "all" | "approved" | "pending";

function normalizeItems(items: any[] | undefined): LpoItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ description: "", qty: "1", uom: "Nos", amount: "", discount: "0" }];
  }

  return items.map((item) => ({
    description: String(item.description || ""),
    qty: String(item.qty ?? item.quantity ?? "1"),
    uom: String(item.uom || item.unit || "Nos"),
    amount: String(item.unitPrice ?? item.amount ?? ""),
    discount: String(item.discount ?? "0"),
  }));
}

function calculateTotals(items: LpoItem[]) {
  return items.reduce(
    (acc, item) => {
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.amount || 0);
      const discount = Math.max(0, Number(item.discount || 0));
      const gross = qty * unitPrice;
      const discountAmount = gross * (discount / 100);
      const subtotal = gross - discountAmount;
      const vat = subtotal * 0.05;

      acc.totalDiscount += discountAmount;
      acc.subtotal += subtotal;
      acc.vat += vat;
      acc.total += subtotal + vat;
      return acc;
    },
    { totalDiscount: 0, subtotal: 0, vat: 0, total: 0 }
  );
}

function lineTotal(item: LpoItem) {
  return calculateTotals([item]).total;
}

export default function LpoHistory() {
  const { role, canApproveLpo, canWriteProcurement } = useRole();
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("status") as StatusFilter) || "all";

  const [lpos, setLpos] = useState<LpoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<LpoDoc>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approverName, setApproverName] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    ["all", "approved", "pending"].includes(initialStatus) ? initialStatus : "all"
  );

  const fetch_ = async () => {
    try { const r = await apiCall<{lpos: LpoDoc[]}>("/api/lpo"); setLpos(r.lpos || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(()=>{fetch_();},[]);

  // Group revisions together — applies to ALL LPOs first
  const grouped = useMemo(() => {
    const g = new Map<string, LpoDoc[]>();
    lpos.forEach(l => {
      const root = l.revisionOf || l._docId;
      if (!g.has(root)) g.set(root, []);
      g.get(root)!.push(l);
    });
    g.forEach(arr => arr.sort((a, b) => (b.revisionNumber || 0) - (a.revisionNumber || 0)));
    return Array.from(g.values()).sort((a, b) => String(b[0].createdAt).localeCompare(String(a[0].createdAt)));
  }, [lpos]);

  // Filter the grouped LPOs based on the latest revision's status
  const filteredGrouped = useMemo(() => {
    if (statusFilter === "all") return grouped;
    return grouped.filter(group => {
      const latest = group[0];
      if (statusFilter === "approved") return !!latest.approved;
      if (statusFilter === "pending") return !latest.approved;
      return true;
    });
  }, [grouped, statusFilter]);

  // Counts for the filter UI
  const counts = useMemo(() => {
    const approved = grouped.filter(g => g[0].approved).length;
    const pending = grouped.filter(g => !g[0].approved).length;
    return { all: grouped.length, approved, pending };
  }, [grouped]);

  const handleDownload = async (lpo: LpoDoc) => {
    const [{pdf}, {default: Doc}] = await Promise.all([import("@react-pdf/renderer"), import("./LpoDocument")]);
    const blob = await pdf(<Doc lpoData={lpo}/>).toBlob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `LPO-${lpo.nxrNo}.pdf` }).click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (lpo: LpoDoc) => {
    try {
      const [{ pdf }, { default: Doc }] = await Promise.all([import("@react-pdf/renderer"), import("./LpoDocument")]);
      const blob = await pdf(<Doc lpoData={lpo} />).toBlob();
      const pdfFile = new File([blob], `LPO-${lpo.nxrNo}.pdf`, { type: "application/pdf" });
      const text = [
        `LPO #${lpo.nxrNo}`,
        `Client: ${lpo.clientName}`,
        `Vendor: ${lpo.vendorName}`,
        `Total: ${fmtAED(lpo.total)}`,
      ].join("\n");

      if (navigator.share) {
        if (navigator.canShare?.({ files: [pdfFile] })) {
          await navigator.share({ title: `LPO #${lpo.nxrNo}`, text, files: [pdfFile] });
        } else {
          await navigator.share({ title: `LPO #${lpo.nxrNo}`, text });
        }
      } else {
        await navigator.clipboard.writeText(text);
        alert("LPO details copied to clipboard.");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "Share failed.");
    }
  };

  const startEdit = (l: LpoDoc) => { setEditing(l._docId); setEditData({ ...l }); };
  const cancelEdit = () => { setEditing(null); setEditData({}); };
  const saveEdit = async () => {
    try {
      const items = normalizeItems(editData.items as any[]);
      const totals = calculateTotals(items);
      await apiCall("/api/lpo", {
        method: "PUT",
        body: {
          _docId: editing,
          ...editData,
          items,
          totalDiscount: Number(totals.totalDiscount.toFixed(2)),
          subtotal: Number(totals.subtotal.toFixed(2)),
          vat: Number(totals.vat.toFixed(2)),
          total: Number(totals.total.toFixed(2)),
        },
      });
      cancelEdit(); fetch_();
    } catch (e: any) { setError(e.message); }
  };

  const updateItem = (index: number, field: ItemField, value: string) => {
    setEditData((prev) => {
      const items = normalizeItems(prev.items as any[]);
      items[index] = { ...items[index], [field]: value };
      const totals = calculateTotals(items);

      return {
        ...prev,
        items,
        totalDiscount: Number(totals.totalDiscount.toFixed(2)),
        subtotal: Number(totals.subtotal.toFixed(2)),
        vat: Number(totals.vat.toFixed(2)),
        total: Number(totals.total.toFixed(2)),
      };
    });
  };

  const addItem = () => {
    setEditData((prev) => ({
      ...prev,
      items: [...normalizeItems(prev.items as any[]), { description: "", qty: "1", uom: "Nos", amount: "", discount: "0" }],
    }));
  };

  const removeItem = (index: number) => {
    setEditData((prev) => {
      const items = normalizeItems(prev.items as any[]).filter((_, i) => i !== index);
      const nextItems = items.length > 0 ? items : [{ description: "", qty: "1", uom: "Nos", amount: "", discount: "0" }];
      const totals = calculateTotals(nextItems);

      return {
        ...prev,
        items: nextItems,
        totalDiscount: Number(totals.totalDiscount.toFixed(2)),
        subtotal: Number(totals.vat.toFixed(2)),
        vat: Number(totals.vat.toFixed(2)),
        total: Number(totals.total.toFixed(2)),
      };
    });
  };

  const submitApprove = async (l: LpoDoc) => {
    if (!approverName.trim()) { alert("Please enter your name to approve."); return; }
    if (!approvalPassword) { alert("Please enter your password to approve."); return; }
    if (role !== "procurement-approver") { alert("Only procurement approver users can approve LPOs."); return; }

    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error("Could not verify the current user.");

      const credential = EmailAuthProvider.credential(user.email, approvalPassword);
      await reauthenticateWithCredential(user, credential);
      await apiCall("/api/lpo", { method: "PATCH", body: { _docId: l._docId, nxrNo: l.nxrNo, approvedBy: approverName }});
      setApprovingId(null); setApproverName(""); setApprovalPassword(""); fetch_();
    } catch (e: any) {
      const message = e?.code === "auth/invalid-credential" || e?.code === "auth/wrong-password"
        ? "Approval password is incorrect."
        : e.message;
      alert(message);
    }
  };

  const deleteLpo = async (l: LpoDoc) => {
    if (!confirm(`Delete LPO #${l.nxrNo}? This cannot be undone.`)) return;

    try {
      setDeletingId(l._docId);
      await apiCall("/api/lpo", { method: "DELETE", body: { _docId: l._docId, nxrNo: l.nxrNo } });
      await fetch_();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin"/></div>;

  const inp = "px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm w-full";
  const lbl = "text-xs text-navy-400 dark:text-navy-300 font-semibold mb-1 block";

  // Filter button styling helper
  const filterBtnClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
      active
        ? "bg-navy text-white dark:bg-gold dark:text-navy"
        : "bg-navy-50 dark:bg-navy-700 text-navy dark:text-white hover:bg-navy-100 dark:hover:bg-navy-600"
    }`;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      {/* Filter bar */}
      {grouped.length > 0 && (
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-navy-400 dark:text-navy-300 text-xs font-semibold mr-1">
            <Filter size={14} /> Filter:
          </div>
          <button onClick={() => setStatusFilter("all")} className={filterBtnClass(statusFilter === "all")}>
            All <span className="opacity-70">({counts.all})</span>
          </button>
          <button onClick={() => setStatusFilter("approved")} className={filterBtnClass(statusFilter === "approved")}>
            <CheckCircle size={12} /> Approved <span className="opacity-70">({counts.approved})</span>
          </button>
          <button onClick={() => setStatusFilter("pending")} className={filterBtnClass(statusFilter === "pending")}>
            <Stamp size={12} /> Pending <span className="opacity-70">({counts.pending})</span>
          </button>
          {statusFilter !== "all" && (
            <button onClick={() => setStatusFilter("all")} className="ml-auto text-xs text-navy-400 dark:text-navy-300 hover:text-navy dark:hover:text-white flex items-center gap-1">
              <X size={12} /> Clear filter
            </button>
          )}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="text-center py-16 text-navy-300">No LPOs yet.</div>
      ) : filteredGrouped.length === 0 ? (
        <div className="text-center py-16 text-navy-300">
          No {statusFilter} LPOs found.
          <button onClick={() => setStatusFilter("all")} className="block mx-auto mt-2 text-sm text-navy dark:text-gold font-semibold hover:underline">
            Show all
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGrouped.map(group => {
            const latest = group[0];
            const older = group.slice(1);
            const l = latest;
            return (
              <div key={l._docId} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover-lift">
                {editing === l._docId ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-navy dark:text-white">Editing LPO #{l.nxrNo}</h3>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white font-semibold text-sm rounded-xl btn-press"><Save size={14}/> Save as new revision</button>
                        <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-2 text-navy-400 text-sm"><X size={14}/> Cancel</button>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">⚠ Saving creates a new revision. Old version stays in history.</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><label className={lbl}>Client Name</label><input value={editData.clientName||""} onChange={e=>setEditData(p=>({...p, clientName: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Client Phone</label><input value={editData.clientPhone||""} onChange={e=>setEditData(p=>({...p, clientPhone: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Project</label><input value={editData.project||""} onChange={e=>setEditData(p=>({...p, project: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Site Location</label><input value={editData.siteLocation||""} onChange={e=>setEditData(p=>({...p, siteLocation: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Contact Person</label><input value={editData.contact||""} onChange={e=>setEditData(p=>({...p, contact: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Reference</label><input value={editData.reference||""} onChange={e=>setEditData(p=>({...p, reference: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Vendor Name</label><input value={editData.vendorName||""} onChange={e=>setEditData(p=>({...p, vendorName: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Vendor Address</label><textarea value={editData.vendorAddress||""} onChange={e=>setEditData(p=>({...p, vendorAddress: e.target.value}))} className={`${inp} min-h-[56px] resize-y`} rows={2}/></div>
                      <div><label className={lbl}>Vendor Phone</label><input value={editData.vendorPhone||""} onChange={e=>setEditData(p=>({...p, vendorPhone: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Vendor TRN</label><input value={editData.vendorTRN||""} onChange={e=>setEditData(p=>({...p, vendorTRN: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Payment Terms</label><input value={editData.paymentTerms||""} onChange={e=>setEditData(p=>({...p, paymentTerms: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Delivery Terms</label><input value={editData.deliveryterms||""} onChange={e=>setEditData(p=>({...p, deliveryterms: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Requested By</label><input value={editData.requestedBy||""} onChange={e=>setEditData(p=>({...p, requestedBy: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Prepared By</label><input value={editData.preparedBy||""} onChange={e=>setEditData(p=>({...p, preparedBy: e.target.value}))} className={inp}/></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={lbl}>Items</label>
                        <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-lg text-xs font-semibold btn-press">
                          <Plus size={12} /> Add item
                        </button>
                      </div>
                      <div className="space-y-3">
                        {normalizeItems(editData.items as any[]).map((item, index) => (
                          <div key={index} className="border border-navy-100 dark:border-navy-700 rounded-xl p-3 bg-navy-50/40 dark:bg-navy-900/20">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <p className="text-xs font-bold text-navy dark:text-white">Item {index + 1}</p>
                              <button onClick={() => removeItem(index)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Remove item">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="grid sm:grid-cols-6 gap-2">
                              <div className="sm:col-span-2">
                                <label className={lbl}>Description</label>
                                <textarea value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} className={`${inp} min-h-[56px] resize-y`} rows={2} />
                              </div>
                              <div>
                                <label className={lbl}>Quantity</label>
                                <input value={item.qty} onChange={(e) => updateItem(index, "qty", e.target.value)} className={inp} />
                              </div>
                              <div>
                                <label className={lbl}>UOM</label>
                                <input value={item.uom} onChange={(e) => updateItem(index, "uom", e.target.value)} className={inp} />
                              </div>
                              <div>
                                <label className={lbl}>Amount</label>
                                <input value={item.amount} onChange={(e) => updateItem(index, "amount", e.target.value)} className={inp} />
                              </div>
                              <div>
                                <label className={lbl}>Discount %</label>
                                <input value={item.discount} onChange={(e) => updateItem(index, "discount", e.target.value)} className={inp} />
                              </div>
                            </div>
                            <p className="text-xs text-navy-400 mt-2">
                              This line totals {fmtAED(lineTotal(item))} including VAT.
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-navy dark:text-white">LPO #{l.nxrNo}</h3>
                          {l.approved && <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full"><CheckCircle size={12}/> Approved</span>}
                          {!l.approved && <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full"><Stamp size={12}/> Pending</span>}
                          {older.length > 0 && <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">{older.length} older revision{older.length>1?"s":""}</span>}
                        </div>
                        <p className="text-navy-400 text-sm">{l.clientName} · {l.vendorName}</p>
                        <p className="text-navy-300 text-xs">{l.project}</p>
                        {l.approved && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Approved by {l.approvedBy}</p>}
                      </div>
                      <p className="text-gold font-bold text-lg">{fmtAED(l.total)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-navy-50 dark:border-navy-700">
                     <button onClick={()=>handleDownload(l)} className="flex items-center gap-2 px-4 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white text-sm font-semibold btn-press"><Download size={14}/> Download</button>
                      <button onClick={()=>handleShare(l)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 rounded-xl text-indigo-600 dark:text-indigo-400 text-sm font-semibold btn-press"><Share2 size={14}/> Share</button>
                      <button onClick={()=>startEdit(l)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl text-blue-600 text-sm font-semibold btn-press"><Pencil size={14}/> Edit</button>
                      {canWriteProcurement && (
                        <button
                          onClick={() => deleteLpo(l)}
                          disabled={deletingId === l._docId}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl text-red-600 text-sm font-semibold btn-press disabled:opacity-60"
                        >
                          <Trash2 size={14}/> {deletingId === l._docId ? "Deleting..." : "Delete"}
                        </button>
                      )}
                      {!l.approved && canApproveLpo && (
                        approvingId === l._docId ? (
                          <div className="flex flex-wrap gap-2 items-center">
                            <input placeholder="Your name" value={approverName} onChange={e=>setApproverName(e.target.value)} className={inp + " w-auto"}/>
                            <input type="password" placeholder="Approval password" value={approvalPassword} onChange={e=>setApprovalPassword(e.target.value)} className={inp + " w-auto"}/>
                            <button onClick={()=>submitApprove(l)} className="px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold btn-press">Confirm</button>
                            <button onClick={()=>{ setApprovingId(null); setApproverName(""); setApprovalPassword(""); }} className="px-3 py-2 text-navy-400 text-sm">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={()=>{ setApprovingId(l._docId); setApproverName(""); setApprovalPassword(""); }} className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl text-green-700 dark:text-green-400 text-sm font-semibold btn-press"><Stamp size={14}/> Approve</button>
                        )
                      )}
                    </div>
                    {older.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-navy-400 text-xs flex items-center gap-1 hover:text-navy dark:hover:text-white"><HistoryIcon size={12}/> View revision history ({older.length})</summary>
                        <div className="mt-2 space-y-1 pl-4 border-l-2 border-navy-100 dark:border-navy-700">
                          {older.map(o => (
                            <div key={o._docId} className="flex items-center justify-between text-xs text-navy-400 py-1">
                              <span>{o.nxrNo}</span>
                              <button onClick={()=>handleDownload(o)} className="text-navy dark:text-gold font-semibold hover:underline">Download</button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}