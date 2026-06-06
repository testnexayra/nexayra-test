"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/use-role";
import { apiCall } from "@/lib/api-client";
import { auth } from "@/lib/firebase";
import {
  Shield, Upload, FileText, Calendar, AlertTriangle, CheckCircle2,
  Trash2, Download, X, Sparkles, ArrowLeft, Search, Filter,
} from "lucide-react";
import Loader from "@/components/Loader";

type VaultDoc = {
  id: string;
  category: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storage: "drive" | "firestore";
  driveFileId?: string | null;
  webViewLink?: string | null;
  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  issuingAuthority?: string | null;
  holderName?: string | null;
  extractedBy?: "gemini" | "manual";
  extractionConfidence?: "high" | "medium" | "low" | null;
  uploadedAt: string | null;
  uploadedByEmail?: string;
};

const CATEGORIES = [
  { value: "trade-license", label: "Trade License", icon: "🏢" },
  { value: "chamber-cert", label: "Chamber of Commerce", icon: "🏛️" },
  { value: "vat-cert", label: "VAT Certificate", icon: "💰" },
  { value: "moa", label: "MOA / Articles", icon: "📜" },
  { value: "ejari", label: "Ejari / Tenancy", icon: "🏠" },
  { value: "emirates-id", label: "Emirates ID", icon: "🪪" },
  { value: "passport", label: "Passport", icon: "🛂" },
  { value: "visa", label: "Visa", icon: "✈️" },
  { value: "mulkiya", label: "Mulkiya", icon: "🚗" },
  { value: "insurance", label: "Insurance", icon: "🛡️" },
  { value: "other", label: "Other", icon: "📄" },
];

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function expiryStatus(iso?: string | null): { color: string; bg: string; label: string } {
  const d = daysUntil(iso);
  if (d === null) return { color: "text-navy-400", bg: "bg-navy-50 dark:bg-navy-700", label: "No expiry set" };
  if (d < 0) return { color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", label: `Expired ${Math.abs(d)}d ago` };
  if (d <= 30) return { color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", label: `Expires in ${d}d` };
  if (d <= 90) return { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", label: `Expires in ${d}d` };
  return { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", label: `Valid · ${d}d left` };
}

export default function VaultPage() {
  const { role, loading: roleLoading } = useRole();
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const fetchDocs = async () => {
    try {
      const res = await apiCall<{ documents: VaultDoc[] }>("/api/vault");
      setDocs(res.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const sm = !search ||
        d.label.toLowerCase().includes(search.toLowerCase()) ||
        d.documentNumber?.toLowerCase().includes(search.toLowerCase()) ||
        d.holderName?.toLowerCase().includes(search.toLowerCase());
      const cm = categoryFilter === "All" || d.category === categoryFilter;
      return sm && cm;
    });
  }, [docs, search, categoryFilter]);

  const stats = useMemo(() => {
    const expired = docs.filter((d) => { const x = daysUntil(d.expiryDate); return x !== null && x < 0; }).length;
    const expiring30 = docs.filter((d) => { const x = daysUntil(d.expiryDate); return x !== null && x >= 0 && x <= 30; }).length;
    const expiring90 = docs.filter((d) => { const x = daysUntil(d.expiryDate); return x !== null && x > 30 && x <= 90; }).length;
    const valid = docs.filter((d) => { const x = daysUntil(d.expiryDate); return x !== null && x > 90; }).length;
    return { expired, expiring30, expiring90, valid };
  }, [docs]);

  if (roleLoading || loading) {
    return <Loader compact />;
  }
  if (role !== "admin") return <div className="text-center py-16 text-red-500">403 — Admin only.</div>;

  const handleDelete = async (doc: VaultDoc) => {
    if (!confirm(`Delete "${doc.label}"? This cannot be undone.`)) return;
    try {
      await apiCall(`/api/vault?id=${doc.id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleDownload = async (doc: VaultDoc) => {
    if (doc.storage === "drive" && doc.webViewLink) {
      window.open(doc.webViewLink, "_blank");
      return;
    }
    try {
      const res = await apiCall<{ document: VaultDoc & { base64?: string } }>(`/api/vault/${doc.id}`);
      const b64 = (res.document as any).base64;
      if (!b64) return alert("File data not available.");
      const link = document.createElement("a");
      link.href = `data:${doc.mimeType};base64,${b64}`;
      link.download = doc.fileName;
      link.click();
    } catch (err: any) {
      alert("Download failed: " + err.message);
    }
  };

  return (
    <div>
      <Link href="/dashboard/company-overview" className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to Company Overview
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-gold" />
          <div>
            <h1 className="font-display text-3xl font-bold text-navy dark:text-white">Corporate Vault</h1>
            <p className="text-navy-400 text-sm">Trade licenses, IDs, certificates — with auto-extraction & expiry alerts.</p>
          </div>
        </div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-5 py-2.5 bg-navy hover:bg-navy-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
          <Upload size={16} /> Upload Document
        </button>
      </div>

      {/* Compliance summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Expired", value: stats.expired, color: "from-rose-600 to-rose-700", icon: AlertTriangle },
          { label: "Expiring ≤ 30d", value: stats.expiring30, color: "from-amber-600 to-amber-700", icon: AlertTriangle },
          { label: "Expiring ≤ 90d", value: stats.expiring90, color: "from-yellow-500 to-yellow-600", icon: Calendar },
          { label: "Valid", value: stats.valid, color: "from-emerald-600 to-emerald-700", icon: CheckCircle2 },
        ].map((s, i) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} text-white rounded-2xl p-4 shadow-sm animate-fade-in-up`} style={{ animationDelay: `${i * 0.05}s` }}>
            <s.icon size={18} className="opacity-80 mb-2" />
            <p className="text-xs font-bold uppercase opacity-80">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-4 mb-4 shadow-sm animate-fade-in-up delay-1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by label, document number, or holder…"
              className="w-full pl-9 pr-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white placeholder-navy-400 focus:outline-none focus:border-gold transition-all"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white focus:outline-none focus:border-gold transition-all">
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
          <span className="text-xs text-navy-400 font-semibold">{filtered.length} of {docs.length}</span>
        </div>
      </div>

      {/* Documents list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700">
          <Shield size={36} className="mx-auto text-navy-300 mb-3" />
          <p className="text-navy-400">{docs.length === 0 ? "Vault is empty. Upload your first document." : "No documents match your filters."}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc, i) => {
            const cat = CATEGORIES.find((c) => c.value === doc.category);
            const status = expiryStatus(doc.expiryDate);
            return (
              <div key={doc.id} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all animate-fade-in-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-2xl shrink-0">{cat?.icon || "📄"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase text-navy-400">{cat?.label || doc.category}</p>
                      <h3 className="font-bold text-navy dark:text-white truncate">{doc.label}</h3>
                    </div>
                  </div>
                  {doc.extractedBy === "gemini" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded shrink-0">
                      <Sparkles size={10} /> AI
                    </span>
                  )}
                </div>

                {doc.documentNumber && (
                  <p className="text-xs text-navy-400 font-mono mb-1">#{doc.documentNumber}</p>
                )}
                {doc.holderName && (
                  <p className="text-xs text-navy-400 mb-2 truncate">{doc.holderName}</p>
                )}

                <div className={`${status.bg} rounded-lg p-2 mb-3 flex items-center gap-1.5`}>
                  <Calendar size={12} className={status.color} />
                  <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
                  {doc.expiryDate && <span className="text-xs text-navy-400 ml-auto">{new Date(doc.expiryDate).toLocaleDateString()}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownload(doc)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-navy-50 dark:bg-navy-700 hover:bg-navy-100 dark:hover:bg-navy-600 text-navy dark:text-white rounded-lg text-xs font-semibold transition-all">
                    <Download size={12} /> {doc.storage === "drive" ? "Open" : "Download"}
                  </button>
                  <button onClick={() => handleDelete(doc)} className="px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 rounded-lg transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); fetchDocs(); }} />}
    </div>
  );
}

// ====================== Upload Modal ======================

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("trade-license");
  const [label, setLabel] = useState("");
  const [holderName, setHolderName] = useState("");
  const [manualExpiry, setManualExpiry] = useState("");
  const [manualDocNumber, setManualDocNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<{ documentType?: string; documentNumber?: string; expiryDate?: string; confidence?: string } | null>(null);

  const handleSubmit = async () => {
    if (!file) return setError("Please select a file.");
    setError(""); setUploading(true); setExtracted(null);

    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = () => rej(new Error("File read failed"));
        r.readAsDataURL(file);
      });

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64,
          category,
          label: label || file.name,
          holderName: holderName || undefined,
          manualExpiry: manualExpiry || undefined,
          manualDocNumber: manualDocNumber || undefined,
        }),
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.message);

      if (data.extracted?.expiryDate || data.extracted?.documentNumber) {
        setExtracted(data.extracted);
        setTimeout(onSuccess, 2500);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-navy-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-navy dark:text-white">Upload to Vault</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-50 dark:hover:bg-navy-700 rounded-lg transition-all">
            <X size={18} className="text-navy-400" />
          </button>
        </div>

        {extracted ? (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-purple-600" />
              <p className="font-bold text-purple-700 dark:text-purple-400">AI extracted data</p>
            </div>
            <div className="text-sm space-y-1 text-navy dark:text-white">
              {extracted.documentType && <p><strong>Type:</strong> {extracted.documentType}</p>}
              {extracted.documentNumber && <p><strong>Number:</strong> {extracted.documentNumber}</p>}
              {extracted.expiryDate && <p><strong>Expiry:</strong> {extracted.expiryDate}</p>}
              {extracted.confidence && <p className="text-xs text-navy-400">Confidence: {extracted.confidence}</p>}
            </div>
            <p className="text-xs text-navy-400 mt-3">Saved successfully — closing…</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-navy-400 uppercase block mb-1">File *</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept="image/*,application/pdf"
                  className="w-full px-3 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white"
                />
                {file && <p className="text-xs text-navy-400 mt-1">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Label</label>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main Trade License 2025" className="w-full px-3 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                  <Sparkles size={12} /> Manual fields (override AI extraction)
                </p>
                <div className="space-y-2">
                  <input value={manualDocNumber} onChange={(e) => setManualDocNumber(e.target.value)} placeholder="Document number" className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-navy dark:text-white" />
                  <input type="date" value={manualExpiry} onChange={(e) => setManualExpiry(e.target.value)} placeholder="Expiry date" className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-navy dark:text-white" />
                  <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Holder/owner name" className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-navy dark:text-white" />
                </div>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-2">When Gemini is enabled, leaving these blank lets AI auto-fill from the file.</p>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm mt-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}

            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={handleSubmit} disabled={uploading || !file} className="flex-1 px-4 py-2.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all">
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
