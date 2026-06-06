"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/use-role";
import { apiCall } from "@/lib/api-client";
import { auth } from "@/lib/firebase";
import { Palette, Upload, Download, Trash2, X, ArrowLeft, ImageIcon, FileText } from "lucide-react";
import Loader from "@/components/Loader";
import WelcomeBanner from "@/components/WelcomeBanner";

type BrandAsset = {
  id: string;
  category: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storage: "drive" | "firestore";
  driveFileId?: string | null;
  webViewLink?: string | null;
  uploadedAt: string | null;
};

const BRAND_CATEGORIES = [
  { value: "logo", label: "Logos", icon: "🎨" },
  { value: "letterhead", label: "Letterheads", icon: "📜" },
  { value: "stamp", label: "Stamps & Signatures", icon: "✍️" },
  { value: "guidelines", label: "Brand Guidelines", icon: "📘" },
  { value: "template", label: "Templates", icon: "📋" },
  { value: "other", label: "Other Assets", icon: "📁" },
];

export default function BrandHubPage() {
  const { role, loading: roleLoading } = useRole();
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeCategory, setActiveCategory] = useState("logo");

  const fetchAssets = async () => {
    try {
      const res = await apiCall<{ assets: BrandAsset[] }>("/api/brand-hub");
      setAssets(res.assets || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(); }, []);

  if (roleLoading || loading) {
    return <Loader compact />;
  }
  if (role !== "admin") return <div className="text-center py-16 text-red-500">403 — Admin only.</div>;

  const handleDelete = async (asset: BrandAsset) => {
    if (!confirm(`Delete "${asset.label}"?`)) return;
    try {
      await apiCall(`/api/brand-hub?id=${asset.id}`, { method: "DELETE" });
      setAssets((p) => p.filter((a) => a.id !== asset.id));
    } catch (err: any) { alert("Delete failed: " + err.message); }
  };

  const handleDownload = async (asset: BrandAsset) => {
    if (asset.storage === "drive" && asset.webViewLink) {
      window.open(asset.webViewLink, "_blank");
      return;
    }
    try {
      const res = await apiCall<{ asset: BrandAsset & { base64?: string } }>(`/api/brand-hub/${asset.id}`);
      const b64 = (res.asset as any).base64;
      if (!b64) return alert("File not available.");
      const link = document.createElement("a");
      link.href = `data:${asset.mimeType};base64,${b64}`;
      link.download = asset.fileName;
      link.click();
    } catch (err: any) { alert("Download failed: " + err.message); }
  };

  const filtered = assets.filter((a) => a.category === activeCategory);

  return (
    <div>
      <Link href="/dashboard/company-overview" className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to Company Overview
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Palette size={24} className="text-gold" />
          <div>
            <h1 className="font-display text-3xl font-bold text-navy dark:text-white">Brand Hub</h1>
            <p className="text-navy-400 text-sm">Logos, letterheads, and brand assets — single source of truth.</p>
          </div>
          <WelcomeBanner tagline="Single source of truth for logos, letterheads, stamps, and brand assets." compact />
        </div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-5 py-2.5 bg-navy hover:bg-navy-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
          <Upload size={16} /> Upload Asset
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-navy-100 dark:border-navy-700" style={{ scrollbarWidth: "none" }}>
        {BRAND_CATEGORIES.map((cat) => {
          const count = assets.filter((a) => a.category === cat.value).length;
          const active = activeCategory === cat.value;
          return (
            <button key={cat.value} onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${active ? "border-gold text-navy dark:text-white" : "border-transparent text-navy-400 hover:text-navy dark:hover:text-white"}`}>
              {cat.icon} {cat.label} {count > 0 && <span className="ml-1 text-xs text-navy-400">({count})</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700">
          <Palette size={36} className="mx-auto text-navy-300 mb-3" />
          <p className="text-navy-400">No assets in this category yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((asset, i) => {
            const isImage = asset.mimeType.startsWith("image/");
            return (
              <div key={asset.id} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all animate-fade-in-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="aspect-square bg-navy-50 dark:bg-navy-700 flex items-center justify-center text-navy-300">
                  {isImage ? <ImageIcon size={36} /> : <FileText size={36} />}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-navy dark:text-white text-sm truncate" title={asset.label}>{asset.label}</h3>
                  <p className="text-xs text-navy-400 truncate">{asset.fileName} · {(asset.sizeBytes / 1024).toFixed(0)} KB</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleDownload(asset)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-navy-50 dark:bg-navy-700 hover:bg-navy-100 text-navy dark:text-white rounded-lg text-xs font-semibold">
                      <Download size={11} /> {asset.storage === "drive" ? "Open" : "Get"}
                    </button>
                    <button onClick={() => handleDelete(asset)} className="px-2 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 rounded-lg">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showUpload && <BrandUploadModal onClose={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); fetchAssets(); }} initialCategory={activeCategory} />}
    </div>
  );
}

function BrandUploadModal({ onClose, onSuccess, initialCategory }: { onClose: () => void; onSuccess: () => void; initialCategory: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(initialCategory);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!file) return setError("Please select a file.");
    setError(""); setUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/brand-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64Data: base64, category, label: label || file.name }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-navy dark:text-white">Upload Brand Asset</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-50 dark:hover:bg-navy-700 rounded-lg"><X size={18} className="text-navy-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">File *</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full px-3 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white">
              {BRAND_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Logo - Navy on White" className="w-full px-3 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-xl font-semibold text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={uploading || !file} className="flex-1 px-4 py-2.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
