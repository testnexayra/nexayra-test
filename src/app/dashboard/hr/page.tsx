"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { fmtAED } from "@/lib/format";
import Loader from "@/components/Loader";
import { Users, Calendar, AlertTriangle, Briefcase } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import WelcomeBanner from "@/components/WelcomeBanner";
import ModuleSearchBar from "@/components/ModuleSearchBar";
import { useChartTheme } from "@/lib/chart-theme";
import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import { UserPlus, ContactRound } from "lucide-react";


type Employee = { id: string; name: string; role: string; department: string; monthlySalary: number; status: string; visaExpiry: string; passportExpiry: string };

export default function HRDashboard() {
   const t = useChartTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await apiCall<{employees: Employee[]}>("/api/employees"); setEmployees(r.employees); }
      finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === "active").length;
    const monthlyPayroll = employees.filter(e => e.status === "active").reduce((s,e)=>s+(e.monthlySalary||0),0);
    return { total, active, monthlyPayroll, yearlyPayroll: monthlyPayroll * 12 };
  }, [employees]);

  const byRole = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach(e => { const r = e.role || "Unassigned"; map.set(r, (map.get(r)||0)+1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const today = new Date(); const soon = new Date(); soon.setDate(soon.getDate() + 60);
  const expiring = employees.filter(e => {
    const checks = [e.visaExpiry, e.passportExpiry].filter(Boolean);
    return checks.some(d => { const t = new Date(d); return t >= today && t <= soon; });
  });

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <WelcomeBanner tagline="Empower your workforce with seamless employee and compliance management." />
      <ModuleSearchBar module="hr" placeholder="Search employees…" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Users size={16}/><p className="text-white/80 text-xs uppercase font-bold">Total Employees</p></div>
          <p className="text-2xl font-bold">{kpis.total}</p>
          <p className="text-white/80 text-xs mt-1">Active: {kpis.active}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Briefcase size={16} className="text-navy"/><p className="text-navy dark:text-white text-xs uppercase font-bold">Monthly Payroll</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{fmtAED(kpis.monthlyPayroll)}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Calendar size={16} className="text-gold"/><p className="text-gold text-xs uppercase font-bold">Yearly Payroll</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{fmtAED(kpis.yearlyPayroll)}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-amber-200 rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-600"/><p className="text-amber-600 text-xs uppercase font-bold">Expiring Documents</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{expiring.length}</p>
          <p className="text-navy-400 text-xs mt-1">Next 60 days</p>
        </div>
      </div>

      <Link
  href="/dashboard/hr/wps-export"
  className="group flex items-center gap-4 p-5 rounded-2xl bg-surface border border-border hover:border-gold hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm animate-fade-in-up delay-2"
>
  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
    <FileSpreadsheet size={22} className="text-white" />
  </div>
  <div className="flex-1 min-w-0">
    <h3 className="text-navy dark:text-white font-bold">WPS Export</h3>
    <p className="text-navy-400 text-sm">Generate UAE-compliant salary files</p>
  </div>
</Link>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Employees by Role</h3>
          {byRole.length === 0 ? <p className="text-navy-300 text-center py-12">No employees yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byRole} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                  {byRole.map((_, i) => <Cell key={i} fill={t.palette[i % t.palette.length]}/>)}
                </Pie>
                <Tooltip contentStyle={t.tooltipStyle}/>
                <Legend wrapperStyle={{fontSize: "12px", color: t.legendText}}/>
              </PieChart>
            </ResponsiveContainer>
          )}
          
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-latoxt-lg font-bold text-navy dark:text-white mb-4">Document Alerts</h3>
          {expiring.length === 0 ? <p className="text-navy-300 text-center py-12">All clear.</p> : (
            <div className="space-y-2">
              {expiring.slice(0,8).map(e => (
                <div key={e.id} className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
                  <p className="font-semibold text-navy dark:text-white text-sm">{e.name} · {e.role}</p>
                  <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
                    {e.visaExpiry && <>Visa: {e.visaExpiry} </>}
                    {e.passportExpiry && <>· Passport: {e.passportExpiry}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <FloatingActionMenu
  actions={[
    { icon: UserPlus, label: "Onboard New Employee",     href: "/dashboard/hr/employees?action=new" },
    { icon: ContactRound, label: "Update Visa / Emirates ID", href: "/dashboard/hr/employees?action=compliance" },
    { icon: Calendar, label: "Approve/Log Leave Request", onClick: () => alert("Leave management coming soon.") },
  ]}
/>
      </div>
    </div>
  );
}
