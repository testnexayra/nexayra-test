"use client";

import { useTheme } from "@/lib/theme-provider";
import { Sun, Moon, Sunrise } from "lucide-react";

export default function ThemeToggle() {
  const { mode, setMode, theme } = useTheme();

  return (
    <div className="inline-flex items-center bg-navy-50 dark:bg-navy-700 rounded-xl p-0.5 gap-0.5">
      <button
        onClick={() => setMode("auto")}
        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
          mode === "auto"
            ? "bg-gold text-navy shadow-sm"
            : "text-navy-400 hover:text-navy dark:hover:text-white"
        }`}
        title="Auto (time-based)"
      >
        <Sunrise size={13} />
        <span className="hidden sm:inline">Auto</span>
      </button>
      <button
        onClick={() => setMode("light")}
        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
          mode === "light"
            ? "bg-gold text-navy shadow-sm"
            : "text-navy-400 hover:text-navy dark:hover:text-white"
        }`}
        title="Light"
      >
        <Sun size={13} />
      </button>
      <button
        onClick={() => setMode("dark")}
        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
          mode === "dark"
            ? "bg-gold text-navy shadow-sm"
            : "text-navy-400 hover:text-navy dark:hover:text-white"
        }`}
        title="Dark"
      >
        <Moon size={13} />
      </button>
    </div>
  );
}