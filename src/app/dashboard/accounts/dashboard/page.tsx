"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import WelcomeBanner from "@/components/WelcomeBanner";
import ModuleSearchBar from "@/components/ModuleSearchBar";
import Loader from "@/components/Loader";
import { useChartTheme } from "@/lib/chart-theme";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import { Receipt, FileText, Wallet } from "lucide-react";

type Bank = { id: string; currentBalance: number };
type Expense = { id: string; date: string; amount: number; categoryId: string };
type Col = { id: string; date: string; amount: number };

export default function AccountsDashboard() {
  const t = useChartTheme();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projectExp, setProjectExp] = useState<Expense[]>([]);
  const [collections, setCollections] = useState<Col[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [b, e, pe, c, cc] = await Promise.all([
          apiCall<any>("/api/bank-accounts"),
          apiCall<any>("/api/expenses"),
          apiCall<any>("/api/project-expenses"),
          apiCall<any>("/api/collections"),
          apiCall<any>("/api/expense-categories"),
        ]);
        setBanks(b.accounts); setExpenses(e.expenses); setProjectExp(pe.expenses); setCollections(c.collections); setCats(cc.categories);
      } finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => {
    const totalCash = banks.reduce((s, b) => s + b.currentBalance, 0);
    const ytdRevenue = collections.filter(c => new Date(c.date).getFullYear() === new Date().getFullYear()).reduce((s, c) => s + c.amount, 0);
    const allExp = [...expenses, ...projectExp];
    const ytdExp = allExp.filter(e => new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((s, e) => s + e.amount, 0);
    return { totalCash, ytdRevenue, ytdExp, ytdProfit: ytdRevenue - ytdExp };
  }, [banks, collections, expenses, projectExp]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    [...expenses, ...projectExp].forEach(e => {
      const catName = cats.find(c => c.id === e.categoryId)?.name || "Uncategorized";
      map.set(catName, (map.get(catName) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [expenses, projectExp, cats]);

  const monthlyFlow = useMemo(() => {
    const year = new Date().getFullYear();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, i) => {
      const rev = collections.filter(c => { const d = new Date(c.date); return d.getFullYear() === year && d.getMonth() === i; }).reduce((s, c) => s + c.amount, 0);
      const exp = [...expenses, ...projectExp].filter(e => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() === i; }).reduce((s, e) => s + e.amount, 0);
      return { month: m, revenue: rev, expenses: exp };
    });
  }, [collections, expenses, projectExp]);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <WelcomeBanner tagline="Complete visibility into your financial health and cash flow." />
      <ModuleSearchBar module="accounts" placeholder="Search expenses, invoices, partners, bank accounts…" />

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-navy text-white rounded-2xl p-5">
          <p className="text-white/80 text-xs uppercase font-bold tracking-wider">Cash in Hand</p>
          <p className="text-2xl font-bold text-white mt-1">{fmtAED(kpis.totalCash)}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <p className="text-green-600 dark:text-green-400 text-xs uppercase font-bold tracking-wider">YTD Revenue</p>
          <p className="text-2xl font-bold text-navy dark:text-white mt-1">{fmtAED(kpis.ytdRevenue)}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <p className="text-red-500 dark:text-red-400 text-xs uppercase font-bold tracking-wider">YTD Expenses</p>
          <p className="text-2xl font-bold text-navy dark:text-white mt-1">{fmtAED(kpis.ytdExp)}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <p className="text-gold text-xs uppercase font-bold tracking-wider">YTD Profit</p>
          <p className={`text-2xl font-bold mt-1 ${kpis.ytdProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
            {fmtAED(kpis.ytdProfit)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Expenses by Category</h3>
          {byCategory.length === 0 ? (
            <p className="text-navy-400 dark:text-navy-300 text-center py-12">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                  {byCategory.map((_, i) => <Cell key={i} fill={t.palette[i % t.palette.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtAED(v)} contentStyle={t.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px", color: t.legendText }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Monthly Revenue vs Expenses ({new Date().getFullYear()})</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyFlow}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.axisText }} />
              <YAxis tick={{ fontSize: 11, fill: t.axisText }} />
              <Tooltip formatter={(v: number) => fmtAED(v)} contentStyle={t.tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: t.legendText }} />
              <Bar dataKey="revenue" fill={t.series.revenue} name="Revenue" />
              <Bar dataKey="expenses" fill={t.series.expenses} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Profit Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthlyFlow.map(m => ({ ...m, profit: m.revenue - m.expenses }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.axisText }} />
            <YAxis tick={{ fontSize: 11, fill: t.axisText }} />
            <Tooltip formatter={(v: number) => fmtAED(v)} contentStyle={t.tooltipStyle} />
            <Line type="monotone" dataKey="profit" stroke={t.series.profit} strokeWidth={3} dot={{ fill: t.series.profit, r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <FloatingActionMenu
        actions={[
          { icon: Receipt, label: "Log Quick Expense", href: "/dashboard/accounts/expenses?action=new" },
          { icon: FileText, label: "Create Tax Invoice", href: "/dashboard/accounts/tax-invoice" },
          { icon: Wallet, label: "Record Incoming Payment", href: "/dashboard/accounts/invoicing?action=record" },
        ]}
      />
    </div>
  );
}