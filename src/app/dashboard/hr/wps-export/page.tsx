"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/use-role";
import { auth } from "@/lib/firebase";
import WelcomeBanner from "@/components/WelcomeBanner";
import Loader from "@/components/Loader";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function WPSExportPage() {
  const { role, loading: roleLoading } = useRole();
  const now = new Date();

  const [form, setForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    employerEID: "",
    employerBankCode: "",
    fileReference: "",
  });
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [lastFile, setLastFile] = useState<string | null>(null);

  if (roleLoading) return <Loader />;

  if (!["admin", "hr", "accounts"].includes(role || "")) {
    return <div className="text-center py-16 text-red-500">403 — WPS export is restricted to HR / Accounts / Admin.</div>;
  }

  const handleExport = async () => {
    if (!form.employerEID.trim()) return setError("Employer EID is required.");
    setError("");
    setDownloading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/wps-export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `WPS_${form.year}_${String(form.month).padStart(2, "0")}.sif`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setLastFile(filename);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const inp = "w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-navy dark:text-white focus:outline-none focus:border-gold transition-all";

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/dashboard/hr" className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to HR
      </Link>

      <WelcomeBanner tagline="Generate UAE-compliant Wage Protection System salary files in seconds." compact />

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <FileSpreadsheet size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-navy dark:text-white">WPS Export</h2>
            <p className="text-navy-400 text-xs">Salary Information File (.sif) — accepted by all UAE banks</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
          Only employees with both <strong>monthlySalary</strong> and <strong>bankIBAN</strong> set will be included. Update employee records in HR if any are missing.
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Salary Month</label>
            <select value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} className={inp}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Year</label>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={inp} />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Employer EID *</label>
          <input value={form.employerEID} onChange={(e) => setForm({ ...form, employerEID: e.target.value })} placeholder="MOL Establishment ID" className={inp} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Employer Bank Code</label>
            <input value={form.employerBankCode} onChange={(e) => setForm({ ...form, employerBankCode: e.target.value })} placeholder="e.g. ENBD" className={inp} />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">File Reference (optional)</label>
            <input value={form.fileReference} onChange={(e) => setForm({ ...form, fileReference: e.target.value })} placeholder="Auto if blank" className={inp} />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}

        {lastFile && (
          <p className="text-emerald-700 dark:text-emerald-300 text-sm bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
            ✓ Downloaded <strong>{lastFile}</strong>. Upload it through your bank's WPS portal.
          </p>
        )}

        <button
          onClick={handleExport}
          disabled={downloading}
          className="w-full px-4 py-3 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <Download size={16} /> {downloading ? "Generating SIF…" : "Generate & Download SIF"}
        </button>
      </div>
    </div>
  );
}