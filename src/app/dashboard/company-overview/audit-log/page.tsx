"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/use-role";
import { apiCall } from "@/lib/api-client";
import {
  Activity, ArrowLeft, Search, User, Filter, RefreshCw,
} from "lucide-react";
import Loader from "@/components/Loader";

type AuditLog = {
  id: string;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  details?: string | null;
  timestamp: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  update: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  delete: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  approve: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  convert: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  login: "bg-navy-50 text-navy dark:bg-navy-700 dark:text-white",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AuditLogPage() {
  const { role, loading: roleLoading } = useRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [entityFilter, setEntityFilter] = useState("All");

  const fetchLogs = async () => {
    setRefreshing(true);
    try {
      const res = await apiCall<{ logs: AuditLog[] }>("/api/audit-logs?limit=200");
      setLogs(res.logs || []);
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const entityTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.entityType))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const sm = !search || [l.userEmail, l.entityName, l.entityId, l.details].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
      const am = actionFilter === "All" || l.action === actionFilter;
      const em = entityFilter === "All" || l.entityType === entityFilter;
      return sm && am && em;
    });
  }, [logs, search, actionFilter, entityFilter]);

  if (roleLoading || loading) {
    return <Loader compact />;
  }
  if (role !== "admin") return <div className="text-center py-16 text-red-500">403 — Audit log is admin-only.</div>;

  return (
    <div>
      <Link href="/dashboard/company-overview" className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to Company Overview
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-gold" />
          <div>
            <h1 className="font-display text-3xl font-bold text-navy dark:text-white">Audit Trail</h1>
            <p className="text-navy-400 text-sm">Who did what, and when. {logs.length} events recorded.</p>
          </div>
        </div>
        <button onClick={fetchLogs} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-navy-50 dark:bg-navy-700 hover:bg-navy-100 text-navy dark:text-white rounded-xl text-sm font-semibold transition-all">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-4 mb-4 shadow-sm animate-fade-in-up delay-1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, entity, or details…"
              className="w-full pl-9 pr-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white placeholder-navy-400 focus:outline-none focus:border-gold" />
          </div>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white">
            <option value="All">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white">
            <option value="All">All Entities</option>
            {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-navy-400 font-semibold">{filtered.length} of {logs.length}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700">
          <Activity size={36} className="mx-auto text-navy-300 mb-3" />
          <p className="text-navy-400">{logs.length === 0 ? "No audit events recorded yet." : "No events match your filters."}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700 shadow-sm overflow-hidden animate-fade-in-up delay-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 dark:bg-navy-700">
                <tr>
                  <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Time</th>
                  <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">User</th>
                  <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Action</th>
                  <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Entity</th>
                  <th className="text-left p-3 text-xs font-bold text-navy-400 uppercase">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t border-navy-50 dark:border-navy-700 hover:bg-navy-50/50 dark:hover:bg-navy-700/50">
                    <td className="p-3 text-xs">
                      <p className="text-navy dark:text-white font-semibold">{relativeTime(l.timestamp)}</p>
                      <p className="text-[10px] text-navy-400">{l.timestamp ? new Date(l.timestamp).toLocaleString() : "—"}</p>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-navy-400" />
                        <span className="font-bold text-navy dark:text-white">{l.userEmail?.split("@")[0] || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="p-3"><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${ACTION_COLORS[l.action] || "bg-navy-50 text-navy"}`}>{l.action}</span></td>
                    <td className="p-3">
                      <p className="text-xs font-bold text-navy dark:text-white">{l.entityName || l.entityId}</p>
                      <p className="text-[10px] text-navy-400 uppercase">{l.entityType}</p>
                    </td>
                    <td className="p-3 text-xs text-navy-400">{l.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
