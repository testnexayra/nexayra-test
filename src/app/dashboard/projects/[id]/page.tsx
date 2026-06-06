"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import Loader from "@/components/Loader";
import { useRole } from "@/lib/use-role";
import {
  ArrowLeft, MapPin, Calendar, User, Building2, Briefcase,
  Banknote, TrendingUp, AlertTriangle, CheckCircle2, FileText, Receipt,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";
import { Sparkles, Loader2 } from "lucide-react";
import ProjectTimeline, { type TimelineEvent } from "@/components/ProjectTimeline";
import ProjectTeam from "@/components/hr/ProjectTeam";

type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  location?: string;
  status?: string;
  contractValue: number;
  budgetedCost?: number;
  plannedStart?: string;
  plannedEnd?: string;
  actualProgress?: number;
  projectManager?: string;
  scope?: string;
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
type LPO = {
  id: string;
  nxrNo: number | string;
  vendorName: string;
  date: string;
  total: number;
  projectId?: string;
  project?: string;
  projectCode?: string;
  approved?: boolean;
  revisionOf?: string;
  revisionNumber?: number;
  createdAt?: string;
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

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const t = useChartTheme();
const { role } = useRole();
  const canEdit = role === "admin" || role === "project-manager";
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [expenses, setExpenses] = useState<PE[]>([]);
  const [lpos, setLpos] = useState<LPO[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [collections, setCollections] = useState<Col[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
const [drafts, setDrafts] = useState<any[] | null>(null);
const [genError, setGenError] = useState("");

const updateProjectStatus = async (newStatus: string) => {
    if (!project || newStatus === project.status) return;
    try {
      setUpdatingStatus(true);
      await apiCall("/api/accounts-projects", {
        method: "PUT",
        body: { id: project.id, status: newStatus },
      });
      // Update local state optimistically so UI reflects immediately
      setProject({ ...project, status: newStatus });
    } catch (err: any) {
      alert(`Failed to update status: ${err.message || "unknown error"}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

const generatePosts = async () => {
  if (!projectId) {
    setGenError("Project ID is missing.");
    return;
  }

  setGenerating(true);
  setGenError("");
  setDrafts(null);
  try {
    const res = await apiCall<{ drafts: any[] }>("/api/marketing/generate-post", {
      method: "POST",
      body: { projectId },
    });
    setDrafts(res.drafts);
  } catch (err: any) {
    setGenError(err.message);
  } finally {
    setGenerating(false);
  }
};

  useEffect(() => {
    (async () => {
      try {
        const [pAll, peAll, lpoAll, invAll, colAll] = await Promise.all([
          apiCall<{ projects: Project[] }>("/api/accounts-projects"),
          apiCall<{ expenses: PE[] }>("/api/project-expenses"),
          apiCall<{ lpos: LPO[] }>("/api/lpo").catch(() => ({ lpos: [] as LPO[] })),
          apiCall<{ invoices: Inv[] }>("/api/tax-invoice").catch(() => ({ invoices: [] as Inv[] })),
          apiCall<{ collections: Col[] }>("/api/collections").catch(() => ({ collections: [] as Col[] })),
        ]);

        const p = pAll.projects.find(x => x.id === projectId) || null;
        setProject(p);

        // Match on projectId (canonical) OR project name OR project code (denormalized fallbacks)
        // so legacy records linked only by string still appear.
        const matchesProject = (record: any): boolean => {
          if (!p) return false;
          if (record.projectId && record.projectId === projectId) return true;
          if (record.project && p.name && record.project === p.name) return true;
          if (record.project && p.code && record.project === p.code) return true;
          if (record.projectCode && p.code && record.projectCode === p.code) return true;
          return false;
        };

        // First identify project's invoices so we can match collections via invoiceId.
// Tax invoice API returns Firestore doc ID as `_docId`. The collections form
// stores invoiceId = the mirrored doc's random ID, but the canonical taxInvoice
// doc uses invoiceNo (e.g. "INV-NEX-1001") as its sanitized doc ID. We collect
// every possible identifier so the Set matches whichever the collection has.
const projectInvoices = (invAll.invoices || []).filter(matchesProject);
const projectInvoiceIds = new Set<string>();
projectInvoices.forEach((inv: any) => {
  if (inv._docId) projectInvoiceIds.add(inv._docId);
  if (inv.id) projectInvoiceIds.add(inv.id);
  if (inv.invoiceNo) projectInvoiceIds.add(inv.invoiceNo);
});

        const matchesProjectViaInvoice = (record: any): boolean => {
          if (matchesProject(record)) return true;
          // Collections often link to a project only via invoiceId
          if (record.invoiceId && projectInvoiceIds.has(record.invoiceId)) return true;
          return false;
        };

        setExpenses((peAll.expenses || []).filter(matchesProject));
        // Filter LPOs to this project, then dedupe by base LPO number.
        // We can't rely on Firestore doc IDs (the API doesn't expose them as `id`)
        // and revisionOf stores a human string like "LPO-1001" — so we extract the
        // base number from nxrNo (which is "1001" or "1001 Rev 1" or "1001 Rev 2")
        // and group by that. Latest revisionNumber wins per group.
        const projectLpos = (lpoAll.lpos || []).filter(matchesProject);

        const baseLpoNumber = (l: LPO): string => {
          // Extract leading digits from nxrNo. "1001 Rev 2" → "1001". "1001" → "1001".
          // Also strip a leading "LPO-" if present in revisionOf, in case nxrNo is missing.
          const raw = String(l.nxrNo ?? l.revisionOf ?? "");
          const cleaned = raw.replace(/^LPO-/i, "");
          const match = cleaned.match(/^\s*(\d+)/);
          return match ? match[1] : cleaned;
        };

        const lpoGroups = new Map<string, LPO[]>();
        projectLpos.forEach(l => {
          const key = baseLpoNumber(l);
          if (!lpoGroups.has(key)) lpoGroups.set(key, []);
          lpoGroups.get(key)!.push(l);
        });

        const latestLpos = Array.from(lpoGroups.values()).map(group => {
          // Keep the highest revisionNumber. Original (no revisionNumber, no revisionOf) = revision 0.
          // A "Rev 1" is revisionNumber=1, a "Rev 2" is revisionNumber=2, etc.
          return group.sort((a, b) => {
            const aRev = a.revisionNumber ?? 0;
            const bRev = b.revisionNumber ?? 0;
            return bRev - aRev;
          })[0];
        });
       setLpos(latestLpos);
        setInvoices(projectInvoices);
        setCollections((colAll.collections || []).filter(matchesProjectViaInvoice));

        // ===== TEMPORARY DEBUG — remove after we figure this out =====
        console.log("=== INVOICE/COLLECTION DEBUG ===");
        console.log("Project name:", p?.name, "| code:", p?.code, "| id:", projectId);
        console.log("Total invoices from API:", (invAll.invoices || []).length);
        console.log("ALL invoices (first 5):");
        (invAll.invoices || []).slice(0, 5).forEach((i, idx) => {
          console.log(`  Inv[${idx}]: id="${i.id}" | invoiceNo="${(i as any).invoiceNo}" | project="${i.project}" | projectId="${i.projectId}" | total=${i.total}`);
        });
        console.log("Project's matched invoices:", projectInvoices.length);
        projectInvoices.forEach((i, idx) => {
          console.log(`  ProjInv[${idx}]: id="${i.id}" | total=${i.total}`);
        });
        console.log("Total collections from API:", (colAll.collections || []).length);
        console.log("ALL collections (first 5):");
        (colAll.collections || []).slice(0, 5).forEach((c, idx) => {
          console.log(`  Col[${idx}]: id="${c.id}" | invoiceId="${c.invoiceId}" | projectId="${c.projectId}" | project="${c.project}" | amount=${c.amount}`);
        });
        const matchedCollections = (colAll.collections || []).filter(matchesProjectViaInvoice);
        console.log("Project's matched collections:", matchedCollections.length);
        matchedCollections.forEach((c, idx) => {
          console.log(`  ProjCol[${idx}]: id="${c.id}" | invoiceId="${c.invoiceId}" | amount=${c.amount}`);
        });
        console.log("================================");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

 const stats = useMemo(() => {
    // Direct expenses paid against this project
    const expensesSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Approved LPOs count as committed/quasi-spent money
    const approvedLpoTotal = lpos
      .filter(l => l.approved)
      .reduce((s, l) => s + (l.total || 0), 0);

    // "Spent" = actual expenses + approved LPO commitments
    const spent = expensesSpent + approvedLpoTotal;

    // Billed = sum of all invoices issued against this project
    const billed = invoices.reduce((s, i) => s + (i.total || i.amount || 0), 0);

    // Received = sum of all collections received against this project
    const received = collections.reduce((s, c) => s + (c.amount || 0), 0);

    // Outstanding = what's been billed but not yet collected
    const outstanding = billed - received;

    // LPO totals (informational)
    const lpoTotal = lpos.reduce((s, l) => s + (l.total || 0), 0);
    const lpoApproved = lpos.filter(l => l.approved).length;

    // Budget usage as a percentage
    const budgetUsage = project?.budgetedCost ? (spent / project.budgetedCost) * 100 : 0;
    const overBudget = project?.budgetedCost ? spent > project.budgetedCost : false;

    // Time-based progress
    let daysLeft = 0;
    let totalDuration = 0;
    let elapsedDays = 0;
    if (project?.plannedEnd) {
      const end = new Date(project.plannedEnd).getTime();
      const today = Date.now();
      daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    }
    if (project?.plannedStart && project?.plannedEnd) {
      const start = new Date(project.plannedStart).getTime();
      const end = new Date(project.plannedEnd).getTime();
      totalDuration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      elapsedDays = Math.max(0, Math.ceil((Date.now() - start) / (1000 * 60 * 60 * 24)));
    }
    const timeProgress = totalDuration > 0 ? Math.min(100, (elapsedDays / totalDuration) * 100) : 0;

    return {
      spent,                    // expenses + approved LPOs
      expensesSpent,            // expenses only (in case you want it elsewhere)
      approvedLpoTotal,         // approved LPOs only
      billed,
      received,
      outstanding,
      lpoTotal,
      lpoApproved,
      budgetUsage,
      overBudget,
      daysLeft,
      timeProgress,
    };
  }, [expenses, invoices, collections, lpos, project]);

  const costByType = useMemo(() => {
    const map = new Map<string, number>();

    // Existing project expenses bucketed by their expenseType
    expenses.forEach(e => {
      const t = e.expenseType || "misc";
      map.set(t, (map.get(t) || 0) + (e.amount || 0));
    });

    // Add approved LPO commitments as their own slice
    const approvedLpoSum = lpos
      .filter(l => l.approved)
      .reduce((s, l) => s + (l.total || 0), 0);
    if (approvedLpoSum > 0) {
      map.set("lpo", approvedLpoSum);
    }

    return Array.from(map, ([name, value]) => ({
      name: name === "lpo" ? "LPO" : name.charAt(0).toUpperCase() + name.slice(1),
      value,
      key: name,
    }));
  }, [expenses, lpos]);

  const monthlyExpenses = useMemo(() => {
    const map = new Map<string, number>();
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return `${d.toLocaleString("en-US", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
    };
    expenses.forEach(e => {
      const k = fmt(e.date);
      map.set(k, (map.get(k) || 0) + e.amount);
    });
    return Array.from(map, ([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date("01-" + a.month).getTime() - new Date("01-" + b.month).getTime())
      .slice(-12);
  }, [expenses]);

  const timelineData = useMemo(() => {
    const lpoEvents: TimelineEvent[] = lpos
      .filter((l) => l.date)
      .map((l) => ({
        id: l.id,
        date: new Date(l.date),
        label: `LPO-${l.nxrNo}`,
        sub: l.vendorName || "",
        total: l.total || 0,
      }));
    const expenseEvents: TimelineEvent[] = expenses
      .filter((e) => e.date)
      .map((e) => ({
        id: e.id,
        date: new Date(e.date),
        label: "Expense",
        sub: e.expenseType ? e.expenseType.charAt(0).toUpperCase() + e.expenseType.slice(1) : "Project expense",
        total: e.amount || 0,
      }));
    return { lpoEvents, expenseEvents };
  }, [lpos, expenses]);

  const billedVsReceived = useMemo(() => {
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

  const progressData = [
    { name: "Progress", value: project?.actualProgress || 0, fill: "#c9a84c" },
  ];

  if (loading) {
    return <Loader compact />;
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-navy-400 mb-4">Project not found.</p>
        <Link href="/dashboard/projects" className="text-gold font-semibold hover:underline">← Back to Projects</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard/projects")}
        className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to Projects
      </button>

      {/* Header card */}
      <div className="bg-brand-navy rounded-2xl p-6 mb-6 text-white relative overflow-hidden animate-fade-in-up">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-gold/10 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-gold font-semibold text-sm mb-1">{project.code}</p>
          <h1 className="font-display text-3xl font-bold mb-2">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-navy-200 text-sm">
            <span className="flex items-center gap-1.5"><Building2 size={14} /> {project.client}</span>
            {project.location && <span className="flex items-center gap-1.5"><MapPin size={14} /> {project.location}</span>}
            {project.projectManager && <span className="flex items-center gap-1.5"><User size={14} /> {project.projectManager}</span>}
            {project.plannedStart && project.plannedEnd && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {new Date(project.plannedStart).toLocaleDateString()} → {new Date(project.plannedEnd).toLocaleDateString()}
              </span>
            )}
            {canEdit ? (
              <select
                value={project.status || "Planning"}
                disabled={updatingStatus}
                onChange={e => updateProjectStatus(e.target.value)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold uppercase text-white cursor-pointer focus:outline-none focus:border-gold disabled:opacity-50 transition-all"
                title="Change project status"
              >
                <option value="Planning" className="bg-navy dark:text-navy">Planning</option>
                <option value="Ongoing" className="bg-navy dark:text-navy">Ongoing</option>
                <option value="On Hold" className="bg-navy dark:text-navy">On Hold</option>
                <option value="Completed" className="bg-navy dark:text-navy">Completed</option>
              </select>
            ) : (
              <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-bold uppercase">{project.status || "Planning"}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Contract", value: fmtAED(project.contractValue || 0), icon: Banknote, brand: true, text: "text-white" },
          { label: "Budget", value: fmtAED(project.budgetedCost || 0), icon: Briefcase, color: "from-indigo-600 to-indigo-700", text: "text-white" },
          { label: "Spent + Committed", value: fmtAED(stats.spent), icon: TrendingUp, color: stats.overBudget ? "from-rose-600 to-rose-700" : "from-gold to-gold-500", text: stats.overBudget ? "text-white" : "text-navy" },
{ label: "Billed", value: fmtAED(stats.billed), icon: FileText, color: "from-teal-600 to-teal-700", text: "text-white" },
          { label: "Received", value: fmtAED(stats.received), icon: CheckCircle2, color: "from-emerald-600 to-emerald-700", text: "text-white" },
          { label: "Outstanding", value: fmtAED(stats.outstanding), icon: AlertTriangle, color: "from-amber-600 to-amber-700", text: "text-white" },
          { label: "LPOs", value: `${lpos.length} (${stats.lpoApproved} appr.)`, icon: Receipt, color: "from-purple-600 to-purple-700", text: "text-white" },
          { label: "Days Left", value: stats.daysLeft >= 0 ? `${stats.daysLeft}` : `${Math.abs(stats.daysLeft)} late`, icon: Calendar, color: stats.daysLeft < 0 ? "from-rose-600 to-rose-700" : "from-slate-600 to-slate-700", text: "text-white" },
        ].map((k, i) => (
          <div key={k.label}
            className={`${(k as any).brand ? "bg-brand-navy" : `bg-gradient-to-br ${(k as any).color}`} ${k.text} rounded-2xl p-4 shadow-sm animate-fade-in-up`}
            style={{ animationDelay: `${i * 0.04}s` }}>
            <k.icon size={16} className="opacity-80 mb-2" />
            <p className="text-[10px] font-bold uppercase opacity-80">{k.label}</p>
            <p className="text-base font-bold mt-1 truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-1">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-4">Budget Utilization</h3>
          <div className="flex items-end justify-between mb-2">
  <span className="text-3xl font-bold text-navy dark:text-white">{stats.budgetUsage.toFixed(1)}%</span>
  <span className="text-sm text-navy-400">
    Spent + Committed: {fmtAED(stats.spent)} / {fmtAED(project.budgetedCost || 0)}
  </span>
</div>
          <div className="h-3 bg-navy-50 dark:bg-navy-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${stats.overBudget ? "bg-red-500" : stats.budgetUsage > 80 ? "bg-amber-500" : "bg-gold"}`}
              style={{ width: `${Math.min(100, stats.budgetUsage)}%` }}
            />
          </div>
          {stats.overBudget && (
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle size={12} /> Over budget by {fmtAED(stats.spent - (project.budgetedCost || 0))}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-2">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-4">Project Progress</h3>
          <div className="flex items-end justify-between mb-2">
            <span className="text-3xl font-bold text-navy dark:text-white">{(project.actualProgress || 0).toFixed(0)}%</span>
            <span className="text-sm text-navy-400">Time elapsed: {stats.timeProgress.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-navy-50 dark:bg-navy-700 rounded-full overflow-hidden mb-1 relative">
            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${project.actualProgress || 0}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-navy" style={{ left: `${stats.timeProgress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-navy-400 font-semibold mt-1">
            <span>0%</span>
            <span>100%</span>
            
          </div>
          <div className="text-center">
            <span> Coming Soon... </span>
          </div>
        </div>
      </div>
      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-3">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Cost Breakdown</h3>
          <p className="text-navy-400 text-xs mb-3">Spend by category</p>
          {costByType.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-navy-300 text-sm">No expenses recorded.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={costByType} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                  {costByType.map((entry, idx) => (
                    <Cell key={entry.key} fill={t.palette[idx % t.palette.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={t.tooltipStyle} formatter={(v: number) => fmtAED(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: t.axisText }} />
              </PieChart>
            </ResponsiveContainer>  
          )}
        </div>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-4">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Monthly Expenses</h3>
          <p className="text-navy-400 text-xs mb-3">Last 12 months of project spend</p>
          {monthlyExpenses.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-navy-300 text-sm">No expenses yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyExpenses}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.axisText }} />
                <YAxis tick={{ fontSize: 11, fill: t.axisText }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={t.tooltipStyle} formatter={(v: number) => fmtAED(v)} />
                <Bar dataKey="amount" fill={t.series.accent} radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Billed vs Received */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm mb-5 animate-fade-in-up delay-5">
        <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Billed vs Received</h3>
        <p className="text-navy-400 text-xs mb-3">Monthly cash flow on this project</p>
        {billedVsReceived.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-navy-300 text-sm">No invoices or collections yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={billedVsReceived}>
              <defs>
                <linearGradient id="bGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.series.primary} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={t.series.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.series.revenue} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={t.series.revenue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.axisText }} />
              <YAxis tick={{ fontSize: 11, fill: t.axisText }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={t.tooltipStyle} formatter={(v: number) => fmtAED(v)} />
              <Legend wrapperStyle={{ fontSize: 12, color: t.axisText }} />
              <Area type="monotone" dataKey="billed" stroke={t.series.primary} strokeWidth={2} fill="url(#bGrad)" name="Billed" />
              <Area type="monotone" dataKey="received" stroke={t.series.revenue} strokeWidth={2} fill="url(#rGrad)" name="Received" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Team & Labor */}
      <div className="mb-5 animate-fade-in-up">
        <ProjectTeam projectId={project.id} />
      </div>

      {/* Project Timeline */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm mb-5 animate-fade-in-up">
        <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Project Timeline</h3>
        <p className="text-navy-400 text-xs mb-3">LPOs and expenses plotted by date</p>
        <ProjectTimeline
          lpoEvents={timelineData.lpoEvents}
          expenseEvents={timelineData.expenseEvents}
          projectStart={project?.plannedStart ? new Date(project.plannedStart) : null}
        />
      </div>

      {/* Recent activity tables */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base font-bold text-navy dark:text-white">Recent LPOs</h3>
            <Link href="/dashboard/procurement/lpo/history" className="text-xs text-gold font-semibold hover:underline">View all</Link>
          </div>
          {lpos.length === 0 ? (
            <p className="text-navy-300 text-sm py-6 text-center">No LPOs linked to this project.</p>
          ) : (
            <div className="space-y-2">
              {lpos.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-navy-50 dark:bg-navy-700 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy dark:text-white truncate">LPO-{l.nxrNo} · {l.vendorName}</p>
                    <p className="text-xs text-navy-400">{new Date(l.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold text-navy dark:text-white">{fmtAED(l.total || 0)}</p>
                    {l.approved && <span className="text-[10px] text-emerald-600 font-bold">APPROVED</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base font-bold text-navy dark:text-white">Recent Invoices</h3>
            <Link href="/dashboard/accounts/tax-invoice" className="text-xs text-gold font-semibold hover:underline">View all</Link>
          </div>
          {invoices.length === 0 ? (
            <p className="text-navy-300 text-sm py-6 text-center">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 5).map(i => (
                <div key={i.id} className="flex items-center justify-between p-3 bg-navy-50 dark:bg-navy-700 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy dark:text-white truncate">
                      {i.documentNo || i.invoiceNo || "(no number)"}
                    </p>
                    <p className="text-xs text-navy-400">{new Date(i.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-sm font-bold text-navy dark:text-white shrink-0 ml-2">
                    {fmtAED(i.total || i.amount || 0)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}