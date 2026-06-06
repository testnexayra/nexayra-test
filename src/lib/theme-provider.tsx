"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";
type ThemeMode = "auto" | "light" | "dark";

type ThemeContextValue = {
  theme: Theme;          // resolved theme actually applied
  mode: ThemeMode;       // user preference: 'auto' | 'light' | 'dark'
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;    // quick toggle: cycles light → dark → auto
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getTimeBasedTheme(): Theme {
  const hour = new Date().getHours();
  // Dark from 7pm (19) to 7am
  return hour >= 19 || hour < 7 ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): Theme {
  if (mode === "auto") return getTimeBasedTheme();
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Initial load — read preference from localStorage
  useEffect(() => {
    const saved = (typeof window !== "undefined" ? localStorage.getItem("nx-theme-mode") : null) as ThemeMode | null;
    const initialMode: ThemeMode = saved && ["auto", "light", "dark"].includes(saved) ? saved : "auto";
    setModeState(initialMode);
    setTheme(resolveTheme(initialMode));
    setMounted(true);
  }, []);

  // Re-resolve theme when mode changes
  useEffect(() => {
    if (!mounted) return;
    setTheme(resolveTheme(mode));
  }, [mode, mounted]);

  // Apply theme class to <html> whenever it changes
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme, mounted]);

  // Auto mode: re-check every 10 minutes for time-of-day flip
  useEffect(() => {
    if (mode !== "auto") return;
    const id = setInterval(() => {
      const next = getTimeBasedTheme();
      setTheme((curr) => (curr !== next ? next : curr));
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("nx-theme-mode", newMode);
    }
  };

  const toggle = () => {
    // Cycle: auto → light → dark → auto
    if (mode === "auto") setMode("light");
    else if (mode === "light") setMode("dark");
    else setMode("auto");
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback if used outside provider
    return {
      theme: "light",
      mode: "auto",
      setMode: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}