"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import {
  Calculator, Building2, FileCheck, Users, Truck, ShoppingCart, Briefcase,
  ArrowRight, Search, Megaphone,
} from "lucide-react";
import WelcomeBanner from "@/components/WelcomeBanner";

type SearchResult = { type: string; label: string; href: string };

const MODULES = [
  { href: "/dashboard/accounts",         label: "Accounts",                   desc: "Financial records and transactions",     icon: Calculator,    iconBg: "bg-emerald-500",  iconColor: "text-white" },
  { href: "/dashboard/company-overview", label: "Company Overview",           desc: "Company information and details",        icon: Building2,     iconBg: "bg-white border border-navy-100", iconColor: "text-navy", isSpecial: true },
  { href: "/dashboard/estimation",       label: "Estimation",                 desc: "Quotations and proposals",               icon: FileCheck,     iconBg: "bg-gold",         iconColor: "text-white" },
  { href: "/dashboard/hr",               label: "HR",                         desc: "Employees and payroll",                  icon: Users,         iconBg: "bg-purple-500",   iconColor: "text-white" },
  { href: "/dashboard/logistics",        label: "Transportation & Logistics", desc: "Fleet, vehicles, and assignments",       icon: Truck,         iconBg: "bg-orange-500",   iconColor: "text-white" },
  { href: "/dashboard/procurement",      label: "Procurement",                desc: "Purchase orders and vendor management",  icon: ShoppingCart,  iconBg: "bg-blue-500",     iconColor: "text-white" },
  { href: "/dashboard/projects",         label: "Projects",                   desc: "Project tracking and management",        icon: Briefcase,     iconBg: "bg-teal-500",     iconColor: "text-white" },
  { href: "/dashboard/marketing",        label: "Social Media & Marketing",   desc: "Brand assets, content, and outreach",    icon: Megaphone,     iconBg: "bg-pink-500",     iconColor: "text-white" },
];

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiCall<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(search)}`);
        setResults(res.results || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const showResults = search.trim().length >= 2;

  return (
    <div className="max-w-7xl mx-auto">
      <WelcomeBanner tagline="Nexayra Arc General Contracting L.L.C. — Manage your operations from one place." />

      {/* Global search */}
      <div className="mb-8 animate-fade-in-up delay-1">
        <div className="relative group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400 group-focus-within:text-gold transition-colors" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search LPOs, quotations, invoices, partners, projects, expenses…"
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl text-sm text-navy dark:text-white placeholder-navy-400 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all shadow-sm"
          />
        </div>

        {showResults && (
          <div className="mt-3 bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl shadow-lg overflow-hidden animate-fade-in-up">
            {searching ? (
              <div className="p-4 text-center text-navy-400 text-sm">Searching…</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-navy-400 text-sm">No results found.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {results.map((r, i) => (
                  <Link
                    key={i}
                    href={r.href}
                    className="flex items-center justify-between p-3 hover:bg-navy-50 dark:hover:bg-navy-700 transition-all border-b border-navy-50 dark:border-navy-700 last:border-0 group"
                  >
                    <div>
                      <p className="text-xs text-navy-400 font-bold uppercase tracking-wide">{r.type}</p>
                      <p className="text-sm text-navy dark:text-white font-semibold">{r.label}</p>
                    </div>
                    <ArrowRight size={14} className="text-navy-300 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Module grid — 4 columns on large screens, 2 on tablet, 1 on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODULES.map((mod, i) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group relative flex flex-col items-start gap-3 p-5 rounded-2xl bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 hover:border-gold/50 dark:hover:border-gold/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 shadow-sm animate-fade-in-up overflow-hidden"
            style={{ animationDelay: `${0.1 + i * 0.05}s` }}
          >
            {/* Subtle gradient accent on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/0 via-gold/0 to-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className={`w-12 h-12 rounded-xl ${mod.iconBg} flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-300 relative z-10`}>
              <mod.icon size={22} className={mod.iconColor} />
            </div>

            <div className="flex-1 min-w-0 relative z-10">
              <h3 className="text-navy dark:text-white font-bold text-base mb-0.5">{mod.label}</h3>
              <p className="text-navy-400 text-xs leading-relaxed">{mod.desc}</p>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold text-navy-400 group-hover:text-gold transition-colors relative z-10">
              <span>Open</span>
              <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}