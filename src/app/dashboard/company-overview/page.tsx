"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/use-role";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import Loader from "@/components/Loader";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Users, Truck,
  Wallet, Activity, Crown, Clock, Zap,
  Shield, Palette, Wrench,
} from "lucide-react";
import {
  RadialBarChart, RadialBar, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import WelcomeBanner from "@/components/WelcomeBanner";
import ModuleSearchBar from "@/components/ModuleSearchBar";
import { useChartTheme } from "@/lib/chart-theme";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import { FileUp, Banknote, Megaphone as Announcement } from "lucide-react";

type Bank = { id: string; name?: string; currentBalance: number };
type Expense = { id: string; date: string; amount: number };
type PE = { id: string; date: string; amount: number; projectId?: string };
type Quotation = { id: string; documentNo?: string; date: string; total?: number; convertedProjectId?: string };
type LPO = { id: string; nxrNo?: number; date: string; total?: number };
type Project = { id: string; name: string; code?: string; status?: string; contractValue?: number; budgetedCost?: number; sourceQuotationId?: string; quotationNo?: string };
type Employee = {
  id: string; name: string; department?: string; role?: string;
  assignedProjectIds?: string[]; assignedProjects?: string[]; monthlySalary?: number;
  emiratesIdExpiry?: string | null; visaExpiry?: string | null; passportExpiry?: string | null;
};
type Vehicle = {
  id: string; plateNumber?: string; make?: string; model?: string;
  status?: string; assignedTo?: string;
  mulkiyaExpiry?: string | null; registrationExpiry?: string | null; insuranceExpiry?: string | null;
  currentPossession?: any;
};
type Invoice = {
  id: string;
  documentNo?: string;
  date?: string;
  invoiceDate?: string;
  createdAt?: string;
  amount?: number;
  total?: number;
  grandTotal?: number;
  totalAmount?: number;
  amountWithVat?: number;
  projectId?: string;
};
type Collection = {
  id: string;
  date: string;
  amount: number;
  invoiceId?: string;
  invoiceNo?: string;
  invoiceDocumentNo?: string;
  taxInvoiceId?: string;
};
type Partner = { id: string; name: string; sharePercent?: number };
type PartnerTx = { id: string; partnerId: string; type: "contribution" | "draw"; amount: number; date: string };
type AuditLog = {
  id: string; userEmail?: string | null; action: string;
  entityType: string; entityId: string; entityName?: string | null;
  details?: string | null; timestamp: string | null;
};
type VaultDoc = { id: string; label: string; expiryDate?: string | null; category?: string };

const AGING_COLORS = { "0-30": "#0f766e", "31-60": "#c9a84c", "61-90": "#ea580c", "90+": "#b91c1c" };

function actionVerb(action: string): string {
  return ({ create: "created", update: "updated", delete: "deleted", approve: "approved", convert: "converted", login: "logged in to" } as any)[action] || action;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function CompanyOverviewPage() {
  const { role, loading: roleLoading } = useRole();
   const t = useChartTheme();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projectExp, setProjectExp] = useState<PE[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [lpos, setLpos] = useState<LPO[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerTx, setPartnerTx] = useState<PartnerTx[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [b, e, pe, q, l, p, emp, v, inv, col, prt, ptx, al, vd] = await Promise.all([
          apiCall<{ accounts: Bank[] }>("/api/bank-accounts").catch(() => ({ accounts: [] as Bank[] })),
          apiCall<{ expenses: Expense[] }>("/api/expenses").catch(() => ({ expenses: [] as Expense[] })),
          apiCall<{ expenses: PE[] }>("/api/project-expenses").catch(() => ({ expenses: [] as PE[] })),
          apiCall<{ quotations: Quotation[] }>("/api/quotation").catch(() => ({ quotations: [] as Quotation[] })),
          apiCall<{ lpos: LPO[] }>("/api/lpo").catch(() => ({ lpos: [] as LPO[] })),
          apiCall<{ projects: Project[] }>("/api/accounts-projects").catch(() => ({ projects: [] as Project[] })),
          apiCall<{ employees: Employee[] }>("/api/employees").catch(() => ({ employees: [] as Employee[] })),
          apiCall<{ vehicles: Vehicle[] }>("/api/vehicles").catch(() => ({ vehicles: [] as Vehicle[] })),
          apiCall<{ invoices: Invoice[] }>("/api/tax-invoice").catch(() => ({ invoices: [] as Invoice[] })),
          apiCall<{ collections: Collection[] }>("/api/collections").catch(() => ({ collections: [] as Collection[] })),
          apiCall<{ partners: Partner[] }>("/api/partners").catch(() => ({ partners: [] as Partner[] })),
          apiCall<{ transactions: PartnerTx[] }>("/api/partner-transactions").catch(() => ({ transactions: [] as PartnerTx[] })),
          apiCall<{ logs: AuditLog[] }>("/api/audit-logs?limit=20").catch(() => ({ logs: [] as AuditLog[] })),
          apiCall<{ documents: VaultDoc[] }>("/api/vault").catch(() => ({ documents: [] as VaultDoc[] })),
        ]);
        setBanks(b.accounts || []);
        setExpenses(e.expenses || []);
        setProjectExp(pe.expenses || []);
        setQuotations(q.quotations || []);
        setLpos(l.lpos || []);
        setProjects(p.projects || []);
        setEmployees(emp.employees || []);
        setVehicles(v.vehicles || []);
        setInvoices(inv.invoices || []);
        setCollections(col.collections || []);
        setPartners(prt.partners || []);
        setPartnerTx(ptx.transactions || []);
        setAuditLogs(al.logs || []);
        setVaultDocs(vd.documents || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Cash & Runway ----------
  const cashOnHand = useMemo(() => banks.reduce((s, b) => s + (b.currentBalance || 0), 0), [banks]);
  const monthlyBurn = useMemo(() => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
    const all = [...expenses, ...projectExp].filter((x) => new Date(x.date) >= cutoff);
    return all.reduce((s, x) => s + x.amount, 0) / 3;
  }, [expenses, projectExp]);
  const runwayMonths = monthlyBurn > 0 ? cashOnHand / monthlyBurn : 0;
  const runwayColor = runwayMonths < 3 ? "#b91c1c" : runwayMonths < 6 ? "#c9a84c" : "#0f766e";

  // ---------- Win/Loss (current quarter) ----------
  const { quarterQuotations, wonQuotations, winRatePct, pendingValue } = useMemo(() => {
    const qStart = new Date();
    qStart.setMonth(Math.floor(qStart.getMonth() / 3) * 3, 1);
    qStart.setHours(0, 0, 0, 0);
    const qq = quotations.filter((q) => new Date(q.date) >= qStart);
    const won = qq.filter((q) =>
      q.convertedProjectId ||
      projects.some((p) => p.sourceQuotationId === q.id || (q.documentNo && p.quotationNo === q.documentNo))
    );
    const pendingTotal = qq.filter((q) => !won.includes(q)).reduce((s, q) => s + (q.total || 0), 0);
    const pct = qq.length > 0 ? Math.round((won.length / qq.length) * 100) : 0;
    return { quarterQuotations: qq, wonQuotations: won, winRatePct: pct, pendingValue: pendingTotal };
  }, [quotations, projects]);

  const winLossData = [
    { name: "Won (Converted)", value: wonQuotations.length, fill: t.series.revenue },
    { name: "Pending", value: quarterQuotations.length - wonQuotations.length, fill: t.series.accent },
  ].filter((d) => d.value > 0);

  // ---------- Pipeline ----------
  const pipelineData = useMemo(() => {
    const activeProjectsValue = projects
      .filter((p) => p.status === "Planning" || p.status === "Ongoing")
      .reduce((s, p) => s + (p.contractValue || 0), 0);
    const activeTendersValue = pendingValue;
    return [
      { name: "Active Tenders", value: activeTendersValue, fill: t.series.accent },
      { name: "Secured Projects", value: activeProjectsValue, fill: t.series.primary },
    ];
  }, [projects, pendingValue, t.series.accent, t.series.primary]);
  const pipelineValue = pipelineData[1].value;

  // ---------- Workforce ----------
  const deptData = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e) => {
      const d = e.department || "Unassigned";
      map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map, ([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count);
  }, [employees]);

  const mobilization = useMemo(() => {
    const onProjects = employees.filter((e) => {
      const a = e.assignedProjectIds || e.assignedProjects || [];
      return Array.isArray(a) && a.length > 0;
    }).length;
    return {
      onProjects,
      bench: employees.length - onProjects,
      pct: employees.length > 0 ? Math.round((onProjects / employees.length) * 100) : 0,
    };
  }, [employees]);

  // ---------- Fleet ----------
  const fleet = useMemo(() => {
    const total = vehicles.length;
    const onSite = vehicles.filter((v) => v.currentPossession || v.status === "Assigned" || v.status === "On-site" || !!v.assignedTo).length;
    const maintenance = vehicles.filter((v) => v.status === "Maintenance").length;
    const available = Math.max(0, total - onSite - maintenance);
    return { total, onSite, maintenance, available };
  }, [vehicles]);

  // ---------- Receivables Aging ----------
  const aging = useMemo(() => {
    const today = Date.now();
    const buckets: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

    invoices.forEach((inv: any) => {
      // Try multiple possible field names for the invoice amount
      const invoiceAmount =
        Number(inv.amount) ||
        Number(inv.total) ||
        Number(inv.grandTotal) ||
        Number(inv.totalAmount) ||
        Number(inv.amountWithVat) ||
        0;

      if (invoiceAmount <= 0) return;

      // Try multiple possible field names linking collections back to invoices
      const received = collections
        .filter((c: any) => {
          return (
            c.invoiceId === inv.id ||
            c.invoiceNo === inv.documentNo ||
            c.invoiceDocumentNo === inv.documentNo ||
            c.taxInvoiceId === inv.id
          );
        })
        .reduce((s, c: any) => s + (Number(c.amount) || 0), 0);

      const outstanding = invoiceAmount - received;
      if (outstanding <= 0) return;

      const invoiceDate = inv.date || inv.invoiceDate || inv.createdAt;
      if (!invoiceDate) return;

      const days = Math.floor((today - new Date(invoiceDate).getTime()) / 86400000);
      if (days <= 30) buckets["0-30"] += outstanding;
      else if (days <= 60) buckets["31-60"] += outstanding;
      else if (days <= 90) buckets["61-90"] += outstanding;
      else buckets["90+"] += outstanding;
    });

    return buckets;
  }, [invoices, collections]);
  const totalOutstanding = Object.values(aging).reduce((s, v) => s + v, 0);
  const overdue60Plus = aging["61-90"] + aging["90+"];

  // ---------- Partners ----------
  const partnerData = useMemo(() => {
    const enriched = partners.map((p) => {
      const txs = partnerTx.filter((t) => t.partnerId === p.id);
      const contributions = txs.filter((t) => t.type === "contribution").reduce((s, t) => s + t.amount, 0);
      const draws = txs.filter((t) => t.type === "draw").reduce((s, t) => s + t.amount, 0);
      return { ...p, contributions, draws, net: contributions - draws };
    });
    const totalNet = enriched.reduce((s, p) => s + p.net, 0);
    return enriched.map((p) => ({ ...p, percentOfTotal: totalNet > 0 ? (p.net / totalNet) * 100 : 0 }));
  }, [partners, partnerTx]);

  // ---------- Briefing ----------
  const briefing = useMemo(() => {
    const lines: { text: string; tone: "info" | "warn" | "good" }[] = [];

    const pendingQ = quarterQuotations.length - wonQuotations.length;
    if (pendingQ > 0) {
      lines.push({
        text: `${pendingQ} quotation${pendingQ === 1 ? "" : "s"} pending client approval, totaling ${fmtAED(pendingValue)}.`,
        tone: "info",
      });
    }

    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
    const lastMonth = new Date(thisMonth); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const tCol = collections.filter((c) => new Date(c.date) >= thisMonth).reduce((s, c) => s + c.amount, 0);
    const lCol = collections.filter((c) => new Date(c.date) >= lastMonth && new Date(c.date) < thisMonth).reduce((s, c) => s + c.amount, 0);
    const tExp = [...expenses, ...projectExp].filter((e) => new Date(e.date) >= thisMonth).reduce((s, e) => s + e.amount, 0);
    const lExp = [...expenses, ...projectExp].filter((e) => new Date(e.date) >= lastMonth && new Date(e.date) < thisMonth).reduce((s, e) => s + e.amount, 0);
    const tFlow = tCol - tExp;
    const lFlow = lCol - lExp;
    if (lFlow !== 0) {
      const change = ((tFlow - lFlow) / Math.abs(lFlow)) * 100;
      lines.push({
        text: `Cash flow is ${change >= 0 ? "positive" : "negative"} (${change >= 0 ? "+" : ""}${change.toFixed(0)}%) vs last month.`,
        tone: change >= 0 ? "good" : "warn",
      });
    }

    if (overdue60Plus > 0) {
      lines.push({ text: `${fmtAED(overdue60Plus)} in invoices overdue 60+ days — collection action recommended.`, tone: "warn" });
    }

    // Vault — expiring documents
    const expiringVault = vaultDocs.filter((d) => {
      const days = daysUntil(d.expiryDate);
      return days !== null && days >= 0 && days <= 30;
    });
    const expiredVault = vaultDocs.filter((d) => {
      const days = daysUntil(d.expiryDate);
      return days !== null && days < 0;
    });
    if (expiredVault.length > 0) {
      lines.push({
        text: `${expiredVault.length} corporate document${expiredVault.length === 1 ? "" : "s"} already EXPIRED (${expiredVault.map((d) => d.label).slice(0, 2).join(", ")}${expiredVault.length > 2 ? "…" : ""}).`,
        tone: "warn",
      });
    }
    if (expiringVault.length > 0) {
      lines.push({
        text: `${expiringVault.length} corporate document${expiringVault.length === 1 ? "" : "s"} expiring within 30 days (${expiringVault.map((d) => d.label).slice(0, 2).join(", ")}${expiringVault.length > 2 ? "…" : ""}).`,
        tone: "warn",
      });
    }

    // Employees — visa/EID/passport expiring
    const expiringEmployees = employees.filter((e) => {
      return [e.emiratesIdExpiry, e.visaExpiry, e.passportExpiry].some((d) => {
        const days = daysUntil(d);
        return days !== null && days >= 0 && days <= 30;
      });
    });
    if (expiringEmployees.length > 0) {
      lines.push({
        text: `${expiringEmployees.length} employee compliance document${expiringEmployees.length === 1 ? "" : "s"} (visa/EID/passport) expiring within 30 days.`,
        tone: "warn",
      });
    }

    // Vehicles — Mulkiya/insurance expiring
    const expiringVehicles = vehicles.filter((v) => {
      return [v.mulkiyaExpiry, v.registrationExpiry, v.insuranceExpiry].some((d) => {
        const days = daysUntil(d);
        return days !== null && days >= 0 && days <= 30;
      });
    });
    if (expiringVehicles.length > 0) {
      lines.push({
        text: `${expiringVehicles.length} vehicle Mulkiya/insurance document${expiringVehicles.length === 1 ? "" : "s"} expiring within 30 days.`,
        tone: "warn",
      });
    }

    const active = projects.filter((p) => p.status === "Ongoing");
    const overBudget = active.filter((p) => {
      const spent = projectExp.filter((e) => e.projectId === p.id).reduce((s, e) => s + e.amount, 0);
      return p.budgetedCost && spent > p.budgetedCost;
    });
    lines.push({
      text: `${active.length} active project${active.length === 1 ? "" : "s"}${overBudget.length > 0 ? `, ${overBudget.length} over budget` : ""}.`,
      tone: overBudget.length > 0 ? "warn" : "info",
    });

    if (runwayMonths > 0 && runwayMonths < 3) {
      lines.push({ text: `⚠ Runway is short (${runwayMonths.toFixed(1)} months). Increase collections or trim expenses.`, tone: "warn" });
    }

    return lines;
  }, [
    quarterQuotations, wonQuotations, pendingValue, collections, expenses, projectExp,
    projects, overdue60Plus, runwayMonths, vaultDocs, employees, vehicles,
  ]);

  // ---------- Render ----------
  if (roleLoading || loading) {
    return <Loader compact />;
  }
  if (role !== "admin") {
    return <div className="text-center py-16 text-red-500">403 — Founders' dashboard is admin-only.</div>;
  }

  const runwayDisplay = monthlyBurn === 0 ? "∞" : runwayMonths > 24 ? "24+" : runwayMonths.toFixed(1);

  return (
    <div>
      {/* Header */}
      
      <div className="flex items-center gap-3 mb-1 animate-fade-in-up">
        <Crown size={24} className="text-gold" />
        <h1 className="font-display text-3xl font-bold text-navy dark:text-white">Company Overview</h1>
      </div>
      <p className="text-navy-400 text-sm mb-6">Founders' dashboard — bird's-eye view of operations, cash, and team.</p>
      <WelcomeBanner tagline="Centralize corporate identity, compliance, and essential business records." />
      <ModuleSearchBar module="company-overview" placeholder="Search company data…" />

      {/* Hero KPIs */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
  {[
    { label: "Cash on Hand",         value: fmtAED(cashOnHand),                                                   icon: Wallet,        color: "from-emerald-600 to-emerald-700" },
    { label: "Runway (3mo burn)",    value: `${runwayDisplay} months`,                                            icon: Clock,         color: runwayMonths < 3 ? "from-rose-600 to-rose-700" : runwayMonths < 6 ? "from-amber-600 to-amber-700" : "from-teal-600 to-teal-700" },
    { label: "Win Rate (Quarter)",   value: `${winRatePct}%`,                                                     icon: CheckCircle2,  brand: true },
    { label: "Active Pipeline",      value: fmtAED(pipelineValue),                                                icon: TrendingUp,    color: "from-gold to-gold-500", text: "text-navy" },
  ].map((k, i) => (
    <div
      key={k.label}
      className={`${(k as any).brand ? "bg-brand-navy" : `bg-gradient-to-br ${k.color}`} ${(k as any).text || "text-white"} rounded-2xl p-4 shadow-sm animate-fade-in-up`}
      style={{ animationDelay: `${i * 0.05}s` }}
    >
      <k.icon size={18} className="opacity-80 mb-2" />
      <p className="text-xs font-bold uppercase opacity-80">{k.label}</p>
      <p className="text-lg font-bold mt-1 truncate">{k.value}</p>
    </div>
  ))}
</div>
      {/* Executive Briefing */}
      <div className="bg-brand-navy rounded-2xl p-5 mb-5 text-white relative overflow-hidden animate-fade-in-up delay-1 shadow-md">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={18} className="text-gold" />
            <h2 className="font-display text-lg font-bold">Executive Flash Briefing</h2>
          </div>
          {briefing.length === 0 ? (
            <p className="text-white/85 text-sm">All quiet on the dashboard — no urgent items today.</p>
          ) : (
            <ul className="space-y-1.5">
              {briefing.map((b, i) => (
                <li key={i} className={`text-sm flex items-start gap-2 ${b.tone === "warn" ? "text-amber-200" : b.tone === "good" ? "text-emerald-200" : "text-white/85"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${b.tone === "warn" ? "bg-amber-300" : b.tone === "good" ? "bg-emerald-300" : "bg-gold"}`} />
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Module shortcut cards (Vault, Brand, Contacts, Assets, Audit) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <Link href="/dashboard/company-overview/vault"
  className="bg-brand-navy text-white rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center"><Shield size={20} className="text-gold" /></div>
            <h3 className="font-display text-base font-bold">Corporate Vault</h3>
          </div>
          <p className="text-white/85 text-xs">Trade licenses, IDs, certificates with auto-extraction & expiry alerts.</p>
        </Link>

        <Link href="/dashboard/marketing/brand-hub"
  className="bg-gradient-to-br from-gold to-gold-500 text-navy rounded-2xl p-5 shadow-sm hover:scale-[1.01] transition-all animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center"><Palette size={20} className="text-navy" /></div>
            <h3 className="font-display text-base font-bold">Brand Hub</h3>
          </div>
          <p className="text-navy/80 text-xs">Logos, letterheads, stamps — single source of truth for brand assets.</p>
        </Link>

        <Link href="/dashboard/company-overview/contacts"
          className="bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl p-5 shadow-sm hover:scale-[1.01] transition-all animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Users size={20} className="text-white" /></div>
            <h3 className="font-display text-base font-bold">Contacts Directory</h3>
          </div>
          <p className="text-teal-100 text-xs">Subcontractors, suppliers, consultants, labour with ratings.</p>
        </Link>

        <Link href="/dashboard/logistics/assets"
          className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl p-5 shadow-sm hover:scale-[1.01] transition-all animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Wrench size={20} className="text-white" /></div>
            <h3 className="font-display text-base font-bold">High-Value Assets</h3>
          </div>
          <p className="text-emerald-100 text-xs">Track expensive tools and equipment with current location.</p>
        </Link>

        <Link href="/dashboard/company-overview/audit-log"
          className="bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-2xl p-5 shadow-sm hover:scale-[1.01] transition-all animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Activity size={20} className="text-white" /></div>
            <h3 className="font-display text-base font-bold">Audit Trail</h3>
          </div>
          <p className="text-purple-100 text-xs">Who did what — full action history across all modules.</p>
        </Link>
      </div>

      {/* Row 1: Runway / Win-Loss / Pipeline */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Runway gauge */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-2">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Runway</h3>
          <p className="text-navy-400 text-xs mb-2">Cash ÷ trailing 3-month burn</p>
          <div className="relative h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="65%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={[{ name: "runway", value: Math.min(runwayMonths, 12), fill: runwayColor }]}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: t.grid }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
              <p className="text-3xl font-bold" style={{ color: runwayColor }}>{runwayDisplay}</p>
              <p className="text-xs text-navy-400 font-semibold">months</p>
            </div>
          </div>
          <div className="text-xs text-navy-400 text-center">
            Burn: <span className="font-bold text-navy dark:text-white">{fmtAED(monthlyBurn)}</span>/mo
          </div>
        </div>

        {/* Win/Loss donut */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-3">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Win/Loss Ratio</h3>
          <p className="text-navy-400 text-xs mb-3">Quotations → Projects this quarter</p>
          {winLossData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-navy-300 text-sm">No quotations this quarter.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={winLossData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                  {winLossData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={t.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: t.legendText }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <p className="text-center text-xs text-navy-400 mt-1">
            {wonQuotations.length} won · {quarterQuotations.length - wonQuotations.length} pending
          </p>
        </div>

        {/* Pipeline */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-4">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Top-Line Pipeline</h3>
          <p className="text-navy-400 text-xs mb-3">Active tenders vs secured projects</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pipelineData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
              <XAxis type="number" tick={{ fontSize: 10, fill: t.axisText }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: t.axisText }} width={100} />
              <Tooltip contentStyle={t.tooltipStyle} formatter={(v: number) => fmtAED(v)} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {pipelineData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Workforce + Fleet */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Workforce */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-base font-bold text-navy dark:text-white flex items-center gap-2"><Users size={16} /> Workforce Snapshot</h3>
            <Link href="/dashboard/hr/employees" className="text-xs text-gold font-semibold hover:underline">Manage →</Link>
          </div>
          <p className="text-navy-400 text-xs mb-3">{employees.length} total employees</p>

          {/* Mobilization */}
          <div className="bg-navy-50 dark:bg-navy-700 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-navy dark:text-white">MOBILIZATION RATE</span>
              <span className="text-lg font-bold text-navy dark:text-white">{mobilization.pct}%</span>
            </div>
            <div className="h-2 bg-white dark:bg-navy-800 rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${mobilization.pct}%` }} />
            </div>
            <p className="text-[10px] text-navy-400 font-semibold mt-1">
              {mobilization.onProjects} on projects · {mobilization.bench} on bench
            </p>
          </div>

          {/* Headcount by Department */}
          <p className="text-xs font-bold text-navy-400 uppercase mb-2">Headcount by Department</p>
          {deptData.length === 0 ? (
            <div className="text-center py-6 text-navy-300 text-xs">No employees added yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, deptData.length * 28)}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: t.axisText }} allowDecimals={false} />
                <YAxis type="category" dataKey="dept" tick={{ fontSize: 11, fill: t.axisText }} width={120} />
                <Tooltip contentStyle={t.tooltipStyle} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {deptData.map((_, i) => <Cell key={i} fill={t.palette[i % t.palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Fleet */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-base font-bold text-navy dark:text-white flex items-center gap-2"><Truck size={16} /> Fleet Utility</h3>
            <Link href="/dashboard/logistics/vehicles" className="text-xs text-gold font-semibold hover:underline">Manage →</Link>
          </div>
          <p className="text-navy-400 text-xs mb-4">{fleet.total} vehicle{fleet.total === 1 ? "" : "s"} in fleet</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fleet.onSite}</p>
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">On-site</p>
            </div>
            <div className="bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-navy dark:text-white">{fleet.available}</p>
              <p className="text-[10px] font-bold text-navy-400 uppercase">Available</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{fleet.maintenance}</p>
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Maintenance</p>
            </div>
          </div>

          <div className="bg-navy-50 dark:bg-navy-700 rounded-xl p-3 text-xs text-navy-400">
            <p className="font-bold text-navy dark:text-white mb-1">Compliance tracking active</p>
            Mulkiya & insurance expiry alerts surface in the briefing above. Add Salik & fuel data in the Logistics module.
          </div>
        </div>
      </div>

      {/* Receivables Heatmap */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm mb-5 animate-fade-in-up">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-base font-bold text-navy dark:text-white flex items-center gap-2"><AlertTriangle size={16} /> Receivables Heatmap</h3>
          <Link href="/dashboard/accounts/invoicing" className="text-xs text-gold font-semibold hover:underline">View invoices →</Link>
        </div>
        <p className="text-navy-400 text-xs mb-4">
          Total outstanding: <span className="font-bold text-navy dark:text-white">{fmtAED(totalOutstanding)}</span>
          {overdue60Plus > 0 && <> · <span className="font-bold text-red-600">{fmtAED(overdue60Plus)} overdue 60+ days</span></>}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(aging) as [keyof typeof AGING_COLORS, number][]).map(([bucket, value]) => {
            const pct = totalOutstanding > 0 ? (value / totalOutstanding) * 100 : 0;
            return (
              <div key={bucket} className="rounded-xl p-4 border border-navy-100 dark:border-navy-700" style={{ background: `${AGING_COLORS[bucket]}10` }}>
                <p className="text-xs font-bold uppercase" style={{ color: AGING_COLORS[bucket] }}>{bucket} days</p>
                <p className="text-xl font-bold text-navy dark:text-white mt-1">{fmtAED(value)}</p>
                <div className="h-1.5 bg-white dark:bg-navy-900 rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: AGING_COLORS[bucket] }} />
                </div>
                <p className="text-[10px] text-navy-400 font-semibold mt-1">{pct.toFixed(0)}% of total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4: Partner Equity + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Partner Equity */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base font-bold text-navy dark:text-white flex items-center gap-2"><Crown size={16} /> Partner Equity</h3>
            <Link href="/dashboard/accounts/partners" className="text-xs text-gold font-semibold hover:underline">Manage →</Link>
          </div>
          {partnerData.length === 0 ? (
            <div className="text-center py-8 text-navy-300 text-sm">No partners added yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100 dark:border-navy-700">
                    <th className="text-left py-2 text-xs font-bold text-navy-400 uppercase">Partner</th>
                    <th className="text-right py-2 text-xs font-bold text-navy-400 uppercase">Contributions</th>
                    <th className="text-right py-2 text-xs font-bold text-navy-400 uppercase">Draws</th>
                    <th className="text-right py-2 text-xs font-bold text-navy-400 uppercase">Net</th>
                    <th className="text-right py-2 text-xs font-bold text-navy-400 uppercase">%</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerData.map((p) => (
                    <tr key={p.id} className="border-b border-navy-50 dark:border-navy-700">
                      <td className="py-2.5 font-bold text-navy dark:text-white">{p.name}</td>
                      <td className="py-2.5 text-right text-navy dark:text-white">{fmtAED(p.contributions)}</td>
                      <td className="py-2.5 text-right text-red-500">{fmtAED(p.draws)}</td>
                      <td className="py-2.5 text-right font-bold text-navy dark:text-white">{fmtAED(p.net)}</td>
                      <td className="py-2.5 text-right font-bold text-gold">{p.percentOfTotal.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base font-bold text-navy dark:text-white flex items-center gap-2"><Activity size={16} /> Recent Activity</h3>
            <Link href="/dashboard/company-overview/audit-log" className="text-xs text-gold font-semibold hover:underline">View all →</Link>
          </div>
          {auditLogs.length === 0 ? (
            <div className="text-center py-8 text-navy-300 text-sm">
              <p>No activity logged yet.</p>
              <p className="text-xs mt-1">Activity appears here as users create, update, or approve records.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-navy-50 dark:border-navy-700 last:border-0 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-gold mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy dark:text-white">
                      <span className="font-bold">{log.userEmail?.split("@")[0] || "Unknown"}</span>
                      {" "}{actionVerb(log.action)}{" "}
                      <span className="font-bold uppercase text-xs bg-navy-50 dark:bg-navy-700 px-1.5 py-0.5 rounded">{log.entityType}</span>
                      {" "}<span className="font-mono text-xs text-navy-400">{log.entityName || log.entityId}</span>
                    </p>
                    {log.details && <p className="text-xs text-navy-400 mt-0.5">{log.details}</p>}
                    <p className="text-[11px] text-navy-300 font-semibold mt-0.5">{relativeTime(log.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <FloatingActionMenu
  actions={[
    { icon: FileUp, label: "Upload Corporate Document",     href: "/dashboard/company-overview/vault?action=upload" },
    { icon: Banknote, label: "Log Capital/Equity Update",     href: "/dashboard/accounts/partners?action=new" },
    { icon: Announcement, label: "Post Company-Wide Announcement", onClick: () => alert("Announcements module coming soon — will broadcast a banner to all users.") },
  ]}
/>
      </div>
    </div>
  );
}
