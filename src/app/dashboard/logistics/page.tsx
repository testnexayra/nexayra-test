"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import { Truck, Key, Calendar, Building2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Link from "next/link";
import WelcomeBanner from "@/components/WelcomeBanner";
import ModuleSearchBar from "@/components/ModuleSearchBar";
import { useChartTheme } from "@/lib/chart-theme";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import { Fuel, Wrench } from "lucide-react";

type Vehicle = { id: string; plateNumber: string; make: string; model: string; year: string; ownership: string; monthlyRentalCost: number; rentalCompany: string; registrationExpiry: string; insuranceExpiry: string; currentPossession: any };

export default function LogisticsDashboard() {
   const t = useChartTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await apiCall<{ vehicles: Vehicle[] }>("/api/vehicles"); setVehicles(r.vehicles || []); }
      finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => {
    const total = vehicles.length;
    const owned = vehicles.filter(v => v.ownership === "owned").length;
    const rented = vehicles.filter(v => v.ownership === "rented").length;
    const monthlyCost = vehicles.filter(v => v.ownership === "rented").reduce((s, v) => s + (v.monthlyRentalCost || 0), 0);
    const assigned = vehicles.filter(v => v.currentPossession).length;
    return { total, owned, rented, monthlyCost, assigned, available: total - assigned };
  }, [vehicles]);

  const today = new Date();
  const soon = new Date(); soon.setDate(soon.getDate() + 30);
  const expiringSoon = vehicles.filter(v => {
    const checks = [v.registrationExpiry, v.insuranceExpiry].filter(Boolean);
    return checks.some(d => { const t = new Date(d); return t >= today && t <= soon; });
  });

  const ownershipData = [
    { name: "Owned", value: kpis.owned },
    { name: "Rented", value: kpis.rented },
  ].filter(d => d.value > 0);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <WelcomeBanner tagline="Optimize fleet movements and ensure timely site deliveries." />
      <ModuleSearchBar module="logistics" placeholder="Search vehicles…" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-navy text-white rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Truck size={16}/><p className="text-white/80 text-xs uppercase font-bold">Total Vehicles</p></div>
          <p className="text-2xl font-bold">{kpis.total}</p>
          <p className="text-white/80 text-xs mt-1">Owned: {kpis.owned} · Rented: {kpis.rented}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Key size={16} className="text-green-600"/><p className="text-green-600 text-xs uppercase font-bold">In Use</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{kpis.assigned}</p>
          <p className="text-navy dark:text-white text-xs mt-1">Available: {kpis.available}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Building2 size={16} className="text-gold"/><p className="text-gold text-xs uppercase font-bold">Monthly Rental Cost</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{fmtAED(kpis.monthlyCost)}</p>
        </div>
        <div className="bg-white dark:bg-navy-800 border border-amber-200 rounded-2xl p-5 hover-lift">
          <div className="flex items-center gap-2 mb-2"><Calendar size={16} className="text-amber-600"/><p className="text-amber-600 text-xs uppercase font-bold">Expiring in 30 days</p></div>
          <p className="text-2xl font-bold text-navy dark:text-white">{expiringSoon.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Fleet Ownership</h3>
          {ownershipData.length === 0 ? <p className="text-navy dark:text-white-300 text-center py-12">No vehicles yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={ownershipData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                  <Cell fill={t.series.primary}/>
                  <Cell fill={t.series.accent}/>
                </Pie>
                <Tooltip contentStyle={t.tooltipStyle}/>
                <Legend wrapperStyle={{ fontSize: "12px", color: t.legendText }}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Expiring Documents</h3>
          {expiringSoon.length === 0 ? <p className="text-navy dark:text-white-300 text-center py-12">No expiries in the next 30 days.</p> : (
            <div className="space-y-2">
              {expiringSoon.slice(0, 6).map(v => (
                <div key={v.id} className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
                  <p className="font-semibold text-navy dark:text-white text-sm">{v.plateNumber} — {v.make} {v.model}</p>
                  <p className="text-amber-700 text-xs mt-1">
                    {v.registrationExpiry && <>Reg: {fmtDate(v.registrationExpiry)} · </>}
                    {v.insuranceExpiry && <>Insurance: {fmtDate(v.insuranceExpiry)}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
  href="/dashboard/logistics/assets"
  className="group flex items-center gap-4 p-5 rounded-2xl bg-surface border border-border hover:border-gold hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm animate-fade-in-up delay-3"
>
  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
    <Wrench size={22} className="text-white" />
  </div>
  <div className="flex-1 min-w-0">
    <h3 className="text-navy dark:text-white font-bold">High-Value Assets</h3>
    <p className="text-navy-400 text-sm">Track tools and equipment with location</p>
  </div>
</Link>

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-lato text-lg font-bold text-navy dark:text-white">Fleet Status</h3>
          <Link href="/dashboard/logistics/vehicles" className="text-sm text-navy dark:text-gold font-semibold hover:underline">Manage →</Link>
        </div>
        {vehicles.length === 0 ? <p className="text-navy dark:text-white-300 text-center py-8">No vehicles yet. Add one from the Vehicles tab.</p> : (
          <div className="space-y-2">
            {vehicles.slice(0, 8).map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-navy-50/30 dark:bg-navy-700/30 rounded-lg">
                <div>
                  <p className="font-semibold text-navy dark:text-white text-sm">{v.plateNumber} · {v.make} {v.model} {v.year && `(${v.year})`}</p>
                  <p className="text-xs text-navy dark:text-white">
                    {v.ownership === "owned" ? "Owned" : `Rented from ${v.rentalCompany || "—"}`}
                    {v.currentPossession && ` · With ${v.currentPossession.employeeName}`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${v.currentPossession ? "bg-green-100 text-green-700" : "bg-navy-100 dark:bg-navy-700 text-navy dark:text-white-500 dark:text-navy dark:text-white-200"}`}>
                  {v.currentPossession ? "In Use" : "Available"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <FloatingActionMenu
  actions={[
    { icon: Truck, label: "Assign Vehicle to Project",      href: "/dashboard/logistics/vehicles?action=assign" },
    { icon: Fuel, label: "Log Fuel Receipt / Salik Top-up", onClick: () => alert("Fuel & Salik tracking coming soon.") },
    { icon: Wrench, label: "Schedule Vehicle Maintenance",   href: "/dashboard/logistics/vehicles?action=maintenance" },
  ]}
/>
    </div>
  );
}   
