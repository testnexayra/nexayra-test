"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/logistics", label: "Dashboard" },
  { href: "/dashboard/logistics/vehicles", label: "Vehicles" },
  { href: "/dashboard/logistics/possessions", label: "Possession Log" },
];

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy dark:text-white mb-4 animate-fade-in-up">Transportation & Logistics</h1>
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-navy-100 dark:border-navy-700 animate-fade-in-up delay-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                active ? "border-navy dark:border-gold text-navy dark:text-white" : "border-transparent text-navy-400 hover:text-navy-600 dark:hover:text-white hover:border-navy-200"
              }`}>{tab.label}</Link>
          );
        })}
      </div>
      <div className="animate-fade-in-up delay-2">{children}</div>
    </div>
  );
}