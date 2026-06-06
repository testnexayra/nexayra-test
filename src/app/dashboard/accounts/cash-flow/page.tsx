"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, Pencil, Check, X } from "lucide-react";
import Loader from "@/components/Loader";

type Bank = { id: string; name: string; openingBalance: number; currentBalance: number };
type Tx = { id: string; bankAccountId: string; amount: number; date: string; type: string; description: string };

export default function CashFlowPage() {
  const { canWrite } = useRole();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBank, setFilterBank] = useState("");

  const [newName, setNewName] = useState("");
  const [newOpening, setNewOpening] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOpening, setEditOpening] = useState("");

  const load = async () => {
    try {
      const [b, t] = await Promise.all([
        apiCall<{accounts: Bank[]}>("/api/bank-accounts"),
        apiCall<{transactions: Tx[]}>("/api/bank-transactions?limit=200"),
      ]);
      setBanks(b.accounts); setTxs(t.transactions);
    } finally { setLoading(false); }
  };
  useEffect(()=>{load();},[]);

  const addBank = async () => {
    if (!newName.trim()) { alert("Please add the bank account name."); return; }
    if (newOpening === "" || isNaN(Number(newOpening))) { alert("Please add a valid opening balance."); return; }
    await apiCall("/api/bank-accounts", { method: "POST", body: { name: newName, openingBalance: Number(newOpening||0) }});
    setNewName(""); setNewOpening(""); load();
  };

  const deleteBank = async (id: string, name: string) => {
    if (!confirm(`Delete bank account "${name}"? This cannot be undone.`)) return;
    try {
      await apiCall(`/api/bank-accounts?id=${id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      alert(e.message || "Failed to delete bank account.");
    }
  };

  const startEdit = (b: Bank) => {
    setEditingId(b.id); setEditName(b.name); setEditOpening(String(b.openingBalance));
  };
  const saveEdit = async () => {
    if (!editName.trim()) { alert("Name cannot be empty."); return; }
    await apiCall("/api/bank-accounts", { method: "PUT", body: { id: editingId, name: editName, openingBalance: Number(editOpening||0) }});
    setEditingId(null); load();
  };

  if (loading) return <Loader fullScreen />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm placeholder:text-navy dark:text-white-300 dark:placeholder:text-navy dark:text-white";;
  const totalCash = banks.reduce((s,b)=>s+b.currentBalance,0);
  const filtered = filterBank ? txs.filter(t => t.bankAccountId === filterBank) : txs;

  return (
    <div className="space-y-6">
      <div className="bg-brand-navy rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"/>
        <p className="text-navy dark:text-white-200 text-sm uppercase tracking-wider font-semibold">Total Cash in Hand</p>
        <p className="text-4xl font-bold mt-1">{fmtAED(totalCash)}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {banks.map(b => (
          <div key={b.id} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
            {editingId === b.id ? (
              <div className="space-y-2">
                <input value={editName} onChange={e=>setEditName(e.target.value)} className={inp} placeholder="Name"/>
                <input type="number" step="0.01" value={editOpening} onChange={e=>setEditOpening(e.target.value)} className={inp} placeholder="Opening balance"/>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold btn-press flex items-center justify-center gap-1"><Check size={14}/> Save</button>
                  <button onClick={()=>setEditingId(null)} className="px-3 py-2 bg-navy-100 text-navy dark:text-white rounded-lg text-sm font-semibold btn-press"><X size={14}/></button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center"><Wallet size={18} className="text-navy dark:text-white"/></div>
                    <div>
                      <p className="font-bold text-navy dark:text-white">{b.name}</p>
                      <p className="text-navy dark:text-white text-xs">Opening: {fmtAED(b.openingBalance)}</p>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex gap-1">
                      <button onClick={()=>startEdit(b)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Pencil size={14}/></button>
                      <button onClick={()=>deleteBank(b.id, b.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={14}/></button>
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-navy dark:text-white">{fmtAED(b.currentBalance)}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold mb-4">Add Bank Account</h2>
          <div className="grid sm:grid-cols-3 gap-2">
            <input placeholder="Account name *" value={newName} onChange={e=>setNewName(e.target.value)} className={inp}/>
            <input type="number" step="0.01" placeholder="Opening balance *" value={newOpening} onChange={e=>setNewOpening(e.target.value)} className={inp}/>
            <button onClick={addBank} className="px-4 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press flex items-center justify-center gap-1"><Plus size={14}/> Add Account</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Recent Movements</h2>
          <select value={filterBank} onChange={e=>setFilterBank(e.target.value)} className={inp + " w-auto"}>
            <option value="">All accounts</option>{banks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          {filtered.length === 0 ? <p className="text-center py-8 text-navy dark:text-white-300">No movements.</p> :
            filtered.map(t => {
              const bank = banks.find(b=>b.id===t.bankAccountId);
              const Icon = t.amount > 0 ? TrendingUp : TrendingDown;
              const color = t.amount > 0 ? "text-green-600" : "text-red-500";
              return (
                <div key={t.id} className="flex items-center justify-between p-3 bg-navy-50/30 dark:bg-navy-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={color}/>
                    <div>
                      <p className="text-navy dark:text-white text-sm font-semibold">{t.description}</p>
                      <p className="text-navy dark:text-white text-xs">{fmtDate(t.date)} · {bank?.name} · {t.type}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${color}`}>{t.amount > 0 ? "+" : ""}{fmtAED(t.amount)}</span>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}