"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";

type Partner = { id: string; name: string; email: string; ownershipPct: number; contributed: number; withdrawn: number; distributed: number; netCapital: number };
type BankAccount = { id: string; name: string; currentBalance: number };
type PartnerTx = { id: string; partnerId: string; type: string; amount: number; date: string; note: string; bankAccountId: string };

export default function PartnersPage() {
  const { canWrite } = useRole();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [txs, setTxs] = useState<PartnerTx[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPct, setNewPct] = useState("");

  const [txPartner, setTxPartner] = useState("");
  const [txType, setTxType] = useState<"contribution" | "withdrawal" | "distribution">("contribution");
  const [txAmount, setTxAmount] = useState("");
  const [txBank, setTxBank] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txNote, setTxNote] = useState("");

  const load = async () => {
    try {
      const [p, b, t] = await Promise.all([
        apiCall<{partners: Partner[]}>("/api/partners"),
        apiCall<{accounts: BankAccount[]}>("/api/bank-accounts"),
        apiCall<{transactions: PartnerTx[]}>("/api/partner-transactions"),
      ]);
      setPartners(p.partners); setBanks(b.accounts); setTxs(t.transactions);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addPartner = async () => {
    if (!newName.trim()){ alert("Please add the partner name."); return; }
    await apiCall("/api/partners", { method: "POST", body: { name: newName, email: newEmail, ownershipPct: Number(newPct || 0) } });
    setNewName(""); setNewEmail(""); setNewPct(""); load();
  };

  const addTx = async () => {
    if (!txPartner) { alert("Please select a partner."); return; }
    if (!txAmount || isNaN(Number(txAmount)) || Number(txAmount) <= 0) { alert("Please add a valid amount."); return; }
    if (!txBank) { alert("Please select a bank account."); return; }
    await apiCall("/api/partner-transactions", { method: "POST", body: { partnerId: txPartner, type: txType, amount: Number(txAmount), bankAccountId: txBank, date: txDate, note: txNote } });
    setTxAmount(""); setTxNote(""); load();
  };

  const delTx = async (id: string) => {
    if (!confirm("Delete this transaction? The ledger entry will be reversed.")) return;
    await apiCall(`/api/partner-transactions?id=${id}`, { method: "DELETE" }); load();
  };

  if (loading) return <Loader fullScreen />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm placeholder:text-navy dark:text-white-300 dark:placeholder:text-navy dark:text-white";;
  const totalPct = partners.reduce((s,p) => s + p.ownershipPct, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <h2 className="font-latoxt-navy dark:text-white text-lg font-bold mb-4">Partners</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
              <th className="text-left py-2">Name</th><th className="text-left">Email</th><th className="text-right">Ownership</th>
              <th className="text-right">Contributed</th><th className="text-right">Withdrawn</th><th className="text-right">Distributed</th><th className="text-right">Net Capital</th>
            </tr></thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id} className="border-b border-navy-50">
                  <td className="py-2 font-semibold text-navy dark:text-white">{p.name}</td>
                  <td className="text-navy dark:text-white">{p.email}</td>
                  <td className="text-right">{p.ownershipPct}%</td>
                  <td className="text-right text-green-600">{fmtAED(p.contributed)}</td>
                  <td className="text-right text-red-500">{fmtAED(p.withdrawn)}</td>
                  <td className="text-right text-amber-600">{fmtAED(p.distributed)}</td>
                  <td className="text-right font-bold text-navy dark:text-white">{fmtAED(p.netCapital)}</td>
                </tr>
              ))}
              {partners.length > 0 && <tr><td colSpan={2} className="text-right py-2 text-navy dark:text-white text-xs">Total ownership:</td><td className={`text-right font-bold ${totalPct === 100 ? "text-green-600" : "text-amber-500"}`}>{totalPct}%</td><td colSpan={4}/></tr>}
            </tbody>
          </table>
        </div>

        {canWrite && (
          <div className="mt-4 pt-4 border-t border-navy-100 grid sm:grid-cols-4 gap-2">
            <input placeholder="Name" value={newName} onChange={e=>setNewName(e.target.value)} className={inp}/>
            <input placeholder="Email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} className={inp}/>
            <input type="number" placeholder="Ownership %" value={newPct} onChange={e=>setNewPct(e.target.value)} className={inp}/>
            <button onClick={addPartner} className="px-4 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press flex items-center justify-center gap-1"><Plus size={14}/> Add</button>
          </div>
        )}
      </div>

      {canWrite && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h2 className="font-latoxt-navy dark:text-white text-lg font-bold mb-4">Record Capital Movement</h2>
          <div className="grid sm:grid-cols-6 gap-2">
            <select value={txPartner} onChange={e=>setTxPartner(e.target.value)} className={inp}>
              <option value="">Partner</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={txType} onChange={e=>setTxType(e.target.value as any)} className={inp}>
              <option value="contribution">Contribution</option><option value="withdrawal">Withdrawal</option><option value="distribution">Distribution</option>
            </select>
            <input type="number" placeholder="Amount" value={txAmount} onChange={e=>setTxAmount(e.target.value)} className={inp}/>
            <select value={txBank} onChange={e=>setTxBank(e.target.value)} className={inp}>
              <option value="">Bank</option>{banks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input type="date" value={txDate} onChange={e=>setTxDate(e.target.value)} className={inp}/>
            <button onClick={addTx} className="px-4 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press">Record</button>
          </div>
          <input placeholder="Note (optional)" value={txNote} onChange={e=>setTxNote(e.target.value)} className={`${inp} mt-2`}/>
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <h2 className="font-latoxt-navy dark:text-white text-lg font-bold mb-4">Capital History</h2>
        <div className="space-y-2">
          {txs.length === 0 ? <p className="text-navy dark:text-white text-sm">No transactions yet.</p> :
            txs.map(t => {
              const p = partners.find(x => x.id === t.partnerId);
              const Icon = t.type === "contribution" ? TrendingUp : TrendingDown;
              const color = t.type === "contribution" ? "text-green-600" : "text-red-500";
              return (
                <div key={t.id} className="flex items-center justify-between p-3 bg-navy-50/30 dark:bg-navy-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={color}/>
                    <div>
                      <p className="text-navy dark:text-white font-latomibold text-sm">{p?.name || "—"} · {t.type}</p>
                      <p className="text-navy dark:text-white text-xs">{fmtDate(t.date)} {t.note && `— ${t.note}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${color}`}>{fmtAED(t.amount)}</span>
                    {canWrite && <button onClick={()=>delTx(t.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>}
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
