"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { ArrowLeft, Briefcase, Save } from "lucide-react";
import Loader from "@/components/Loader";

const STATUS_OPTIONS = ["Planning", "Tender", "Ongoing", "On Hold", "Completed", "Cancelled", "custom"];

export default function NewProjectPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useRole();

  const [form, setForm] = useState({
    code: "",
    name: "",
    client: "",
    location: "",
    projectManager: "",
    status: "Ongoing",
    contractValue: 0,
    budgetedCost: 0,
    plannedStart: "",
    plannedEnd: "",
    scope: "",
  });
  const [customStatus, setCustomStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (roleLoading) {
    return <Loader compact />;
  }

  const canCreate = role === "admin" || role === "project-manager";
  if (!canCreate) {
    return <div className="text-center py-16 text-red-500">403 — You don't have permission to create projects.</div>;
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError("Project name is required.");
    if (!form.code.trim()) return setError("Project code is required.");
    if (!form.client.trim()) return setError("Client name is required.");
    if (form.status === "custom" && !customStatus.trim()) return setError("Please specify the custom status.");

    setSaving(true);
    setError("");
    try {
      // If status is custom, save the typed value instead of the literal "custom"
      const payload = {
        ...form,
        status: form.status === "custom" ? customStatus.trim() : form.status,
      };
      const res = await apiCall<{ ok: boolean; id: string }>("/api/accounts-projects", {
        method: "POST",
        body: payload,
      });
      if (!res.ok) throw new Error("Save failed");
      router.push(`/dashboard/projects/${res.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const inp = "w-full px-3 py-2.5 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white focus:outline-none focus:border-gold transition-all";

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/dashboard/projects" className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to Projects
      </Link>

      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
          <Briefcase size={20} className="text-white" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-navy dark:text-white">New Project</h1>
          <p className="text-navy-400 text-sm">Create a new project. Required fields are marked *.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm animate-fade-in-up delay-1 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Project Code *</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. P-1055" className={inp} />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Project Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Marina Tower MEP Works" className={inp} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Client *</label>
            <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Dubai Marina" className={inp} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Project Manager</label>
            <input value={form.projectManager} onChange={(e) => setForm({ ...form, projectManager: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => {
                setForm({ ...form, status: e.target.value });
                if (e.target.value !== "custom") setCustomStatus("");
              }}
              className={inp}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === "custom" ? "Custom…" : s}</option>
              ))}
            </select>
            {form.status === "custom" && (
              <input
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="Specify status (e.g. Mobilization, Closeout)"
                className={`${inp} mt-2`}
              />
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Contract Value (AED)</label>
            <input type="number" step="0.01" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: Number(e.target.value) })} className={inp} />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Budgeted Cost (AED)</label>
            <input type="number" step="0.01" value={form.budgetedCost} onChange={(e) => setForm({ ...form, budgetedCost: Number(e.target.value) })} className={inp} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Planned Start</label>
            <input type="date" value={form.plannedStart} onChange={(e) => setForm({ ...form, plannedStart: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Planned End</label>
            <input type="date" value={form.plannedEnd} onChange={(e) => setForm({ ...form, plannedEnd: e.target.value })} className={inp} />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Scope of Work</label>
          <textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} className={`${inp} resize-y`} placeholder="Brief description of project scope…" />
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={() => router.push("/dashboard/projects")} className="flex-1 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-xl font-semibold text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}