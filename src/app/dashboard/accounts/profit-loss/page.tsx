"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import Loader from "@/components/Loader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, Target, Percent } from "lucide-react";
import { useChartTheme } from "@/lib/chart-theme";


type Expense = { id: string; date: string; amount: number };
type PE = { id: string; date: string; amount: number; projectId: string };
type Col = { id: string; date: string; amount: number };
type Project = { id: string; name: string; contractValue: number };

export default function ProfitLossPage() {
   const t = useChartTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projectExp, setProjectExp] = useState<PE[]>([]);
  const [collections, setCollections] = useState<Col[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"quarter" | "year" | "month">("quarter");
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    (async () => {
      try {
        const [e, pe, c, p] = await Promise.all([
          apiCall<{expenses: Expense[]}>("/api/expenses"),
          apiCall<{expenses: PE[]}>("/api/project-expenses"),
          apiCall<{collections: Col[]}>("/api/collections"),
          apiCall<{projects: Project[]}>("/api/accounts-projects"),
        ]);
        setExpenses(e.expenses); setProjectExp(pe.expenses); setCollections(c.collections); setProjects(p.projects);
      } finally { setLoading(false); }
    })();
  }, []);

  const periods = useMemo(() => {
    const inYear = (iso: string) => new Date(iso).getFullYear() === year;
    const qOf = (iso: string) => Math.floor(new Date(iso).getMonth() / 3) + 1;
    const mOf = (iso: string) => new Date(iso).getMonth();
    const buckets: { label: string; revenue: number; companyExp: number; projectExp: number; expenses: number; profit: number; margin: number }[] = [];

    if (period === "year") {
      const revenue = collections.filter(c => inYear(c.date)).reduce((s,c)=>s+c.amount,0);
      const companyExp = expenses.filter(e => inYear(e.date)).reduce((s,e)=>s+e.amount,0);
      const projectExpSum = projectExp.filter(e => inYear(e.date)).reduce((s,e)=>s+e.amount,0);
      const exp = companyExp + projectExpSum;
      const profit = revenue - exp;
      buckets.push({ label: String(year), revenue, companyExp, projectExp: projectExpSum, expenses: exp, profit, margin: revenue > 0 ? (profit/revenue)*100 : 0 });
    } else if (period === "quarter") {
      for (let q = 1; q <= 4; q++) {
        const revenue = collections.filter(c => inYear(c.date) && qOf(c.date) === q).reduce((s,c)=>s+c.amount,0);
        const companyExp = expenses.filter(e => inYear(e.date) && qOf(e.date) === q).reduce((s,e)=>s+e.amount,0);
        const projectExpSum = projectExp.filter(e => inYear(e.date) && qOf(e.date) === q).reduce((s,e)=>s+e.amount,0);
        const exp = companyExp + projectExpSum;
        const profit = revenue - exp;
        buckets.push({ label: `Q${q}`, revenue, companyExp, projectExp: projectExpSum, expenses: exp, profit, margin: revenue > 0 ? (profit/revenue)*100 : 0 });
      }
    } else {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      for (let m = 0; m < 12; m++) {
        const revenue = collections.filter(c => inYear(c.date) && mOf(c.date) === m).reduce((s,c)=>s+c.amount,0);
        const companyExp = expenses.filter(e => inYear(e.date) && mOf(e.date) === m).reduce((s,e)=>s+e.amount,0);
        const projectExpSum = projectExp.filter(e => inYear(e.date) && mOf(e.date) === m).reduce((s,e)=>s+e.amount,0);
        const exp = companyExp + projectExpSum;
        const profit = revenue - exp;
        buckets.push({ label: months[m], revenue, companyExp, projectExp: projectExpSum, expenses: exp, profit, margin: revenue > 0 ? (profit/revenue)*100 : 0 });
      }
    }
    return buckets;
  }, [expenses, projectExp, collections, period, year]);

  const totals = useMemo(() => {
    const revenue = periods.reduce((s,p)=>s+p.revenue,0);
    const companyExp = periods.reduce((s,p)=>s+p.companyExp,0);
    const projectExpTotal = periods.reduce((s,p)=>s+p.projectExp,0);
    const expenses = companyExp + projectExpTotal;
    const profit = revenue - expenses;
    const margin = revenue > 0 ? (profit/revenue)*100 : 0;
    return { revenue, companyExp, projectExp: projectExpTotal, expenses, profit, margin };
  }, [periods]);

  const projectProfitability = useMemo(() => {
    // Need per-project invoice collections too, but we approximate using projectExpenses
    return projects.map(p => {
      const expForP = projectExp.filter(e => e.projectId === p.id).reduce((s,e)=>s+e.amount,0);
      return { name: p.name, contractValue: p.contractValue || 0, expenses: expForP, margin: p.contractValue > 0 ? ((p.contractValue - expForP)/p.contractValue)*100 : 0 };
    }).sort((a,b)=>b.contractValue-a.contractValue).slice(0, 8);
  }, [projects, projectExp]);

  if (loading) return <Loader fullScreen />;

  const inp = "px-3 py-2 bg-white border border-navy-200 rounded-lg text-navy dark:text-white text-sm";
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={16}/><p className="text-white/80 text-xs uppercase font-bold tracking-wider">Revenue</p></div>
          <p className="text-2xl font-bold">{fmtAED(totals.revenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><TrendingDown size={16}/><p className="text-white/80 text-xs uppercase font-bold tracking-wider">Total Expenses</p></div>
          <p className="text-2xl font-bold">{fmtAED(totals.expenses)}</p>
          <p className="text-white/80 text-xs mt-1">Company: {fmtAED(totals.companyExp)} · Project: {fmtAED(totals.projectExp)}</p>
        </div>
        <div className={`${totals.profit >= 0 ? "bg-brand-navy" : "bg-gradient-to-br from-red-600 to-red-800"} text-white rounded-2xl p-5 hover-lift`}>
          <div className="flex items-center gap-2 mb-2"><Target size={16}/><p className="text-white/80 text-xs uppercase font-bold tracking-wider">Net Profit / Loss</p></div>
          <p className="text-2xl font-bold">{fmtAED(totals.profit)}</p>
        </div>
        <div className="bg-gradient-to-br from-gold to-amber-600 text-white rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Percent size={16}/><p className="text-white/80 text-xs uppercase font-bold tracking-wider">Profit Margin</p></div>
          <p className="text-2xl font-bold">{totals.margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Period filter */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Profit & Loss Breakdown</h2>
          <div className="flex gap-2">
            <select value={period} onChange={e=>setPeriod(e.target.value as any)} className={inp}>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
            <select value={year} onChange={e=>setYear(Number(e.target.value))} className={inp}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Revenue vs Expenses chart */}
        <div className="mb-6">
          <h3 className="text-navy dark:text-white font-lato-semibold text-sm mb-3">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={periods}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid}/>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.axisText }}/>
              <YAxis tick={{ fontSize: 11, fill: t.axisText }}/>
              <Tooltip formatter={(v: number) => fmtAED(v)} contentStyle={t.tooltipStyle}/>
              <Legend wrapperStyle={{ fontSize: "12px", color: t.legendText }}/>
              <Bar dataKey="revenue" fill="#0f766e" name="Revenue" radius={[4,4,0,0]}/>
              <Bar dataKey="companyExp" fill="#b91c1c" name="Company Expenses" radius={[4,4,0,0]}/>
              <Bar dataKey="projectExp" fill="#f59e0b" name="Project Expenses" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profit line */}
        <div className="mb-6">
          <h3 className="text-navy dark:text-white font-lato-semibold text-sm mb-3">Profit Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={periods}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c9a84c" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="#c9a84c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid}/>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.axisText }}/>
              <YAxis tick={{ fontSize: 11, fill: t.axisText }}/>
              <Tooltip formatter={(v: number) => fmtAED(v)} contentStyle={t.tooltipStyle}/>
              <Area type="monotone" dataKey="profit" stroke="#c9a84c" strokeWidth={3} fill="url(#profitGrad)" name="Profit"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
              <th className="text-left py-2">Period</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Company Exp</th>
              <th className="text-right">Project Exp</th>
              <th className="text-right">Total Exp</th>
              <th className="text-right">Profit / Loss</th>
              <th className="text-right">Margin</th>
            </tr></thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.label} className="border-b border-navy-50 hover:bg-navy-50/30">
                  <td className="py-3 font-semibold text-navy dark:text-white">{p.label}</td>
                  <td className="text-right text-green-600 font-semibold">{fmtAED(p.revenue)}</td>
                  <td className="text-right text-red-500">{fmtAED(p.companyExp)}</td>
                  <td className="text-right text-amber-600">{fmtAED(p.projectExp)}</td>
                  <td className="text-right text-red-600 font-semibold">{fmtAED(p.expenses)}</td>
                  <td className={`text-right font-bold ${p.profit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmtAED(p.profit)}</td>
                  <td className={`text-right font-semibold ${p.margin >= 0 ? "text-green-600" : "text-red-500"}`}>{p.margin.toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="bg-navy-50 font-bold">
                <td className="py-3 text-navy dark:text-white">Total</td>
                <td className="text-right text-green-600">{fmtAED(totals.revenue)}</td>
                <td className="text-right text-red-500">{fmtAED(totals.companyExp)}</td>
                <td className="text-right text-amber-600">{fmtAED(totals.projectExp)}</td>
                <td className="text-right text-red-600">{fmtAED(totals.expenses)}</td>
                <td className={`text-right ${totals.profit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmtAED(totals.profit)}</td>
                <td className={`text-right ${totals.margin >= 0 ? "text-green-600" : "text-red-500"}`}>{totals.margin.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Project profitability */}
      {projectProfitability.length > 0 && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold mb-4">Top Projects — Contract Value vs Expenses</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectProfitability} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid}/>
              <XAxis type="number" tick={{ fontSize: 11, fill: t.axisText }}/>
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: t.axisText }}/>
              <Tooltip formatter={(v: number) => fmtAED(v)} contentStyle={t.tooltipStyle}/>
              <Legend wrapperStyle={{ fontSize: "12px", color: t.legendText }}/>
              <Bar dataKey="contractValue" fill={t.series.primary} name="Contract Value" radius={[0,4,4,0]}/>
              <Bar dataKey="expenses" fill={t.series.accent} name="Expenses" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
