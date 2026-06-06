"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import { Plus, Trash2, Banknote } from "lucide-react";

type Invoice = { id: string; invoiceNo: string; clientName: string; total: number; amountPaid: number; outstanding: number; status: string; date: string; dueDate: string; projectId: string };
type Bank = { id: string; name: string };
type Project = { id: string; name: string };
type Collection = { id: string; invoiceId: string; date: string; amount: number; bankAccountId: string; reference: string };

export default function InvoicingPage() {
  const { canWrite } = useRole();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCollect, setShowCollect] = useState<string | null>(null);

  // New invoice form
  const [invNo, setInvNo] = useState(""); const [client, setClient] = useState(""); const [total, setTotal] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0,10)); const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");

  // Collection form
  const [colAmount, setColAmount] = useState(""); const [colBank, setColBank] = useState("");
  const [colDate, setColDate] = useState(new Date().toISOString().slice(0,10)); const [colRef, setColRef] = useState("");

  const load = async () => {
    try {
      const [i, b, p, c] = await Promise.all([
        apiCall<{invoices: Invoice[]}>("/api/accounts-invoices"),
        apiCall<{accounts: Bank[]}>("/api/bank-accounts"),
        apiCall<{projects: Project[]}>("/api/accounts-projects"),
        apiCall<{collections: Collection[]}>("/api/collections"),
      ]);
      setInvoices(i.invoices); setBanks(b.accounts); setProjects(p.projects); setCollections(c.collections);
    } finally { setLoading(false); }
  };
  useEffect(()=>{load();},[]);

  const addInv = async () => {
    if (!invNo.trim()) { alert("Please add the invoice number."); return; }
    if (!client.trim()) { alert("Please add the client name."); return; }
    if (!total || isNaN(Number(total)) || Number(total) <= 0) { alert("Please add a valid total amount."); return; }
    if (!invDate) { alert("Please add the invoice date."); return; }
    await apiCall("/api/accounts-invoices", { method: "POST", body: { invoiceNo: invNo, clientName: client, total: Number(total), date: invDate, dueDate, projectId }});
    setInvNo(""); setClient(""); setTotal(""); setProjectId(""); load();
  };

  const addCol = async (invoiceId: string) => {
    if (!colAmount || isNaN(Number(colAmount)) || Number(colAmount) <= 0) { alert("Please add a valid amount."); return; }
    if (!colBank) { alert("Please select a bank account."); return; }
    if (!colDate) { alert("Please select a date."); return; }
    await apiCall("/api/collections", { method: "POST", body: { invoiceId, amount: Number(colAmount), bankAccountId: colBank, date: colDate, reference: colRef }});
    setColAmount(""); setColRef(""); setShowCollect(null); load();
  };

  const delCol = async (id: string) => { if (!confirm("Delete collection?")) return; await apiCall(`/api/collections?id=${id}`, { method: "DELETE" }); load(); };

  if (loading) return <Loader fullScreen />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm placeholder:text-navy dark:text-white-300 dark:placeholder:text-navy dark:text-white";;
  const totalInvoiced = invoices.reduce((s,i)=>s+i.total,0);
  const totalCollected = invoices.reduce((s,i)=>s+i.amountPaid,0);
  const totalOutstanding = invoices.reduce((s,i)=>s+i.outstanding,0);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift"><p className="text-navy dark:text-white text-xs font-bold uppercase tracking-wider">Total Invoiced</p><p className="text-2xl font-bold text-navy dark:text-white mt-1">{fmtAED(totalInvoiced)}</p></div>
        <div className="bg-white border border-green-100 rounded-2xl p-5 hover-lift"><p className="text-green-600 text-xs font-bold uppercase tracking-wider">Collected</p><p className="text-2xl font-bold text-green-600 mt-1">{fmtAED(totalCollected)}</p></div>
        <div className="bg-white border border-amber-100 rounded-2xl p-5 hover-lift"><p className="text-amber-600 text-xs font-bold uppercase tracking-wider">Outstanding</p><p className="text-2xl font-bold text-amber-600 mt-1">{fmtAED(totalOutstanding)}</p></div>
      </div>

      {canWrite && (
        <div className="bg-white border border-navy-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold mb-4">Add Invoice Manually</h2>  
          <p className="text-navy dark:text-white text-xs mb-3">Tax invoices from Estimation tab auto-mirror here.</p>
          <div className="grid sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <input placeholder="Invoice No" value={invNo} onChange={e=>setInvNo(e.target.value)} className={inp}/>
            <input placeholder="Client" value={client} onChange={e=>setClient(e.target.value)} className={inp}/>
            <input type="number" placeholder="Total" value={total} onChange={e=>setTotal(e.target.value)} className={inp}/>
            <input type="date" value={invDate} onChange={e=>setInvDate(e.target.value)} className={inp}/>
            <input type="date" placeholder="Due" value={dueDate} onChange={e=>setDueDate(e.target.value)} className={inp}/>
            <select value={projectId} onChange={e=>setProjectId(e.target.value)} className={inp}>
              <option value="">No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={addInv} className="px-4 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press flex items-center justify-center gap-1"><Plus size={14}/></button>
          </div>
        </div>
      )}

      <div className="bg-white border border-navy-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-lato text-navy dark:text-white text-lg font-bold mb-4">Invoices</h2>
        <div className="space-y-3">
          {invoices.length === 0 ? <p className="text-navy dark:text-white text-sm text-center py-8">No invoices yet.</p> :
            invoices.map(inv => {
              const invCols = collections.filter(c => c.invoiceId === inv.id);
              const statusColor = inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
              return (
                <div key={inv.id} className="p-4 border border-navy-100 rounded-xl">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy dark:text-white">{inv.invoiceNo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{inv.status}</span>
                      </div>
                      <p className="text-navy dark:text-white text-sm">{inv.clientName} · {fmtDate(inv.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-navy dark:text-white">{fmtAED(inv.total)}</p>
                      <p className="text-xs text-green-600">Paid: {fmtAED(inv.amountPaid)}</p>
                      {inv.outstanding > 0 && <p className="text-xs text-amber-600">Due: {fmtAED(inv.outstanding)}</p>}
                    </div>
                  </div>
                  {invCols.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-navy-50 space-y-1">
                      {invCols.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs text-navy dark:text-white">
                          <span>📥 {fmtDate(c.date)} · {c.reference} · {banks.find(b=>b.id===c.bankAccountId)?.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 font-semibold">{fmtAED(c.amount)}</span>
                            {canWrite && <button onClick={()=>delCol(c.id)} className="text-red-500"><Trash2 size={12}/></button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {canWrite && inv.outstanding > 0 && (
                    <div className="mt-3">
                      {showCollect === inv.id ? (
                        <div className="grid grid-cols-5 gap-2">
                          <input type="number" placeholder="Amount" value={colAmount} onChange={e=>setColAmount(e.target.value)} className={inp}/>
                          <select value={colBank} onChange={e=>setColBank(e.target.value)} className={inp}>
                            <option value="">Bank</option>{banks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <input type="date" value={colDate} onChange={e=>setColDate(e.target.value)} className={inp}/>
                          <input placeholder="Reference" value={colRef} onChange={e=>setColRef(e.target.value)} className={inp}/>
                          <div className="flex gap-1">
                            <button onClick={()=>addCol(inv.id)} className="flex-1 px-3 py-2 bg-green-600 text-white font-semibold rounded-lg text-sm btn-press">Save</button>
                            <button onClick={()=>setShowCollect(null)} className="px-3 text-navy dark:text-white">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={()=>setShowCollect(inv.id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-lg btn-press"><Banknote size={14}/> Record Payment (AED)</button>
                      )}
                </div>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
