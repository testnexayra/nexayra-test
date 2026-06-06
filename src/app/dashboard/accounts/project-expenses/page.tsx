"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import SuggestInput from "@/components/SuggestInput";
import Loader from "@/components/Loader";
import { Plus, Trash2, Settings, Upload, Eye, Download, X, Sparkles, Loader2 } from "lucide-react";
import ProjectCodeInput, { type ProjectLookup } from "@/components/ProjectCodeInput";

type PEItemForm = {
  description: string;
  categoryId: string;
  qty: string;
  unit: string;
  amount: string;
};

type PEItem = {
  description: string;
  categoryId: string;
  qty: number;
  unit: string;
  amount: number;
};

type PE = {
  id: string;
  projectId: string;
  date: string;
  items: PEItem[];
  totalAmount: number;
  bankAccountId: string;
  vendor: string;
  paidBy: string;
  paymentMode: string;
  paymentModeCustom: string;
  billData: string;
  billName: string;
  billType: string;
  expenseType: string;
};

type Category = { id: string; name: string; scope: string };
type Bank = { id: string; name: string };
type Project = { id: string; name: string; code: string };

const MAX_BILL_BYTES = 700 * 1024;
const EMPTY_ITEM: PEItemForm = { description: "", categoryId: "", qty: "1", unit: "", amount: "" };

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

