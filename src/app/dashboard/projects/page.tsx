"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import { useRole } from "@/lib/use-role";
import { Search, Plus, Briefcase, TrendingUp, Banknote, AlertTriangle, CheckCircle2, Clock, Pause, ArrowRight } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import WelcomeBanner from "@/components/WelcomeBanner";
import { useChartTheme } from "@/lib/chart-theme";
import Loader from "@/components/Loader";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import { FolderPlus, Camera } from "lucide-react";


type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  location?: string;
  status?: "Planning" | "Ongoing" | "Completed" | "On Hold";
  contractValue: number;
  budgetedCost?: number;
  totalExpenses?: number;
  plannedStart?: string;
  plannedEnd?: string;
  actualProgress?: number;
  projectManager?: string;
};
type PE = {
  id: string;
  date: string;
  amount: number;
  projectId?: string;
  project?: string;
  projectCode?: string;
  expenseType?: string;
};
type Inv = {
  id: string;
  date: string;
  amount?: number;
  total?: number;
  projectId?: string;
  project?: string;
  projectCode?: string;
  documentNo?: string;
  invoiceNo?: string;
  _docId?: string;
};
type Col = {
  id: string;
  date: string;
  amount: number;
  projectId?: string;
  project?: string;
  projectCode?: string;
  invoiceId?: string;
};
type LPO = {
  id?: string;
  nxrNo?: number | string;
  vendorName?: string;
  date?: string;
  total?: number;
  projectId?: string;
  project?: string;
  projectCode?: string;
  approved?: boolean;
  revisionOf?: string;
  revisionNumber?: number;
};

const STATUS_COLORS: Record<string, string> = {
  Planning: "#4150aa",
  Ongoing: "#c9a84c",
  Completed: "#0f766e",
  "On Hold": "#b91c1c",
};

// ----- Helpers shared between the module-level stats and per-card calculations -----

function baseLpoNumber(l: LPO): string {
  const raw = String(l.nxrNo ?? l.revisionOf ?? "");
  const cleaned = raw.replace(/^LPO-/i, "");
  const match = cleaned.match(/^\s*(\d+)/);
  return match ? match[1] : cleaned;
}

function dedupeLposByRevision(lpos: LPO[]): LPO[] {
  const groups = new Map<string, LPO[]>();
  lpos.forEach(l => {
    const key = baseLpoNumber(l);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  });
  return Array.from(groups.values()).map(group =>
    group.sort((a, b) => (b.revisionNumber ?? 0) - (a.revisionNumber ?? 0))[0]
  );
}

