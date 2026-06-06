"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/projects", label: "All Projects" },
];

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="flex items-end justify-between mb-4 animate-fade-in-up">
        <h1 className="font-display text-3xl font-bold text-navy dark:text-white">Projects</h1>
      </div>
      <div className="animate-fade-in-up delay-1">{children}</div>
    </div>
  );
}