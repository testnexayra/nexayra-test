"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/use-role";

const TABS = [
  { href: "/dashboard/accounts/dashboard", label: "Dashboard" },
  { href: "/dashboard/accounts/partners", label: "Partners & Capital" },
  { href: "/dashboard/accounts/expenses", label: "Company Expenses" },
  { href: "/dashboard/accounts/project-expenses", label: "Project Expenses" },
  { href: "/dashboard/accounts/petty-cash", label: "Petty Cash" },
  { href: "/dashboard/accounts/projects", label: "Projects" },
    { href: "/dashboard/accounts/tax-invoice", label: "Tax Invoice" },
  { href: "/dashboard/accounts/invoicing", label: "Invoicing & Collections" },
  { href: "/dashboard/accounts/receipts", label: "Receipts" },
  { href: "/dashboard/accounts/cash-flow", label: "Cash Flow" },
  { href: "/dashboard/accounts/profit-loss", label: "Profit / Loss" },
];

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, loading } = useRole();

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin"/></div>;
  if (role !== "admin" && role !== "accounts" && role !== "viewer") {
    return <div className="text-center py-16 text-red-500">403 — You don&apos;t have access to the Accounts section.</div>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy dark:text-white mb-4 animate-fade-in-up">Accounts</h1>
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-navy-100 animate-fade-in-up delay-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                active ? "border-navy text-navy dark:text-white" : "border-transparent text-navy-400 dark:text-navy-400 hover:text-navy-600 dark:hover:text-white hover:border-navy-200"
              }`}>{tab.label}</Link>
          );
        })}
      </div>
      <div className="animate-fade-in-up delay-2">{children}</div>
    </div>
  );
}