export default function ProjectsPage() {
  const t = useChartTheme();
  const router = useRouter();
  const { role, loading: roleLoading } = useRole();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectExp, setProjectExp] = useState<PE[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [collections, setCollections] = useState<Col[]>([]);
  const [lpos, setLpos] = useState<LPO[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  useEffect(() => {
    (async () => {
      try {
        const [p, pe, inv, col, lpoRes] = await Promise.all([
          apiCall<{ projects: Project[] }>("/api/accounts-projects"),
          apiCall<{ expenses: PE[] }>("/api/project-expenses"),
          apiCall<{ invoices: Inv[] }>("/api/tax-invoice").catch(() => ({ invoices: [] as Inv[] })),
          apiCall<{ collections: Col[] }>("/api/collections").catch(() => ({ collections: [] as Col[] })),
          apiCall<{ lpos: LPO[] }>("/api/lpo").catch(() => ({ lpos: [] as LPO[] })),
        ]);
        setProjects(p.projects || []);
        setProjectExp(pe.expenses || []);
        setInvoices(inv.invoices || []);
        setCollections(col.collections || []);
        setLpos(lpoRes.lpos || []);
      } catch (err) {
        console.error("Projects dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Aggregations ----------
  const stats = useMemo(() => {
    const projectIds = new Set(projects.map(p => p.id));
    const projectNames = new Set(projects.map(p => p.name).filter(Boolean));
    const projectCodes = new Set(projects.map(p => p.code).filter(Boolean));

    const isLinkedToProject = (record: any): boolean => {
      if (record.projectId && projectIds.has(record.projectId)) return true;
      if (record.project && projectNames.has(record.project)) return true;
      if (record.project && projectCodes.has(record.project)) return true;
      if (record.projectCode && projectCodes.has(record.projectCode)) return true;
      return false;
    };

    // Build the set of project-linked invoice IDs so collections can match via invoiceId
    const projectInvoices = invoices.filter(isLinkedToProject);
    const projectInvoiceIds = new Set(
      projectInvoices.map((i: any) => i.id || i._docId).filter(Boolean)
    );

    const isLinkedCollection = (c: any): boolean => {
      if (isLinkedToProject(c)) return true;
      if (c.invoiceId && projectInvoiceIds.has(c.invoiceId)) return true;
      return false;
    };

    // Approved LPO totals across all projects (deduped by revision)
    const linkedLpos = lpos.filter(isLinkedToProject);
    const latestLposTotal = dedupeLposByRevision(linkedLpos);
    const totalApprovedLpos = latestLposTotal
      .filter(l => l.approved)
      .reduce((s, l) => s + (l.total || 0), 0);

    const totalContract = projects.reduce((s, p) => s + (p.contractValue || 0), 0);
    const totalBudget = projects.reduce((s, p) => s + (p.budgetedCost || 0), 0);
    const totalSpent = projectExp.filter(isLinkedToProject).reduce((s, e) => s + (e.amount || 0), 0);
    const totalCommitted = totalSpent + totalApprovedLpos;
    const totalBilled = projectInvoices.reduce((s: number, i: any) => s + (i.total || i.amount || 0), 0);
    const totalReceived = collections.filter(isLinkedCollection).reduce((s, c) => s + (c.amount || 0), 0);
    const outstanding = totalBilled - totalReceived;

    const active = projects.filter(p => p.status === "Ongoing").length;
    const completed = projects.filter(p => p.status === "Completed").length;

    // overBudget per project (uses spent + committed LPOs for accuracy)
    const overBudget = projects.filter(p => {
      const matchesP = (record: any): boolean => {
        if (record.projectId && record.projectId === p.id) return true;
        if (record.project && p.name && record.project === p.name) return true;
        if (record.project && p.code && record.project === p.code) return true;
        if (record.projectCode && p.code && record.projectCode === p.code) return true;
        return false;
      };
      const expSpent = projectExp.filter(matchesP).reduce((s, e) => s + (e.amount || 0), 0);
      const lposForP = dedupeLposByRevision(lpos.filter(matchesP));
      const lpoSpent = lposForP.filter(l => l.approved).reduce((s, l) => s + (l.total || 0), 0);
      return p.budgetedCost && (expSpent + lpoSpent) > p.budgetedCost;
    }).length;

    return {
      totalContract,
      totalBudget,
      totalSpent,
      totalApprovedLpos,
      totalCommitted,
      totalBilled,
      totalReceived,
      outstanding,
      active,
      completed,
      overBudget,
    };
  }, [projects, projectExp, invoices, collections, lpos]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => {
      const s = p.status || "Planning";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [projects]);

  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, { billed: number; received: number }>();
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return `${d.toLocaleString("en-US", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
    };
    invoices.forEach(i => {
      const k = fmt(i.date);
      const prev = map.get(k) || { billed: 0, received: 0 };
      map.set(k, { ...prev, billed: prev.billed + (i.total || i.amount || 0) });
    });
    collections.forEach(c => {
      const k = fmt(c.date);
      const prev = map.get(k) || { billed: 0, received: 0 };
      map.set(k, { ...prev, received: prev.received + (c.amount || 0) });
    });
    return Array.from(map, ([month, v]) => ({ month, ...v }))
      .sort((a, b) => new Date("01-" + a.month).getTime() - new Date("01-" + b.month).getTime())
      .slice(-12);
  }, [invoices, collections]);

  const topProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => (b.contractValue || 0) - (a.contractValue || 0))
      .slice(0, 5)
      .map(p => {
        const matchesP = (record: any): boolean => {
          if (record.projectId && record.projectId === p.id) return true;
          if (record.project && p.name && record.project === p.name) return true;
          if (record.project && p.code && record.project === p.code) return true;
          if (record.projectCode && p.code && record.projectCode === p.code) return true;
          return false;
        };
        const expSpent = projectExp.filter(matchesP).reduce((s, e) => s + (e.amount || 0), 0);
        const lposForP = dedupeLposByRevision(lpos.filter(matchesP));
        const lpoSpent = lposForP.filter(l => l.approved).reduce((s, l) => s + (l.total || 0), 0);
        return {
          name: p.code || p.name.slice(0, 12),
          contract: p.contractValue || 0,
          spent: expSpent + lpoSpent,
        };
      });
  }, [projects, projectExp, lpos]);

  const expenseByType = useMemo(() => {
    const map = new Map<string, number>();

    // Existing project expenses bucketed by expenseType
    projectExp.forEach(e => {
      const t = e.expenseType || "misc";
      map.set(t, (map.get(t) || 0) + (e.amount || 0));
    });

    // Add approved LPO commitments (deduped by revision) as their own slice
    const latestLpos = dedupeLposByRevision(lpos);
    const approvedLpoSum = latestLpos
      .filter(l => l.approved)
      .reduce((s, l) => s + (l.total || 0), 0);
    if (approvedLpoSum > 0) {
      map.set("lpo", approvedLpoSum);
    }

    return Array.from(map, ([name, value]) => ({
      name: name === "lpo" ? "LPO" : name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [projectExp, lpos]);

  // ---------- Filtered list ----------
  const filtered = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code?.toLowerCase().includes(search.toLowerCase()) ||
        p.client?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  if (roleLoading || loading) {
    return <Loader compact />;
  }

  const canCreate = role === "admin" || role === "project-manager";

  return (
    <><div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <p className="text-navy-400 text-sm">Live overview of all active and historical projects.</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/projects/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-navy hover:bg-navy-700 text-white dark:bg-gold-400 dark:text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
            <Plus size={16} /> New Project
          </Link>
        )}
      </div>

      <WelcomeBanner tagline="Track milestones, allocate resources, and deliver on time." compact />

      {/* Search / filter */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm mb-4 animate-fade-in-up delay-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name, code, or client…"
              className="w-full pl-9 pr-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white placeholder-navy-400 focus:outline-none focus:border-gold transition-all" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white focus:outline-none focus:border-gold transition-all">
            <option value="All">All Status</option>
            <option value="Planning">Planning</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>
          <span className="text-xs text-navy-400 font-semibold">
            {filtered.length} of {projects.length} projects
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total Projects", value: projects.length, icon: Briefcase, brand: true, text: "text-white" },
          { label: "Active", value: stats.active, icon: TrendingUp, color: "from-gold to-gold-500", text: "text-navy" },
          { label: "Contract Value", value: fmtAED(stats.totalContract), icon: Banknote, color: "from-teal-600 to-teal-700", text: "text-white" },
          { label: "Total Billed", value: fmtAED(stats.totalBilled), icon: CheckCircle2, color: "from-indigo-600 to-indigo-700", text: "text-white" },
          { label: "Total Received", value: fmtAED(stats.totalReceived), icon: TrendingUp, color: "from-emerald-600 to-emerald-700", text: "text-white" },
          { label: "Outstanding", value: fmtAED(stats.outstanding), icon: AlertTriangle, color: "from-rose-600 to-rose-700", text: "text-white" },
        ].map((k, i) => (
          <div key={k.label}
            className={`${(k as any).brand ? "bg-brand-navy" : `bg-gradient-to-br ${(k as any).color}`} ${k.text} rounded-2xl p-4 shadow-sm animate-fade-in-up`}
            style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-center justify-between mb-2">
              <k.icon size={18} className="opacity-80" />
            </div>
            <p className="text-xs font-semibold uppercase opacity-80">{k.label}</p>
            <p className="text-lg font-bold mt-1 truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Status distribution */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-1">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Projects by Status</h3>
          <p className="text-navy-400 text-xs mb-3">Distribution across lifecycle stages</p>
          {statusData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-navy-300 text-sm">No projects yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#888"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={t.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: t.legendText }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top projects bar chart */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-2">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Top 5 Projects — Contract vs Spent</h3>
          <p className="text-navy-400 text-xs mb-3">Highest value projects in the portfolio</p>
          {topProjects.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-navy-300 text-sm">No data.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProjects}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: t.axisText }} />
                <YAxis tick={{ fontSize: 11, fill: t.axisText }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={t.tooltipStyle}
                  formatter={(v: number) => fmtAED(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: t.legendText }} />
                <Bar dataKey="contract" fill={t.series.primary} name="Contract" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" fill={t.series.accent} name="Spent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense breakdown */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-3">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Cost by Category</h3>
          <p className="text-navy-400 text-xs mb-3">All projects combined</p>
          {expenseByType.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-navy-300 text-sm">No expenses yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseByType} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                  {expenseByType.map((_, i) => (
                    <Cell key={i} fill={t.palette[i % t.palette.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={t.tooltipStyle}
                  formatter={(v: number) => fmtAED(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: t.legendText }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 — Monthly billing/collection */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm mb-6 animate-fade-in-up delay-4">
        <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Billed vs Received — Last 12 Months</h3>
        <p className="text-navy-400 text-xs mb-3">Cash flow trend across projects</p>
        {monthlyRevenue.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-navy-300 text-sm">No invoices or collections yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.series.primary} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={t.series.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.series.accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={t.series.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.axisText }} />
              <YAxis tick={{ fontSize: 11, fill: t.axisText }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={t.tooltipStyle}
                formatter={(v: number) => fmtAED(v)} />
              <Legend wrapperStyle={{ fontSize: 12, color: t.legendText }} />
              <Area type="monotone" dataKey="billed" stroke={t.series.primary} strokeWidth={2} fill="url(#billedGrad)" name="Billed" />
              <Area type="monotone" dataKey="received" stroke={t.series.accent} strokeWidth={2} fill="url(#recvGrad)" name="Received" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Project list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700">
          <Briefcase size={36} className="mx-auto text-navy-300 mb-3" />
          <p className="text-navy-400">No projects match your filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => {
            // Match by id, name, or code (handles legacy string-only links)
            const matchesP = (record: any): boolean => {
              if (record.projectId && record.projectId === p.id) return true;
              if (record.project && p.name && record.project === p.name) return true;
              if (record.project && p.code && record.project === p.code) return true;
              if (record.projectCode && p.code && record.projectCode === p.code) return true;
              return false;
            };

            // Spent = direct expenses + approved LPO commitments (matches detail page logic)
            const expSpent = projectExp.filter(matchesP).reduce((s, e) => s + (e.amount || 0), 0);
            const lposForP = dedupeLposByRevision(lpos.filter(matchesP));
            const lpoSpent = lposForP.filter(l => l.approved).reduce((s, l) => s + (l.total || 0), 0);
            const spent = expSpent + lpoSpent;

            // Billed = invoices issued for this project (uses real field name `total`)
            const billed = invoices
              .filter(matchesP)
              .reduce((s, inv) => s + (inv.total || inv.amount || 0), 0);

            const utilization = p.budgetedCost ? Math.min(100, (spent / p.budgetedCost) * 100) : 0;
            const overBudget = p.budgetedCost ? spent > p.budgetedCost : false;
            const StatusIcon = p.status === "Completed" ? CheckCircle2 : p.status === "On Hold" ? Pause : Clock;

            return (
              <button
                key={p.id}
                onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                className="text-left bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all animate-fade-in-up"
                style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-navy-400 text-xs font-semibold">{p.code}</p>
                    <h3 className="font-bold text-navy dark:text-white truncate">{p.name}</h3>
                    <p className="text-navy-400 text-sm truncate">{p.client}</p>
                  </div>
                  <ArrowRight size={16} className="text-navy-300 shrink-0 mt-1" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: `${STATUS_COLORS[p.status || "Planning"]}20`, color: STATUS_COLORS[p.status || "Planning"] }}>
                    <StatusIcon size={11} /> {p.status || "Planning"}
                  </span>
                  {overBudget && (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">Over budget</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-navy-400 text-[10px] uppercase font-bold">Contract</p>
                    <p className="text-sm font-bold text-navy dark:text-white">{fmtAED(p.contractValue || 0)}</p>
                  </div>
                  <div>
                    <p className="text-navy-400 text-[10px] uppercase font-bold">Billed</p>
                    <p className="text-sm font-bold text-navy dark:text-white">{fmtAED(billed)}</p>
                  </div>
                </div>
                {p.budgetedCost && p.budgetedCost > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                      <span className="text-navy-400">BUDGET USED (incl. LPOs)</span>
                      <span className={overBudget ? "text-red-600" : "text-navy"}>{utilization.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-navy-50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${overBudget ? "bg-red-500" : "bg-gold"}`}
                        style={{ width: `${utilization}%` }} />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}