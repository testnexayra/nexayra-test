"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nexayra-theme";

export function applyThemeFromStorage() {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem(STORAGE_KEY);
  const isDark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const isDark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme(isDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDark);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
  };

  return { theme, toggle, mounted };
}