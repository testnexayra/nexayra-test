"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import type { ReceiverCopyData } from "./ReceiverCopyDocument";
import { Download, Pencil, Save, X, History as HistoryIcon } from "lucide-react";

type RDoc = ReceiverCopyData & { _docId: string; revisionOf?: string; revisionNumber?: number; createdAt?: string };

export default function ReceiverCopyHistory() {
  const [items, setItems] = useState<RDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<RDoc>>({});

  const fetch_ = async () => {
    try { const r = await apiCall<{receiverCopies: RDoc[]}>("/api/receiver-copy"); setItems(r.receiverCopies || []); }
    finally { setLoading(false); }
  };
  useEffect(()=>{fetch_();},[]);

  const grouped = useMemo(() => {
    const g = new Map<string, RDoc[]>();
    items.forEach(q => {
      const root = q.revisionOf || q._docId;
      if (!g.has(root)) g.set(root, []);
      g.get(root)!.push(q);
    });
    g.forEach(arr => arr.sort((a, b) => (b.revisionNumber || 0) - (a.revisionNumber || 0)));
    return Array.from(g.values()).sort((a, b) => String(b[0].createdAt).localeCompare(String(a[0].createdAt)));
  }, [items]);

  const handleDownload = async (r: RDoc) => {
    const [{pdf}, {default: Doc}] = await Promise.all([import("@react-pdf/renderer"), import("./ReceiverCopyDocument")]);
    const blob = await pdf(<Doc data={r}/>).toBlob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${r.documentNo}.pdf` }).click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (r: RDoc) => { setEditing(r._docId); setEditData({ ...r }); };
  const cancel = () => { setEditing(null); setEditData({}); };
  const save = async () => {
    await apiCall("/api/receiver-copy", { method: "PUT", body: { _docId: editing, documentNo: (editData as any).documentNo, ...editData }});
    cancel(); fetch_();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin"/></div>;

  const inp = "px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm w-full";
  const lbl = "text-xs text-navy-400 font-semibold mb-1 block";

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      {grouped.length === 0 ? <div className="text-center py-16 text-navy-300">No receipts yet.</div> : (
        <div className="space-y-4">
          {grouped.map(group => {
            const r = group[0]; const older = group.slice(1);
            return (
              <div key={r._docId} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover-lift">
                {editing === r._docId ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-navy dark:text-white">Editing {r.documentNo}</h3>
                      <div className="flex gap-2">
                        <button onClick={save} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl btn-press"><Save size={14}/> Save as new revision</button>
                        <button onClick={cancel} className="px-3 py-2 text-navy-400 text-sm"><X size={14}/></button>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><label className={lbl}>Received From</label><input value={editData.receivedFrom||""} onChange={e=>setEditData(p=>({...p, receivedFrom: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Amount</label><input value={editData.amount||""} onChange={e=>setEditData(p=>({...p, amount: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Cheque Number</label><input value={editData.chequeNumber||""} onChange={e=>setEditData(p=>({...p, chequeNumber: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Bank Name</label><input value={editData.bankName||""} onChange={e=>setEditData(p=>({...p, bankName: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Cheque Date</label><input value={editData.chequeDate||""} onChange={e=>setEditData(p=>({...p, chequeDate: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Date</label><input value={editData.date||""} onChange={e=>setEditData(p=>({...p, date: e.target.value}))} className={inp}/></div>
                      <div className="sm:col-span-2"><label className={lbl}>Purpose</label><input value={editData.purposeDescription||""} onChange={e=>setEditData(p=>({...p, purposeDescription: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Received By</label><input value={editData.receivedBy||""} onChange={e=>setEditData(p=>({...p, receivedBy: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Company Name</label><input value={editData.companyName||""} onChange={e=>setEditData(p=>({...p, companyName: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Contact Number</label><input value={editData.contactNumber||""} onChange={e=>setEditData(p=>({...p, contactNumber: e.target.value}))} className={inp}/></div>
                      <div><label className={lbl}>Email</label><input value={editData.email||""} onChange={e=>setEditData(p=>({...p, email: e.target.value}))} className={inp}/></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-navy dark:text-white">{r.documentNo}</h3>
                          {older.length > 0 && <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 text-xs rounded-full">{older.length} older</span>}
                        </div>
                        <p className="text-navy-400 text-sm">{r.receivedFrom}</p>
                      </div>
                      <p className="text-gold font-bold text-lg">AED {r.amount}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-navy-50 dark:border-navy-700">
                      <button onClick={()=>handleDownload(r)} className="flex items-center gap-2 px-4 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white text-sm font-semibold btn-press"><Download size={14}/> Download</button>
                      <button onClick={()=>startEdit(r)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl text-blue-600 text-sm font-semibold btn-press"><Pencil size={14}/> Edit</button>
                    </div>
                    {older.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-navy-400 text-xs flex items-center gap-1"><HistoryIcon size={12}/> Revision history</summary>
                        <div className="mt-2 pl-4 border-l-2 border-navy-100 dark:border-navy-700 space-y-1">
                          {older.map(o => <div key={o._docId} className="flex justify-between text-xs text-navy-400 py-1"><span>{o.documentNo}</span><button onClick={()=>handleDownload(o)} className="text-navy dark:text-gold font-semibold hover:underline">Download</button></div>)}
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