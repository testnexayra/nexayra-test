"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "./AuthGuard";
import { useRole } from "@/lib/use-role";
import { LogOut, HomeIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggleControl";
import { capitalize } from "@/lib/format";

export default function TopNav() {
  const router = useRouter();
  const { user } = useAuth();
  const { role } = useRole();

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const isMainAccessible = role === "admin" || role === "viewer";

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-navy-900/95 backdrop-blur-md border-b border-navy-100 dark:border-navy-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={isMainAccessible ? "/dashboard" : "#"} className="flex items-center gap-3 group">
            <img src="/nexayra.png" alt="Nexayra Arc" className="h-9 w-auto transition-transform duration-300 group-hover:scale-105"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </Link>

          <div className="flex items-center gap-3">
            {isMainAccessible && (
             <Link
  href="/dashboard"
  className="group relative w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105"
  aria-label="Dashboard home"
  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#C6A35E'; }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
>
  <HomeIcon size={18} className="text-white dark:text-white group-hover:text-white transition-colors" />
</Link>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-navy dark:text-white leading-none">{capitalize(auth.currentUser?.email?.split("@")[0])}</p>
              <p className="text-[11px] text-navy-400 mt-0.5">{user?.email || ""} {role && <span className="ml-1 px-1.5 py-0.5 bg-navy-50 dark:bg-navy-700 rounded text-[9px] uppercase font-bold">{role}</span>}</p>
            </div>  
            <ThemeToggle />
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm font-semibold btn-press">
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
