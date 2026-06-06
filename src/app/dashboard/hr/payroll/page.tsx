"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import { Play, Eye, AlertTriangle, CheckCircle2, History, ChevronDown, ChevronRight, X } from "lucide-react";

type Bank = { id: string; name: string };
type Allocation = { projectId: string; projectName: string; amount: number; assignmentId: string };
type EmployeeEntry = {
  employeeId: string;
  name: string;
  monthlySalary: number;
  allocations: Allocation[];
  totalCharge: number;
  unallocatedDays: number;
};
type Preview = {
  period: string;
  periodLabel: string;
  toPay: EmployeeEntry[];
  alreadyPaid: EmployeeEntry[];
  totalAmount: number;
  totalEmployees: number;
};
type PayrollRun = {
  id: string;
  period: string;
  periodLabel: string;
  totalEmployees: number;
  totalAmount: number;
  bankAccountId?: string;
  createdAt: string | null;
  createdBy: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayrollPage() {
  const { canWriteHR, canWriteAccounts, loading: roleLoading } = useRole();
  const canRun = canWriteHR && canWriteAccounts;
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bankAccountId, setBankAccountId] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pastRuns, setPastRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      const [b, r] = await Promise.all([
        apiCall<{ accounts: Bank[] }>("/api/bank-accounts"),
        apiCall<{ runs: PayrollRun[] }>("/api/payroll"),
      ]);
      setBanks(b.accounts || []);
      setPastRuns(r.runs || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const runPreview = async () => {
    setMessage(null);
    setPreviewing(true);
    try {
      const res = await apiCall<{ preview: Preview }>("/api/payroll", {
        method: "POST",
        body: { action: "preview", year, month },
      });
      setPreview(res.preview);
      setExpanded({});
    } catch (e: any) {
      setMessage({ kind: "err", text: e.message || "Preview failed." });
    } finally {
      setPreviewing(false);
    }
  };

  const runPayroll = async () => {
    if (!bankAccountId || !preview || preview.toPay.length === 0) return;
    setConfirmOpen(false);
    setRunning(true);
    setMessage(null);
    try {
      const res = await apiCall<{ totalAmount: number; totalEmployees: number; runId: string }>("/api/payroll", {
        method: "POST",
        body: { action: "run", year, month, bankAccountId },
      });
      setMessage({
        kind: "ok",
        text: `Paid ${res.totalEmployees} employee(s) — ${fmtAED(res.totalAmount)}. Run #${res.runId.slice(0, 8)}…`,
      });
      setPreview(null);
      load();
    } catch (e: any) {
      setMessage({ kind: "err", text: e.message || "Run failed." });
    } finally {
      setRunning(false);
    }
  };

  if (loading || roleLoading) return <Loader fullScreen />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm";

  const yearOptions: number[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) yearOptions.push(y);

  const bankName = (id?: string) => banks.find((b) => b.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Run Monthly Payroll card */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <h2 className="font-display text-navy dark:text-white text-lg font-bold mb-1">Run Monthly Payroll</h2>
        <p className="text-navy-400 text-xs mb-4">
          Pick a period to preview the proration across each employee's active project assignments, then run to post the charges.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inp}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inp}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inp}>
            <option value="">Bank account (needed to run)</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            onClick={runPreview}
            disabled={previewing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-navy hover:bg-navy-700 text-white dark:bg-gold dark:text-navy dark:hover:bg-gold-400 font-semibold rounded-lg text-sm btn-press disabled:opacity-50"
          >
            <Eye size={14} /> {previewing ? "Previewing…" : "Preview"}
          </button>
        </div>

        {!canRun && (
          <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Running payroll requires both HR and Accounts write permissions (admin role).</span>
          </div>
        )}

        {message && (
          <div className={`mt-3 p-2.5 border text-xs rounded-lg flex items-start gap-2 ${
            message.kind === "ok"
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
          }`}>
            {message.kind === "ok" ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Preview section */}
      {preview && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="font-display text-navy dark:text-white text-lg font-bold">
                Preview: {preview.periodLabel}
              </h2>
              <p className="text-navy-400 text-sm">
                {preview.totalEmployees} employee(s) to pay · <strong className="text-navy dark:text-white">{fmtAED(preview.totalAmount)}</strong> total
              </p>
            </div>
            {canRun && preview.toPay.length > 0 && (
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!bankAccountId || running}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm btn-press"
                title={!bankAccountId ? "Select a bank account first" : "Post payroll charges"}
              >
                <Play size={14} /> {running ? "Running…" : "Run Payroll"}
              </button>
            )}
          </div>

          {preview.toPay.length === 0 && preview.alreadyPaid.length === 0 && (
            <p className="text-navy-300 text-sm py-8 text-center">No eligible employees for this period.</p>
          )}

          {preview.toPay.length > 0 && (
            <div className="space-y-2">
              {preview.toPay.map((emp) => {
                const isOpen = !!expanded[emp.employeeId];
                return (
                  <div key={emp.employeeId} className="border border-navy-100 dark:border-navy-700 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [emp.employeeId]: !isOpen }))}
                      className="w-full flex items-center justify-between p-3 bg-navy-50 dark:bg-navy-700 hover:bg-navy-100 dark:hover:bg-navy-600 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-left">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <div>
                          <p className="font-bold text-navy dark:text-white text-sm">{emp.name}</p>
                          <p className="text-[11px] text-navy-400">
                            {emp.allocations.length} project{emp.allocations.length === 1 ? "" : "s"} · monthly salary {fmtAED(emp.monthlySalary)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-navy dark:text-white text-sm">{fmtAED(emp.totalCharge)}</p>
                        {emp.unallocatedDays > 0 && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                            {emp.unallocatedDays} unallocated day{emp.unallocatedDays === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="p-3 bg-white dark:bg-navy-800">
                        {emp.unallocatedDays > 0 && (
                          <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg flex items-start gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>
                              {emp.unallocatedDays} day{emp.unallocatedDays === 1 ? "" : "s"} of {emp.name}'s salary in {preview.periodLabel} are not allocated to any project. Either assign them retroactively or accept that this portion of their salary will not be charged.
                            </span>
                          </div>
                        )}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-navy-500 dark:text-navy-300 text-[10px] uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                              <th className="text-left py-1.5">Project</th>
                              <th className="text-right">Charge</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emp.allocations.map((a) => (
                              <tr key={a.projectId} className="border-b border-navy-50 dark:border-navy-700">
                                <td className="py-1.5 text-navy dark:text-white">{a.projectName}</td>
                                <td className="text-right font-semibold">{fmtAED(a.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {preview.alreadyPaid.length > 0 && (
            <div className="mt-6 pt-4 border-t border-navy-100 dark:border-navy-700">
              <p className="text-xs font-bold uppercase tracking-wider text-navy-400 mb-2">
                Already Paid ({preview.alreadyPaid.length})
              </p>
              <div className="space-y-1 opacity-75">
                {preview.alreadyPaid.map((emp) => (
                  <div key={emp.employeeId} className="flex justify-between items-center p-2 text-sm">
                    <div>
                      <span className="text-navy dark:text-white font-semibold">{emp.name}</span>
                      <span className="text-navy-400 text-xs ml-2">
                        ({emp.allocations.map((a) => a.projectName).join(", ")})
                      </span>
                    </div>
                    <span className="text-navy-500 dark:text-navy-300 text-xs">{fmtAED(emp.totalCharge)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past Payroll Runs */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-navy dark:text-white" />
          <h2 className="font-display text-navy dark:text-white text-lg font-bold">Past Payroll Runs</h2>
        </div>
        {pastRuns.length === 0 ? (
          <p className="text-navy-300 text-sm py-6 text-center">No payroll runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                  <th className="text-left py-2">Period</th>
                  <th className="text-left">Run On</th>
                  <th className="text-left">Run By</th>
                  <th className="text-left">Bank</th>
                  <th className="text-right">Employees</th>
                  <th className="text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {pastRuns.map((r) => (
                  <tr key={r.id} className="border-b border-navy-50 dark:border-navy-700">
                    <td className="py-2 font-semibold text-navy dark:text-white">{r.periodLabel || r.period}</td>
                    <td>{r.createdAt ? fmtDate(r.createdAt) : "—"}</td>
                    <td className="text-navy-500 dark:text-navy-300 text-xs">{r.createdBy || "—"}</td>
                    <td className="text-navy-500 dark:text-navy-300 text-xs">{bankName(r.bankAccountId)}</td>
                    <td className="text-right">{r.totalEmployees}</td>
                    <td className="text-right font-bold text-red-500">{fmtAED(r.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmOpen && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-navy dark:text-white">Confirm Payroll Run</h3>
              <button onClick={() => setConfirmOpen(false)} className="text-navy-400 hover:text-navy"><X size={18} /></button>
            </div>
            <p className="text-sm text-navy-500 dark:text-navy-300 mb-4">
              About to post <strong className="text-navy dark:text-white">{fmtAED(preview.totalAmount)}</strong> across {preview.totalEmployees} employee(s) for <strong className="text-navy dark:text-white">{preview.periodLabel}</strong>.
              Each project allocation creates a project expense and debits <strong className="text-navy dark:text-white">{bankName(bankAccountId)}</strong>.
            </p>
            <p className="text-xs text-navy-400 mb-4">
              You can safely re-run later — already-paid (employee, project) tuples will be skipped.
            </p>
            <div className="flex gap-2">
              <button
                onClick={runPayroll}
                disabled={running}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm btn-press"
              >
                {running ? "Running…" : "Confirm — Post Payroll"}
              </button>
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 bg-navy-100 dark:bg-navy-600 text-navy dark:text-white font-semibold rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
