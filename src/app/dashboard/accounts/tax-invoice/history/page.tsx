"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TaxInvoiceHistory from "@/components/tax-invoice/TaxInvoiceHistory";

export default function Page() {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/accounts/tax-invoice", label: "Create Tax Invoice" },
    { href: "/dashboard/accounts/tax-invoice/history", label: "Tax Invoice History" },
  ];
  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-navy-100 dark:border-navy-700">
        {tabs.map(t => {
          const active = pathname === t.href;
          return <Link key={t.href} href={t.href} className={`px-3 py-2 text-xs font-semibold border-b-2 ${active ? "border-gold text-navy dark:text-white" : "border-transparent text-navy dark:text-white hover:text-navy"}`}>{t.label}</Link>;
        })}
      </div>
      <TaxInvoiceHistory/>
    </div>
  );
}