export default function ProjectExpensesPage() {
  const { canWrite } = useRole();
  const [expenses, setExpenses] = useState<PE[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState("");
  const [showCatManager, setShowCatManager] = useState(false);
  const [viewBill, setViewBill] = useState<PE | null>(null);

  const [projectId, setProjectId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<PEItemForm[]>([{ ...EMPTY_ITEM }]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [vendor, setVendor] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentModeCustom, setPaymentModeCustom] = useState("");
  const [expenseType, setExpenseType] = useState("material");
  const [billData, setBillData] = useState("");
  const [billName, setBillName] = useState("");
  const [billType, setBillType] = useState("");
  const [uploadError, setUploadError] = useState("");

  const [newCat, setNewCat] = useState("");

  const [aiScanning, setAiScanning] = useState(false);
  const [aiPreview, setAiPreview] = useState<{
    vendor: string;
    amount: string;
    date: string;
    description: string;
    currency: string;
    items?: { description: string; qty: number; unit: string; amount: number }[];
  } | null>(null);

  const load = async () => {
    try {
      const [e, c, b, p] = await Promise.all([
        apiCall<{ expenses: PE[] }>("/api/project-expenses"),
        apiCall<{ categories: Category[] }>("/api/expense-categories"),
        apiCall<{ accounts: Bank[] }>("/api/bank-accounts"),
        apiCall<{ projects: Project[] }>("/api/accounts-projects"),
      ]);
      setExpenses(e.expenses);
      setCats(c.categories);
      setBanks(b.accounts);
      setProjects(p.projects);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateItem = (i: number, field: keyof PEItemForm, value: string) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, [field]: value } : it)));

  const addItemRow = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);

  const removeItemRow = (i: number) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => j !== i)));

  const formTotal = items.reduce((s, it) => s + (Number(it.qty) || 1) * (Number(it.amount) || 0), 0);

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
    if (aiPreview.date) setDate(aiPreview.date);

    const aiItems = aiPreview.items || [];
    if (aiItems.length > 0) {
      const mapped: PEItemForm[] = aiItems.map((it) => ({
        description: it.description || "",
        categoryId: "",
        qty: String(it.qty || 1),
        unit: it.unit || "",
        amount: String(it.amount || ""),
      }));
      setItems((prev) => {
        const allEmpty = prev.length === 1 && !prev[0].description && !prev[0].amount;
        return allEmpty ? mapped : [...prev, ...mapped];
      });
    } else {
      // Fallback: single-line legacy behavior — fill first row's empty fields
      setItems((prev) => {
        const copy = [...prev];
        if (aiPreview.description && !copy[0].description) copy[0] = { ...copy[0], description: aiPreview.description };
        if (aiPreview.amount && !copy[0].amount) copy[0] = { ...copy[0], amount: aiPreview.amount };
        return copy;
      });
    }
    setAiPreview(null);
  };

  const clearBill = () => { setBillData(""); setBillName(""); setBillType(""); setUploadError(""); };

  const resetForm = () => {
    setItems([{ ...EMPTY_ITEM }]);
    setVendor(""); setPaidBy(""); setPaymentMode(""); setPaymentModeCustom("");
    setExpenseType("material"); clearBill();
    setProjectId(""); setProjectCode("");
  };

  const add = async () => {
    if (!projectId) { alert("Please enter a valid project code."); return; }
    if (!date) { alert("Please select a date."); return; }
    if (!bankAccountId) { alert("Please select a bank account."); return; }
    if (!paidBy.trim()) { alert("Please add who paid."); return; }
    if (!paymentMode) { alert("Please select a payment mode."); return; }
    if (paymentMode === "custom" && !paymentModeCustom.trim()) { alert("Please specify the custom payment mode."); return; }

    const cleanItems = items
      .map((it) => ({
        description: it.description.trim(),
        categoryId: it.categoryId,
        qty: Number(it.qty) || 1,
        unit: it.unit.trim(),
        amount: Number(it.amount) || 0,
      }))
      .filter((it) => it.description || it.amount);

    if (cleanItems.length === 0) { alert("Add at least one item with description and amount."); return; }

    for (let i = 0; i < cleanItems.length; i++) {
      const it = cleanItems[i];
      if (!it.description) { alert(`Item ${i + 1}: description required.`); return; }
      if (!it.categoryId) { alert(`Item ${i + 1}: category required.`); return; }
      if (it.amount <= 0) { alert(`Item ${i + 1}: amount must be greater than 0.`); return; }
    }

    await apiCall("/api/project-expenses", {
      method: "POST",
      body: {
        projectId, date, items: cleanItems,
        bankAccountId, vendor, paidBy, paymentMode, paymentModeCustom,
        billData, billName, billType, expenseType,
      },
    });
    resetForm();
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this expense (all items)?")) return;
    await apiCall(`/api/project-expenses?id=${id}`, { method: "DELETE" });
    load();
  };

  const addCat = async () => {
    if (!newCat.trim()) return;
    await apiCall("/api/expense-categories", { method: "POST", body: { name: newCat, scope: "project" } });
    setNewCat(""); load();
  };
  const delCat = async (id: string) => {
    if (!confirm("Delete category?")) return;
    await apiCall(`/api/expense-categories?id=${id}`, { method: "DELETE" });
    load();
  };

  const downloadBill = (e: PE) => {
    if (!e.billData) return;
    const a = document.createElement("a");
    a.href = e.billData; a.download = e.billName || "bill"; a.click();
  };

  if (loading) return <Loader fullScreen />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm placeholder:text-navy dark:text-white-300 dark:placeholder:text-navy dark:text-white";
  const projCats = cats.filter((c) => c.scope === "project" || c.scope === "both");
  const filtered = filterProject ? expenses.filter((e) => e.projectId === filterProject) : expenses;

  // Flatten items so each item is a row in the register
  const flatRows = filtered.flatMap((e) =>
    (e.items || []).map((it, idx) => ({
      expense: e,
      item: it,
      itemIdx: idx,
      isFirst: idx === 0,
      itemCount: e.items?.length || 1,
    }))
  );
  const grandTotal = flatRows.reduce((s, r) => s + r.item.amount * (r.item.qty || 1), 0);

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Record Project Expense</h2>
            <button onClick={() => setShowCatManager(!showCatManager)} className="flex items-center gap-1 text-navy dark:text-white hover:text-navy text-sm">
              <Settings size={14} /> Manage Categories
            </button>
          </div>

          {showCatManager && (
            <div className="mb-4 p-4 bg-navy-50 dark:bg-navy-700 rounded-xl">
              <div className="flex gap-2 mb-3">
                <input placeholder="New category (project)" value={newCat} onChange={(e) => setNewCat(e.target.value)} className={inp} />
                <button onClick={addCat} className="px-4 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press">Add</button>
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

          {/* Project code (full-width, dropdown floats over the rest) */}
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

          {/* Header fields (apply to all items) */}
          <div className="relative z-0 grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
            <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inp}>
              <option value="">Bank</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <SuggestInput field="vendor" value={vendor} onChange={setVendor} placeholder="Vendor (optional)" className={inp} />
            <SuggestInput field="paidBy" value={paidBy} onChange={setPaidBy} placeholder="Paid By" className={inp} />
            <select value={paymentMode} onChange={(e) => { setPaymentMode(e.target.value); if (e.target.value !== "custom") setPaymentModeCustom(""); }} className={inp}>
              <option value="">Payment Mode</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="custom">Custom</option>
            </select>
            <select value={expenseType} onChange={(e) => setExpenseType(e.target.value)} className={inp}>
              <option value="material">Material</option>
              <option value="Subcontractor">Subcontractor</option>
              <option value="Company Manpower">Company Manpower</option>
              <option value="equipment">Equipment</option>
              <option value="misc">Miscellaneous</option>
              <option value="Petty Cash">Petty Cash</option>
            </select>
            {paymentMode === "custom" && (
              <input placeholder="Specify payment mode" value={paymentModeCustom} onChange={(e) => setPaymentModeCustom(e.target.value)} className={inp} />
            )}
          </div>

          {/* Items */}
          <h3 className="text-navy dark:text-white font-bold text-sm uppercase tracking-wider mt-6 mb-3 pb-2 border-b border-navy-100 dark:border-navy-700">Items</h3>
          <div className="hidden md:grid grid-cols-[1fr_10rem_5rem_6rem_7rem_3rem] gap-2 mb-2 text-navy-400 dark:text-white-300 text-xs font-bold uppercase tracking-wider px-1">
            <div>Description</div>
            <div>Category</div>
            <div>Qty</div>
            <div>Unit</div>
            <div>Amount</div>
            <div />
          </div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_10rem_5rem_6rem_7rem_3rem] gap-2 mb-3 items-start">
              <textarea
                placeholder="Description"
                value={it.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
                className={`${inp} min-h-[56px] resize-y`}
                rows={2}
              />
              <select value={it.categoryId} onChange={(e) => updateItem(i, "categoryId", e.target.value)} className={inp}>
                <option value="">Category</option>
                {projCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" min="0" step="0.01" placeholder="Qty" value={it.qty} onChange={(e) => updateItem(i, "qty", e.target.value)} className={inp} />
              <input placeholder="Unit" value={it.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className={inp} />
              <input type="number" min="0" step="0.01" placeholder="Amount" value={it.amount} onChange={(e) => updateItem(i, "amount", e.target.value)} className={inp} />
              <button
                onClick={() => removeItemRow(i)}
                disabled={items.length === 1}
                className="w-full md:w-12 h-[42px] bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed btn-press flex items-center justify-center"
                title="Remove item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={addItemRow} className="mt-2 mb-4 px-4 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm font-semibold hover:bg-navy-100 dark:hover:bg-navy-600 btn-press flex items-center gap-1">
            <Plus size={14} /> Add Item
          </button>

          <div className="mb-4 p-3 bg-navy-50 dark:bg-navy-700 rounded-lg flex justify-between items-center">
            <span className="text-navy dark:text-white text-sm font-semibold">Total</span>
            <span className="text-navy dark:text-white text-lg font-bold">{fmtAED(formTotal)}</span>
          </div>

          {/* Bill upload + AI scan + submit */}
          <div className="mt-3 flex flex-wrap gap-3 items-center">
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
            <button onClick={add} className="ml-auto px-5 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press flex items-center gap-1">
              <Plus size={14} /> Add Expense
            </button>
          </div>

          {aiPreview && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl animate-scale-in">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-purple-600" />
                <h3 className="font-bold text-purple-900 dark:text-purple-300 text-sm">AI extracted from bill:</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-sm mb-2">
                <div><span className="text-navy dark:text-white">Vendor:</span> <strong className="text-navy dark:text-white">{aiPreview.vendor || "—"}</strong></div>
                <div><span className="text-navy dark:text-white">Total:</span> <strong className="text-navy dark:text-white">{aiPreview.currency} {aiPreview.amount || "—"}</strong></div>
                <div><span className="text-navy dark:text-white">Date:</span> <strong className="text-navy dark:text-white">{aiPreview.date || "—"}</strong></div>
                <div><span className="text-navy dark:text-white">Summary:</span> <strong className="text-navy dark:text-white">{aiPreview.description || "—"}</strong></div>
              </div>
              {aiPreview.items && aiPreview.items.length > 1 && (
                <div className="mb-3 p-3 bg-white dark:bg-navy-800 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs font-bold text-purple-900 dark:text-purple-300 mb-2">Found {aiPreview.items.length} items:</p>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {aiPreview.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="text-navy dark:text-white truncate">• {it.description || "(no description)"}{it.qty > 1 ? ` × ${it.qty}` : ""}{it.unit ? ` ${it.unit}` : ""}</span>
                        <span className="text-navy dark:text-white font-semibold tabular-nums">{fmtAED(it.amount * (it.qty || 1))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
                {aiPreview.items && aiPreview.items.length > 0
                  ? "Items will replace empty rows or append new rows. You'll still need to set the category."
                  : "Applies to the first item row (only fills empty fields)."}
              </p>
              <div className="flex gap-2">
                <button onClick={applyAiPreview} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-semibold btn-press">Apply</button>
                <button onClick={() => setAiPreview(null)} className="px-3 py-1.5 bg-white dark:bg-navy-700 border border-navy-200 dark:border-navy-600 text-navy dark:text-white rounded-lg text-sm font-semibold btn-press">Dismiss</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Project Expenses Register</h2>
          <div className="flex items-center gap-3">
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className={inp + " w-auto"}>
              <option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="text-navy dark:text-white text-sm">Total: <strong className="text-red-500">{fmtAED(grandTotal)}</strong></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                <th className="text-left py-2">Date</th>
                <th className="text-left">Project</th>
                <th className="text-left">Category</th>
                <th className="text-left">Description</th>
                <th className="text-right">Qty</th>
                <th className="text-left">Unit</th>
                <th className="text-left">Vendor</th>
                <th className="text-left">Type</th>
                <th className="text-left">Paid By</th>
                <th className="text-left">Mode</th>
                <th className="text-left">Bill</th>
                <th className="text-right">Amount</th>
                {canWrite && <th />}
              </tr>
            </thead>
            <tbody>
              {flatRows.length === 0 ? (
                <tr><td colSpan={13} className="py-8 text-center text-navy dark:text-white-300">No project expenses.</td></tr>
              ) : flatRows.map((r) => {
                const lineAmt = (r.item.amount || 0) * (r.item.qty || 1);
                return (
                  <tr key={`${r.expense.id}-${r.itemIdx}`} className={`border-b border-navy-50 ${r.isFirst ? "" : "bg-navy-50/30 dark:bg-navy-900/30"}`}>
                    <td className="py-2">{r.isFirst ? fmtDate(r.expense.date) : ""}</td>
                    <td className="font-semibold text-navy dark:text-white">{r.isFirst ? (projects.find((p) => p.id === r.expense.projectId)?.name || "-") : ""}</td>
                    <td>{cats.find((c) => c.id === r.item.categoryId)?.name || "-"}</td>
                    <td className="whitespace-pre-wrap">{r.item.description}</td>
                    <td className="text-right">{r.item.qty || 1}</td>
                    <td>{r.item.unit || "-"}</td>
                    <td className="text-navy dark:text-white">{r.isFirst ? r.expense.vendor : ""}</td>
                    <td className="capitalize text-xs">{r.isFirst ? (r.expense.expenseType || "material") : ""}</td>
                    <td>{r.isFirst ? (r.expense.paidBy || "-") : ""}</td>
                    <td className="capitalize">{r.isFirst ? (r.expense.paymentMode === "custom" ? r.expense.paymentModeCustom : (r.expense.paymentMode || "-")) : ""}</td>
                    <td>
                      {r.isFirst && r.expense.billData ? (
                        <div className="flex gap-1">
                          <button onClick={() => setViewBill(r.expense)} className="text-blue-600 hover:text-blue-800" title="View"><Eye size={14} /></button>
                          <button onClick={() => downloadBill(r.expense)} className="text-navy dark:text-white hover:text-navy-700" title="Download"><Download size={14} /></button>
                        </div>
                      ) : r.isFirst ? <span className="text-navy dark:text-white-300 text-xs">—</span> : ""}
                    </td>
                    <td className="text-right font-semibold text-red-500">{fmtAED(lineAmt)}</td>
                    {canWrite && <td>{r.isFirst ? <button onClick={() => del(r.expense.id)} className="text-red-500" title="Delete expense"><Trash2 size={14} /></button> : ""}</td>}
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
                <button onClick={() => downloadBill(viewBill)} className="px-3 py-1.5 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors rounded-lg text-sm font-semibold flex items-center gap-1"><Download size={14} /> Download</button>
                <button onClick={() => setViewBill(null)} className="p-1.5 text-navy dark:text-white hover:text-navy-700"><X size={18} /></button>
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