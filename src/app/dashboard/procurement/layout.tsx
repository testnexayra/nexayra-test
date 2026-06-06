"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/procurement", label: "Dashboard" },
  { href: "/dashboard/procurement/lpo", label: "Create LPO" },
  { href: "/dashboard/procurement/lpo/history", label: "LPO History" },
];

export default function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy mb-4 animate-fade-in-up">Procurement</h1>
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-navy-100 animate-fade-in-up delay-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                active ? "border-navy text-navy" : "border-transparent text-navy-400 hover:text-navy-600 hover:border-navy-200"
              }`}>{tab.label}</Link>
          );
        })}
      </div>
      <div className="animate-fade-in-up delay-2">{children}</div>
    </div>
  );
}