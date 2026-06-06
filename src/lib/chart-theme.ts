"use client";
import { useEffect, useState } from "react";

export type ChartSeries = {
  primary: string;
  accent: string;
  revenue: string;
  expenses: string;
  profit: string;
  neutral: string;
  warning: string;
  info: string;
};

export type ChartTheme = {
  grid: string;
  axisText: string;
  tooltipStyle: React.CSSProperties;
  legendText: string;
  palette: string[];
  series: ChartSeries;
  isDark: boolean;
};

const PALETTE_LIGHT = [
  "#1c2143", "#c9a84c", "#0f766e", "#4150aa",
  "#b91c1c", "#6b56b8", "#0369a1", "#a16207",
];

const PALETTE_DARK = [
  "#6B7CFF", "#F5C84C", "#2DD4BF", "#8EA0FF",
  "#F87171", "#A78BFA", "#38BDF8", "#FCD34D",
];

const SERIES_LIGHT: ChartSeries = {
  primary:  "#1c2143",
  accent:   "#c9a84c",
  revenue:  "#0f766e",
  expenses: "#b91c1c",
  profit:   "#c9a84c",
  neutral:  "#94a3b8",
  warning:  "#d97706",
  info:     "#0369a1",
};

const SERIES_DARK: ChartSeries = {
  primary:  "#6B7CFF",
  accent:   "#F5C84C",
  revenue:  "#2DD4BF",
  expenses: "#F87171",
  profit:   "#F5C84C",
  neutral:  "#64748b",
  warning:  "#FBBF24",
  info:     "#38BDF8",
};

function readChartTheme(): ChartTheme {
  if (typeof window === "undefined") {
    return {
      grid: "#e5e7eb",
      axisText: "#4a5568",
      legendText: "#4a5568",
      tooltipStyle: {
        background: "#192A56",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        color: "#ffffff",
        fontSize: 12,
      },
      palette: PALETTE_LIGHT,
      series: SERIES_LIGHT,
      isDark: false,
    };
  }

  const isDark = document.documentElement.classList.contains("dark");
  const styles = getComputedStyle(document.documentElement);
  const r = (varName: string) => `rgb(${styles.getPropertyValue(varName).trim()})`;

  return {
    grid: r("--c-chart-grid"),
    axisText: r("--c-chart-text"),
    legendText: r("--c-chart-text"),
    tooltipStyle: {
      background: r("--c-chart-tooltip-bg"),
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      color: r("--c-chart-tooltip-fg"),
      fontSize: 12,
      padding: "8px 12px",
    },
    palette: isDark ? PALETTE_DARK : PALETTE_LIGHT,
    series: isDark ? SERIES_DARK : SERIES_LIGHT,
    isDark,
  };
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => readChartTheme());

  useEffect(() => {
    const update = () => setTheme(readChartTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}