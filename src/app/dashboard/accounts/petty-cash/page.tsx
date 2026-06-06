"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import SuggestInput from "@/components/SuggestInput";
import Loader from "@/components/Loader";
import ProjectCodeInput, { type ProjectLookup } from "@/components/ProjectCodeInput";
import { Plus, Trash2, Upload, Eye, Download, X, Sparkles, Loader2, Wallet, Settings } from "lucide-react";

type TxnType = "allocation" | "expense" | "reimbursement";

type Txn = {
  id: string;
  type: TxnType;
  projectId: string;
  date: string;
  amount: number;
  description: string;
  bankAccountId: string;
  categoryId: string;
  vendor: string;
  paidBy: string;
  billData: string;
  billName: string;
  billType: string;
};

type Bank = { id: string; name: string };
type Project = { id: string; name: string; code: string };
type Category = { id: string; name: string; scope: string };

const MAX_BILL_BYTES = 700 * 1024;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

export default function PettyCashPage() {
  const { canWrite } = useRole();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewBill, setViewBill] = useState<Txn | null>(null);

  // Form
  const [type, setType] = useState<TxnType>("allocation");
  const [projectId, setProjectId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [vendor, setVendor] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [billData, setBillData] = useState("");
  const [billName, setBillName] = useState("");
  const [billType, setBillType] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [aiScanning, setAiScanning] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ vendor: string; amount: string; date: string; description: string; currency: string } | null>(null);

  const [showCatManager, setShowCatManager] = useState(false);
  const [newCat, setNewCat] = useState("");

  // Filters
  const [filterProject, setFilterProject] = useState("");
  const [filterType, setFilterType] = useState<"" | TxnType>("");

  const load = async () => {
    try {
      const [t, b, p, c] = await Promise.all([
        apiCall<{ transactions: Txn[] }>("/api/petty-cash"),
        apiCall<{ accounts: Bank[] }>("/api/bank-accounts"),
        apiCall<{ projects: Project[] }>("/api/accounts-projects"),
        apiCall<{ categories: Category[] }>("/api/expense-categories"),
      ]);
      setTxns(t.transactions);
      setBanks(b.accounts);
      setProjects(p.projects);
      setCats(c.categories);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleFile = async (file: File) => {
    setUploadError("");
    if (file.size > MAX_BILL_BYTES) {
      setUploadError(`File too large (${(file.size / 1024).toFixed(0)} KB). Max 700 KB.`);
      return;
    }
    try {
      const data = await fileToBase64(file);
      setBillData(data); setBillName(file.name); setBillType(file.type);
    } catch {
      setUploadError("Failed to read file.");
    }
  };
  const clearBill = () => { setBillData(""); setBillName(""); setBillType(""); setUploadError(""); };

  const scanBill = async () => {
    if (!billData) { alert("Upload a bill first."); return; }
    setAiScanning(true); setAiPreview(null);
    try {
      const res = await apiCall<{ extracted: any }>("/api/ai-scan-bill", { method: "POST", body: { billData, billType } });
      setAiPreview(res.extracted);
    } catch (e: any) {
      alert("AI scan failed: " + (e.message || "unknown error"));
    } finally {
      setAiScanning(false);
    }
  };
  const applyAiPreview = () => {
    if (!aiPreview) return;
    if (aiPreview.vendor) setVendor(aiPreview.vendor);
    if (aiPreview.amount && !amount) setAmount(aiPreview.amount);
    if (aiPreview.date) setDate(aiPreview.date);
    if (aiPreview.description && !description) setDescription(aiPreview.description);
    setAiPreview(null);
  };

  const resetForm = () => {
    setAmount(""); setDescription(""); setVendor(""); setPaidBy("");
    setCategoryId(""); clearBill();
    setProjectId(""); setProjectCode("");
  };

  const submit = async () => {
    if (!projectId) { alert("Please enter a valid project code."); return; }
    if (!date) { alert("Please select a date."); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { alert("Please add a valid amount."); return; }
    if ((type === "allocation" || type === "reimbursement") && !bankAccountId) {
      alert("Please select a bank account."); return;
    }

    setSubmitting(true);
    try {
      await apiCall("/api/petty-cash", {
        method: "POST",
        body: {
          type, projectId, date, amount: Number(amount), description,
          bankAccountId: type === "expense" ? "" : bankAccountId,
          categoryId: type === "expense" ? categoryId : "",
          vendor: type === "expense" ? vendor : "",
          paidBy: type === "expense" ? paidBy : "",
          billData: type === "expense" ? billData : "",
          billName: type === "expense" ? billName : "",
          billType: type === "expense" ? billType : "",
        },
      });
      resetForm();
      load();
    } catch (e: any) {
      alert("Save failed: " + (e.message || "unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const addCat = async () => {
    if (!newCat.trim()) return;
    await apiCall("/api/expense-categories", { method: "POST", body: { name: newCat, scope: "petty-cash" } });
    setNewCat(""); load();
  };
  const delCat = async (id: string) => {
    if (!confirm("Delete category?")) return;
    await apiCall(`/api/expense-categories?id=${id}`, { method: "DELETE" });
    load();
  };

  const del = async (id: string, t: TxnType) => {
    const msg = t === "expense"
      ? "Delete this petty cash expense?"
      : "Delete this petty cash transaction? Bank ledger entry will be reversed.";
    if (!confirm(msg)) return;
    await apiCall(`/api/petty-cash?id=${id}`, { method: "DELETE" });
    load();
  };

  const downloadBill = (t: Txn) => {
    if (!t.billData) return;
    const a = document.createElement("a");
    a.href = t.billData; a.download = t.billName || "bill"; a.click();
  };

  // Per-project balances
  const balances = useMemo(() => {
    const map = new Map<string, { allocated: number; spent: number; reimbursed: number }>();
    txns.forEach((t) => {
      const cur = map.get(t.projectId) || { allocated: 0, spent: 0, reimbursed: 0 };
      if (t.type === "allocation") cur.allocated += t.amount;
      else if (t.type === "expense") cur.spent += t.amount;
      else if (t.type === "reimbursement") cur.reimbursed += t.amount;
      map.set(t.projectId, cur);
    });
    return Array.from(map.entries()).map(([pid, v]) => ({
      projectId: pid,
      projectName: projects.find((p) => p.id === pid)?.name || "(unknown)",
      projectCode: projects.find((p) => p.id === pid)?.code || "",
      ...v,
      balance: v.allocated + v.reimbursed - v.spent,
    }));
  }, [txns, projects]);

  const filteredBalances = filterProject
    ? balances.filter((b) => b.projectId === filterProject)
    : balances;

  const filteredTxns = txns.filter((t) =>
    (!filterProject || t.projectId === filterProject) &&
    (!filterType || t.type === filterType)
  );

  if (loading) return <Loader fullScreen />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm placeholder:text-navy-400 dark:placeholder:text-navy-300";
  const pettyCats = cats.filter((c) => c.scope === "petty-cash" || c.scope === "both");

  const balanceColor = (b: number) => {
    if (b <= 0) return "text-red-500";
    if (b < 100) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };
  const balanceBg = (b: number) => {
    if (b <= 0) return "bg-red-50 dark:bg-red-900/20";
    if (b < 100) return "bg-amber-50 dark:bg-amber-900/20";
    return "bg-emerald-50 dark:bg-emerald-900/20";
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Record Transaction */}
      {canWrite && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet size={20} className="text-navy dark:text-white" />
              <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Record Petty Cash Transaction</h2>
            </div>
            <button onClick={() => setShowCatManager(!showCatManager)} className="flex items-center gap-1 text-navy dark:text-white hover:text-navy text-sm">
              <Settings size={14} /> Manage Categories
            </button>
          </div>

          {showCatManager && (
            <div className="mb-4 p-4 bg-navy-50 dark:bg-navy-700 rounded-xl">
              <div className="flex gap-2 mb-3">
                <input placeholder="New category (petty-cash)" value={newCat} onChange={(e) => setNewCat(e.target.value)} className={inp} />
                <button onClick={addCat} className="px-4 py-2 bg-navy text-white dark:bg-gold dark:text-navy font-semibold rounded-lg text-sm btn-press">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-navy-200 rounded-full text-xs">
                    {c.name} <span className="text-navy dark:text-white-300 text-[10px]">({c.scope})</span>
                    <button onClick={() => delCat(c.id)} className="text-red-500"><Trash2 size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2 mb-4 p-1 bg-navy-50 dark:bg-navy-700 rounded-xl">
            {(["allocation", "expense", "reimbursement"] as TxnType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  type === t
                    ? "bg-white dark:bg-navy-800 text-navy dark:text-white shadow-sm"
                    : "text-navy-500 dark:text-navy-300 hover:text-navy dark:hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Project code */}
          <div className="relative z-30 mb-3">
            <ProjectCodeInput
              label="Project Code"
              required
              value={projectCode}
              onChange={setProjectCode}
              onProjectFound={(p: ProjectLookup) => { setProjectId(p.id); setProjectCode(p.code); }}
              onProjectCleared={() => setProjectId("")}
            />
          </div>

          {/* Common fields */}
          <div className="relative z-0 grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
            <input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
            <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inp} sm:col-span-2`} />
          </div>

          {/* Allocation / reimbursement → bank */}
          {(type === "allocation" || type === "reimbursement") && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inp}>
                <option value="">Bank Account *</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Expense → vendor/paidBy/category */}
          {type === "expense" && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                <SuggestInput field="vendor" value={vendor} onChange={setVendor} placeholder="Vendor (optional)" className={inp} />
                <SuggestInput field="paidBy" value={paidBy} onChange={setPaidBy} placeholder="Paid By" className={inp} />
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inp}>
                  <option value="">Category (optional)</option>
                  {pettyCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Bill upload + AI scan */}
              <div className="flex flex-wrap gap-3 items-center mb-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm font-semibold cursor-pointer hover:bg-navy-100 dark:hover:bg-navy-600">
                  <Upload size={14} /> Upload Bill (optional)
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                </label>
                {billName && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg text-sm">
                      <span className="text-green-700 dark:text-green-400 font-semibold">{billName}</span>
                      <button onClick={clearBill} className="text-red-500"><X size={14} /></button>
                    </div>
                    <button onClick={scanBill} disabled={aiScanning} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 btn-press">
                      {aiScanning ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><Sparkles size={14} /> AI Scan Bill</>}
                    </button>
                  </>
                )}
                {uploadError && <span className="text-red-500 text-sm">{uploadError}</span>}
              </div>

              {aiPreview && (
                <div className="mb-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-purple-600" />
                    <h3 className="font-bold text-purple-900 dark:text-purple-300 text-sm">AI extracted from bill:</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm mb-3">
                    <div><span className="text-navy dark:text-white">Vendor:</span> <strong>{aiPreview.vendor || "—"}</strong></div>
                    <div><span className="text-navy dark:text-white">Amount:</span> <strong>{aiPreview.currency} {aiPreview.amount || "—"}</strong></div>
                    <div><span className="text-navy dark:text-white">Date:</span> <strong>{aiPreview.date || "—"}</strong></div>
                    <div><span className="text-navy dark:text-white">Description:</span> <strong>{aiPreview.description || "—"}</strong></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={applyAiPreview} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-semibold btn-press">Apply to form</button>
                    <button onClick={() => setAiPreview(null)} className="px-3 py-1.5 bg-white dark:bg-navy-700 border border-navy-200 dark:border-navy-600 text-navy dark:text-white rounded-lg text-sm font-semibold btn-press">Dismiss</button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={submitting}
              className="px-5 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press flex items-center gap-1 disabled:opacity-50"
            >
              <Plus size={14} /> {submitting ? "Saving…" : "Record Transaction"}
            </button>
          </div>
        </div>
      )}

      {/* Section 2: Per-project balances */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Per-Project Balances</h2>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className={inp + " w-auto"}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                <th className="text-left py-2">Project</th>
                <th className="text-right">Allocated</th>
                <th className="text-right">Spent</th>
                <th className="text-right">Reimbursed</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-navy dark:text-white-300">No petty cash activity.</td></tr>
              ) : filteredBalances.map((b) => (
                <tr key={b.projectId} className={`border-b border-navy-50 dark:border-navy-700 ${balanceBg(b.balance)}`}>
                  <td className="py-2 font-semibold text-navy dark:text-white">
                    {b.projectName} <span className="text-xs text-navy-400 font-normal">({b.projectCode})</span>
                  </td>
                  <td className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">{fmtAED(b.allocated)}</td>
                  <td className="text-right text-red-500 font-semibold">{fmtAED(b.spent)}</td>
                  <td className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">{fmtAED(b.reimbursed)}</td>
                  <td className={`text-right font-bold ${balanceColor(b.balance)}`}>{fmtAED(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Transaction Register */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Transaction Register</h2>
          <div className="flex gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className={inp + " w-auto"}>
              <option value="">All types</option>
              <option value="allocation">Allocation</option>
              <option value="expense">Expense</option>
              <option value="reimbursement">Reimbursement</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                <th className="text-left py-2">Date</th>
                <th className="text-left">Project</th>
                <th className="text-left">Type</th>
                <th className="text-left">Description</th>
                <th className="text-left">Vendor</th>
                <th className="text-right">Amount</th>
                <th className="text-left">Bank</th>
                <th className="text-left">Bill</th>
                {canWrite && <th />}
              </tr>
            </thead>
            <tbody>
              {filteredTxns.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-navy dark:text-white-300">No transactions yet.</td></tr>
              ) : filteredTxns.map((t) => {
                const amtColor = t.type === "expense" ? "text-red-500" : "text-emerald-600 dark:text-emerald-400";
                const sign = t.type === "expense" ? "−" : "+";
                return (
                  <tr key={t.id} className="border-b border-navy-50 dark:border-navy-700">
                    <td className="py-2">{fmtDate(t.date)}</td>
                    <td className="font-semibold text-navy dark:text-white">{projects.find((p) => p.id === t.projectId)?.name || "-"}</td>
                    <td>
                      <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                        t.type === "allocation" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                        t.type === "expense" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      }`}>{t.type}</span>
                    </td>
                    <td className="whitespace-pre-wrap">{t.description || "-"}</td>
                    <td>{t.type === "expense" ? (t.vendor || "-") : "-"}</td>
                    <td className={`text-right font-bold ${amtColor}`}>{sign} {fmtAED(t.amount)}</td>
                    <td>{(t.type === "allocation" || t.type === "reimbursement") ? (banks.find((b) => b.id === t.bankAccountId)?.name || "-") : "-"}</td>
                    <td>
                      {t.type === "expense" && t.billData ? (
                        <div className="flex gap-1">
                          <button onClick={() => setViewBill(t)} className="text-blue-600 hover:text-blue-800" title="View"><Eye size={14} /></button>
                          <button onClick={() => downloadBill(t)} className="text-navy dark:text-white hover:text-navy-700" title="Download"><Download size={14} /></button>
                        </div>
                      ) : <span className="text-navy dark:text-white-300 text-xs">—</span>}
                    </td>
                    {canWrite && <td><button onClick={() => del(t.id, t.type)} className="text-red-500"><Trash2 size={14} /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {viewBill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-scale-in" onClick={() => setViewBill(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-navy-100 dark:border-navy-700">
              <h3 className="font-bold text-navy dark:text-white">{viewBill.billName}</h3>
              <div className="flex gap-2">
                <button onClick={() => downloadBill(viewBill)} className="px-3 py-1.5 bg-navy text-white dark:bg-gold dark:text-navy rounded-lg text-sm font-semibold flex items-center gap-1"><Download size={14} /> Download</button>
                <button onClick={() => setViewBill(null)} className="p-1.5 text-navy dark:text-white"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-navy-50">
              {viewBill.billType.startsWith("image/") ? (
                <img src={viewBill.billData} alt={viewBill.billName} className="max-w-full max-h-full" />
              ) : viewBill.billType === "application/pdf" ? (
                <iframe src={viewBill.billData} className="w-full h-[70vh]" title={viewBill.billName} />
              ) : (
                <p className="text-navy dark:text-white">Preview not available. Use Download instead.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
