"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import type { TaxInvoiceData } from "./TaxInvoiceDocument";
import { Download, Pencil, Save, X, History as HistoryIcon } from "lucide-react";

type TDoc = TaxInvoiceData & { _docId: string; revisionOf?: string; revisionNumber?: number; createdAt?: string };

export default function TaxInvoiceHistory() {
  const [items, setItems] = useState<TDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<TDoc>>({});

  const fetch_ = async () => {
    try { const r = await apiCall<{invoices: TDoc[]}>("/api/tax-invoice"); setItems(r.invoices || []); }
    finally { setLoading(false); }
  };
  useEffect(()=>{fetch_();},[]);

  const grouped = useMemo(() => {
    const g = new Map<string, TDoc[]>();
    items.forEach(q => {
      const root = q.revisionOf || q._docId;
      if (!g.has(root)) g.set(root, []);
      g.get(root)!.push(q);
    });
    g.forEach(arr => arr.sort((a, b) => (b.revisionNumber || 0) - (a.revisionNumber || 0)));
    return Array.from(g.values()).sort((a, b) => String(b[0].createdAt).localeCompare(String(a[0].createdAt)));
  }, [items]);

  const handleDownload = async (d: TDoc) => {
    const [{pdf}, {default: Doc}] = await Promise.all([import("@react-pdf/renderer"), import("./TaxInvoiceDocument")]);
    const blob = await pdf(<Doc data={d}/>).toBlob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${d.invoiceNo}.pdf` }).click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (d: TDoc) => { setEditing(d._docId); setEditData({ ...d }); };
  const cancel = () => { setEditing(null); setEditData({}); };
  const save = async () => {
    await apiCall("/api/tax-invoice", { method: "PUT", body: { _docId: editing, invoiceNo: (editData as any).invoiceNo, ...editData }});
    cancel(); fetch_();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin"/></div>;

  const inp = "px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm w-full";
  const lbl = "text-xs text-navy-400 font-semibold mb-1 block";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      {grouped.length === 0 ? <div className="text-center py-16 text-navy-300">No tax invoices yet.</div> : (
        <div className="space-y-4">
          {grouped.map(group => {
            const inv = group[0]; const older = group.slice(1);
            return (
              <div key={inv._docId} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover-lift">
                {editing === inv._docId ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-navy dark:text-white">Editing {inv.invoiceNo}</h3>
                      <div className="flex gap-2">
                        <button onClick={save} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl btn-press"><Save size={14}/> Save as new revision</button>
                        <button onClick={cancel} className="px-3 py-2 text-navy-400 text-sm"><X size={14}/></button>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><label className={lbl}>Client Name</label><input value={editData.clientName||""} onChange={e=>setEditData(p=>({...p, clientName: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Client Address</label><input value={editData.clientAddress||""} onChange={e=>setEditData(p=>({...p, clientAddress: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Client TRN</label><input value={editData.clientTRN||""} onChange={e=>setEditData(p=>({...p, clientTRN: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Client Phone</label><input value={editData.clientPhone||""} onChange={e=>setEditData(p=>({...p, clientPhone: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Project</label><input value={editData.project||""} onChange={e=>setEditData(p=>({...p, project: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>PO Reference</label><input value={editData.poReference||""} onChange={e=>setEditData(p=>({...p, poReference: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Date</label><input value={editData.date||""} onChange={e=>setEditData(p=>({...p, date: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Due Date</label><input value={editData.dueDate||""} onChange={e=>setEditData(p=>({...p, dueDate: e.target.value}))} className={inp}/></div>
                      <div className="sm:col-span-2"><label className={lbl}>Items (JSON)</label><textarea value={JSON.stringify(editData.items||[],null,2)} onChange={e=>{try{setEditData(p=>({...p, items: JSON.parse(e.target.value)}));}catch{}}} className={`${inp} font-mono text-xs min-h-[120px]`}/></div>
                      <div><label className={lbl}>Bank Name</label><input value={editData.bankName||""} onChange={e=>setEditData(p=>({...p, bankName: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Account Name</label><input value={editData.accountName||""} onChange={e=>setEditData(p=>({...p, accountName: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Account Number</label><input value={editData.accountNumber||""} onChange={e=>setEditData(p=>({...p, accountNumber: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>IBAN</label><input value={editData.iban||""} onChange={e=>setEditData(p=>({...p, iban: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>SWIFT</label><input value={editData.swiftCode||""} onChange={e=>setEditData(p=>({...p, swiftCode: e.target.value}))} className={inp}/></div>
                      <div className="sm:col-span-2"><label className={lbl}>Notes</label><input value={editData.notes||""} onChange={e=>setEditData(p=>({...p, notes: e.target.value}))} className={inp}/></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-navy dark:text-white">{inv.invoiceNo}</h3>
                          {older.length > 0 && <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 text-xs rounded-full">{older.length} older</span>}
                        </div>
                        <p className="text-navy-400 text-sm">{inv.clientName} — {inv.project || "No project"}</p>
                      </div>
                      <p className="text-gold font-bold text-lg">AED {Number(inv.total||0).toFixed(2)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-navy-50 dark:border-navy-700">
                      <button onClick={()=>handleDownload(inv)} className="flex items-center gap-2 px-4 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white text-sm font-semibold btn-press"><Download size={14}/> Download</button>
                      <button onClick={()=>startEdit(inv)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl text-blue-600 text-sm font-semibold btn-press"><Pencil size={14}/> Edit</button>
                    </div>
                    {older.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-navy-400 text-xs flex items-center gap-1"><HistoryIcon size={12}/> Revision history</summary>
                        <div className="mt-2 pl-4 border-l-2 border-navy-100 dark:border-navy-700 space-y-1">
                          {older.map(o => <div key={o._docId} className="flex justify-between text-xs text-navy-400 py-1"><span>{o.invoiceNo}</span><button onClick={()=>handleDownload(o)} className="text-navy dark:text-gold font-semibold hover:underline">Download</button></div>)}
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