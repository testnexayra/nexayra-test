"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/use-role";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import {
  Wrench, Plus, Search, MapPin, Calendar, Banknote,
  Edit3, Trash2, X, ArrowLeft, Activity, Package, ExternalLink,
} from "lucide-react";
import Loader from "@/components/Loader";
import WelcomeBanner from "@/components/WelcomeBanner";
import LocationCapture, { LocationData } from "@/components/LocationCapture";

type Asset = {
  id: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseValue: number;
  currentValue: number;
  condition: string;
  currentLocation: string;
  locationData?: LocationData | null;
  currentProjectId?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
  createdAt: string | null;
  lastScannedAt: string | null;
};

type Project = { id: string; name: string; code?: string };

const CATEGORIES = [
  "Vacuum Pump", "Pressure Tester", "Drilling Rig", "Generator", "Welding Machine",
  "Compressor", "Power Tools", "Survey Equipment", "Safety Equipment", "Other",
];

const CONDITIONS = ["Excellent", "Good", "Fair", "Needs Repair", "Out of Service"];

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diff / 86400000);
  if (day === 0) return "today";
  if (day === 1) return "yesterday";
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AssetsPage() {
  const { role, loading: roleLoading } = useRole();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [scanning, setScanning] = useState<Asset | null>(null);

  const fetchData = async () => {
    try {
      const [a, p] = await Promise.all([
        apiCall<{ assets: Asset[] }>("/api/assets"),
        apiCall<{ projects: Project[] }>("/api/accounts-projects").catch(() => ({ projects: [] as Project[] })),
      ]);
      setAssets(a.assets || []);
      setProjects(p.projects || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const sm = !search || [a.name, a.serialNumber, a.assignedTo, a.currentLocation].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
      const cm = categoryFilter === "All" || a.category === categoryFilter;
      return sm && cm;
    });
  }, [assets, search, categoryFilter]);

  const stats = useMemo(() => {
    const totalValue = assets.reduce((s, a) => s + (a.currentValue || 0), 0);
    const purchaseValue = assets.reduce((s, a) => s + (a.purchaseValue || 0), 0);
    const onSite = assets.filter((a) => a.currentProjectId).length;
    const inOffice = assets.filter((a) => !a.currentProjectId && a.condition !== "Out of Service").length;
    const needsRepair = assets.filter((a) => a.condition === "Needs Repair").length;
    return { totalValue, purchaseValue, onSite, inOffice, needsRepair };
  }, [assets]);

  if (roleLoading || loading) return <Loader compact />;

  const canEdit = ["admin", "accounts", "logistics"].includes(role || "");

  const handleDelete = async (a: Asset) => {
    if (!confirm(`Delete asset "${a.name}"?`)) return;
    try {
      await apiCall(`/api/assets?id=${a.id}`, { method: "DELETE" });
      setAssets((p) => p.filter((x) => x.id !== a.id));
    } catch (err: any) { alert("Delete failed: " + err.message); }
  };

  return (
    <div>
      <Link href="/dashboard/company-overview" className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to Company Overview
      </Link>

      {/* Welcome banner — full width row */}
      <WelcomeBanner tagline="Track high-value tools and equipment with their current location and assigned projects." compact />

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Wrench size={24} className="text-gold" />
          <div>
            <h1 className="font-display text-3xl font-bold text-navy dark:text-white">High-Value Assets</h1>
            <p className="text-navy-400 text-sm">Track expensive tools and equipment with current location & value.</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-navy hover:bg-navy-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
            <Plus size={16} /> Add Asset
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Total Value", value: fmtAED(stats.totalValue), icon: Banknote, color: "from-emerald-600 to-emerald-700" },
          { label: "Acquisition Cost", value: fmtAED(stats.purchaseValue), icon: Package, brand: true },
          { label: "On Site", value: stats.onSite, icon: MapPin, color: "from-gold to-gold-500", text: "text-navy" },
          { label: "In Office", value: stats.inOffice, icon: Wrench, color: "from-teal-600 to-teal-700" },
          { label: "Needs Repair", value: stats.needsRepair, icon: Activity, color: "from-rose-600 to-rose-700" },
        ].map((k, i) => (
          <div key={k.label} className={`${(k as any).brand ? "bg-brand-navy" : `bg-gradient-to-br ${(k as any).color}`} ${(k as any).text || "text-white"} rounded-2xl p-4 shadow-sm animate-fade-in-up`} style={{ animationDelay: `${i * 0.04}s` }}>
            <k.icon size={16} className="opacity-80 mb-1.5" />
            <p className="text-[10px] font-bold uppercase opacity-80">{k.label}</p>
            <p className="text-base font-bold mt-1 truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search & filter */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-4 mb-4 shadow-sm animate-fade-in-up delay-1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, serial number, location, or holder…"
              className="w-full pl-9 pr-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white placeholder-navy-400 focus:outline-none focus:border-gold transition-all" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white focus:outline-none focus:border-gold">
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-navy-400 font-semibold">{filtered.length} of {assets.length}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700">
          <Wrench size={36} className="mx-auto text-navy-300 mb-3" />
          <p className="text-navy-400">{assets.length === 0 ? "No assets tracked yet." : "No assets match your filters."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700 shadow-sm animate-fade-in-up delay-2">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 dark:bg-navy-700">
              <tr>
                <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Asset</th>
                <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Category</th>
                <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Location</th>
                <th className="text-right p-3 text-xs font-bold text-navy-400 uppercase">Value</th>
                <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Condition</th>
                <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Last Scan</th>
                {canEdit && <th className="text-right p-3 text-xs font-bold text-navy-400 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const project = projects.find((p) => p.id === a.currentProjectId);
                const conditionColor = a.condition === "Excellent" || a.condition === "Good"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : a.condition === "Fair"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400";
                return (
                  <tr key={a.id} className="border-t border-navy-50 dark:border-navy-700">
                    <td className="p-3">
                      <p className="font-bold text-navy dark:text-white">{a.name}</p>
                      {a.serialNumber && <p className="text-xs text-navy-400 font-mono">{a.serialNumber}</p>}
                    </td>
                    <td className="p-3 text-navy dark:text-white">{a.category}</td>
                    <td className="p-3">
                      <p className="text-navy dark:text-white text-xs">{a.currentLocation}</p>
                      {a.locationData && (
                        <a
                          href={`https://www.google.com/maps?q=${a.locationData.lat},${a.locationData.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-gold hover:text-gold-600 text-[10px] font-semibold mt-0.5"
                        >
                          <MapPin size={9} /> GPS <ExternalLink size={8} />
                        </a>
                      )}
                      {project && <p className="text-[10px] text-gold font-bold">{project.code || project.name}</p>}
                      {a.assignedTo && <p className="text-[10px] text-navy-400">→ {a.assignedTo}</p>}
                    </td>
                    <td className="p-3 text-right font-bold text-navy dark:text-white">{fmtAED(a.currentValue)}</td>
                    <td className="p-3"><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${conditionColor}`}>{a.condition}</span></td>
                    <td className="p-3 text-xs text-navy-400">{relativeTime(a.lastScannedAt)}</td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setScanning(a)} className="px-2 py-1 bg-gold/10 text-gold-600 hover:bg-gold/20 rounded text-xs font-bold" title="Scan to new location">📍 Scan</button>
                          <button onClick={() => { setEditing(a); setShowModal(true); }} className="p-1.5 hover:bg-navy-50 dark:hover:bg-navy-700 rounded"><Edit3 size={12} className="text-navy-400" /></button>
                          {role === "admin" && <button onClick={() => handleDelete(a)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={12} className="text-red-500" /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <AssetModal asset={editing} projects={projects} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchData(); }} />}
      {scanning && <ScanModal asset={scanning} projects={projects} onClose={() => setScanning(null)} onScanned={() => { setScanning(null); fetchData(); }} />}
    </div>
  );
}

function AssetModal({ asset, projects, onClose, onSaved }: { asset: Asset | null; projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: asset?.name || "",
    category: asset?.category || "Power Tools",
    serialNumber: asset?.serialNumber || "",
    purchaseDate: asset?.purchaseDate || "",
    purchaseValue: asset?.purchaseValue ?? 0,
    currentValue: asset?.currentValue ?? 0,
    condition: asset?.condition || "Good",
    currentLocation: asset?.currentLocation || "Office",
    locationData: asset?.locationData || null,
    currentProjectId: asset?.currentProjectId || "",
    assignedTo: asset?.assignedTo || "",
    notes: asset?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError("Name is required.");
    if (!form.category || !form.category.trim()) return setError("Category is required.");
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, currentProjectId: form.currentProjectId || null };
      if (asset) await apiCall("/api/assets", { method: "PATCH", body: { id: asset.id, ...payload } });
      else await apiCall("/api/assets", { method: "POST", body: payload });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-navy dark:text-white">{asset ? "Edit" : "Add"} Asset</h2>
          <button onClick={onClose}><X size={18} className="text-navy-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inp}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Serial Number</label>
            <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className={`${inp} font-mono`} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Purchase (AED)</label>
              <input type="number" value={form.purchaseValue} onChange={(e) => setForm({ ...form, purchaseValue: Number(e.target.value) })} className={inp} />
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Current (AED)</label>
              <input type="number" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: Number(e.target.value) })} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Condition</label>
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className={inp}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Assigned To</label>
              <input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Person name" className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Location Description</label>
              <input value={form.currentLocation} onChange={(e) => setForm({ ...form, currentLocation: e.target.value })} placeholder="Office / Site / Storage" className={inp} />
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Project (if on-site)</label>
              <select value={form.currentProjectId} onChange={(e) => setForm({ ...form, currentProjectId: e.target.value })} className={inp}>
                <option value="">— None —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code || p.name}</option>)}
              </select>
            </div>
          </div>

          {/* GPS location capture */}
          <LocationCapture
            value={form.locationData}
            onChange={(loc) => setForm({ ...form, locationData: loc })}
            label="GPS Location (optional)"
          />

          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={`${inp} resize-none`} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-xl">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-xl font-semibold text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
            {saving ? "Saving…" : (asset ? "Update" : "Add Asset")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanModal({ asset, projects, onClose, onScanned }: { asset: Asset; projects: Project[]; onClose: () => void; onScanned: () => void }) {
  const [location, setLocation] = useState(asset.currentLocation);
  const [locationData, setLocationData] = useState<LocationData | null>(asset.locationData || null);
  const [projectId, setProjectId] = useState(asset.currentProjectId || "");
  const [saving, setSaving] = useState(false);

  const handleScan = async () => {
    setSaving(true);
    try {
      await apiCall("/api/assets", {
        method: "PATCH",
        body: {
          id: asset.id,
          scanLocation: location,
          locationData,
          currentProjectId: projectId || null,
        },
      });
      onScanned();
    } catch (err: any) { alert("Scan failed: " + err.message); } finally { setSaving(false); }
  };

  const inp = "w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-800 rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-navy dark:text-white">📍 Scan Asset</h2>
          <button onClick={onClose}><X size={18} className="text-navy-400" /></button>
        </div>
        <p className="text-navy-400 text-sm mb-4">Update <strong className="text-navy dark:text-white">{asset.name}</strong>'s current location.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">New Location *</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Site A, Storeroom 2" className={inp} />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Project (optional)</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inp}>
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code || p.name}</option>)}
            </select>
          </div>

          <LocationCapture
            value={locationData}
            onChange={setLocationData}
            label="GPS (optional)"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-xl font-semibold text-sm">Cancel</button>
          <button onClick={handleScan} disabled={saving} className="flex-1 px-4 py-2.5 bg-gold hover:bg-gold-600 disabled:opacity-50 text-navy rounded-xl font-semibold text-sm">
            {saving ? "Recording…" : "📍 Confirm Scan"}
          </button>
        </div>
      </div>
    </div>
  );
}
