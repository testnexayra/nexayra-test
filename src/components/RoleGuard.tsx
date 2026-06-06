"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/use-role";

function homeFor(role: string): string {
  switch (role) {
    case "accounts": return "/dashboard/accounts";
    case "procurement":
    case "procurement-approver": return "/dashboard/procurement";
    case "estimation": return "/dashboard/estimation";
    case "hr": return "/dashboard/hr";
    case "logistics": return "/dashboard/logistics";
    case "project-manager":
    case "engineer": return "/dashboard/projects";
    default: return "/dashboard";
  }
}

function isAllowed(role: string, pathname: string): boolean {
  if (role === "admin" || role === "viewer") return true;
  if (pathname === "/dashboard" || pathname === "/dashboard/") return false;
  if (pathname.startsWith("/dashboard/accounts")) return role === "accounts";
  if (pathname.startsWith("/dashboard/procurement")) return role === "procurement" || role === "procurement-approver";
  if (pathname.startsWith("/dashboard/estimation")) return role === "estimation";
  if (pathname.startsWith("/dashboard/hr")) return role === "hr" || role === "project-manager";
  if (pathname.startsWith("/dashboard/logistics")) return role === "logistics";
  if (pathname.startsWith("/dashboard/projects")) return role === "project-manager" || role === "engineer";
  if (pathname.startsWith("/dashboard/company-overview")) return true;
  return false;
}

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { role, loading } = useRole();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !role) return;
    if (!isAllowed(role, pathname)) router.replace(homeFor(role));
  }, [role, loading, pathname, router]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin"/></div>;
  if (role && !isAllowed(role, pathname)) return <div className="text-center py-16 text-navy-400">Redirecting...</div>;
  return <>{children}</>;
}