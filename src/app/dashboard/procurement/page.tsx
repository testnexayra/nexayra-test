"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import { ShoppingCart, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import Link from "next/link";
import WelcomeBanner from "@/components/WelcomeBanner";
import ModuleSearchBar from "@/components/ModuleSearchBar";
import { useChartTheme } from "@/lib/chart-theme";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import { PackageCheck, Building2 } from "lucide-react";


type Lpo = { nxrNo: number; clientName: string; vendorName: string; total: number; approved: boolean; createdAt: string };

export default function ProcurementDashboard() {
  const t = useChartTheme();
  const [lpos, setLpos] = useState<Lpo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await apiCall<{lpos: Lpo[]}>("/api/lpo"); setLpos(r.lpos || []); }
      finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => {
    const total = lpos.length;
    const approved = lpos.filter(l => l.approved).length;
    const pending = total - approved;
    const totalValue = lpos.reduce((s,l)=>s+(l.total||0),0);
    return { total, approved, pending, totalValue };
  }, [lpos]);

  const byVendor = useMemo(() => {
    const map = new Map<string, number>();
    lpos.forEach(l => {
      const v = l.vendorName || "Unknown";
      map.set(v, (map.get(v)||0) + (l.total||0));
    });
    return Array.from(map.entries()).map(([name, value])=>({name, value})).sort((a,b)=>b.value-a.value).slice(0,6);
  }, [lpos]);

  const monthly = useMemo(() => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const year = new Date().getFullYear();
    return months.map((m,i) => {
      const count = lpos.filter(l => { const d = new Date(l.createdAt); return d.getFullYear()===year && d.getMonth()===i; }).length;
      return { month: m, count };
    });
  }, [lpos]);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <WelcomeBanner tagline="Streamline purchasing, manage vendors, and control project costs." />
      <ModuleSearchBar module="procurement" placeholder="Search LPOs, vendors…" />

      {/* KPIs — Pending and Approved tiles are clickable */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/dashboard/procurement/lpo/history"
          className="bg-brand-navy text-white rounded-2xl p-5 hover-lift hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-center gap-2 mb-2"><ShoppingCart size={16}/><p className="text-white/80 text-xs uppercase font-bold">Total LPOs</p></div>
          <p className="text-2xl font-bold">{kpis.total}</p>
          <p className="text-[10px] text-white/60 mt-1">Click to view all →</p>
        </Link>

        <Link
          href="/dashboard/procurement/lpo/history?status=approved"
          className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift hover:border-green-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2"><CheckCircle size={16} className="text-green-600"/><p className="text-green-600 text-xs uppercase font-bold">Approved</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{kpis.approved}</p>
          <p className="text-[10px] text-navy-400 mt-1">Click to view approved →</p>
        </Link>

        <Link
          href="/dashboard/procurement/lpo/history?status=pending"
          className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2"><Clock size={16} className="text-amber-600"/><p className="text-amber-600 text-xs uppercase font-bold">Pending</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{kpis.pending}</p>
          <p className="text-[10px] text-navy-400 mt-1">Click to view pending →</p>
        </Link>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-gold"/><p className="text-gold text-xs uppercase font-bold">Total Value</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{fmtAED(kpis.totalValue)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Top Vendors by Value</h3>
          {byVendor.length === 0 ? <p className="text-navy dark:text-white-300 text-center py-12">No LPOs yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byVendor} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                  {byVendor.map((_, i) => <Cell key={i} fill={t.palette[i % t.palette.length]}/>)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtAED(v)} contentStyle={t.tooltipStyle}/>
                <Legend wrapperStyle={{ fontSize: "11px", color: t.legendText }}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">LPOs by Month ({new Date().getFullYear()})</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid}/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.axisText }}/>
              <YAxis tick={{ fontSize: 11, fill: t.axisText }}/>
              <Tooltip contentStyle={t.tooltipStyle}/>
              <Bar dataKey="count" fill={t.series.primary} name="LPOs" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white">Recent LPOs</h3>
          <Link href="/dashboard/procurement/lpo/history" className="text-sm text-navy dark:text-white font-lato-semibold hover:underline">View all →</Link>
        </div>
        {lpos.slice(0,5).length === 0 ? <p className="text-navy dark:text-white-300 text-center py-8">No LPOs yet.</p> : (
          <div className="space-y-2">
            {lpos.slice(0,5).map(l => (
              <div key={l.nxrNo} className="flex items-center justify-between p-3 bg-navy-50/30 dark:bg-navy-700/30 rounded-lg">
                <div>
                  <p className="font-semibold text-navy dark:text-white">LPO #{l.nxrNo} · {l.vendorName}</p>
                  <p className="text-xs text-navy dark:text-white">{fmtDate(l.createdAt)} · {l.clientName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{l.approved ? "Approved" : "Pending"}</span>
                  <span className="font-bold text-navy dark:text-white">{fmtAED(l.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <FloatingActionMenu
        actions={[
          { icon: ShoppingCart, label: "Generate New LPO",       href: "/dashboard/procurement/lpo" },
          { icon: PackageCheck, label: "Log Goods Receipt Note", onClick: () => alert("GRN module coming soon.") },
          { icon: Building2, label: "Add New Vendor",          href: "/dashboard/procurement/lpo?action=newVendor" },
        ]}
      />
    </div>
  );
}