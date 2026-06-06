"use client";

import { useState } from "react";
import { fmtAED } from "@/lib/format";
import { useChartTheme } from "@/lib/chart-theme";

export type TimelineEvent = {
  id: string;
  date: Date;
  label: string;
  sub: string;
  total: number;
};

type Props = {
  lpoEvents: TimelineEvent[];
  expenseEvents: TimelineEvent[];
  projectStart?: Date | null;
};

export default function ProjectTimeline({ lpoEvents, expenseEvents, projectStart }: Props) {
  const t = useChartTheme();
  const [hovered, setHovered] = useState<{ lane: "lpo" | "expense"; idx: number; x: number; y: number } | null>(null);

  const allEvents = [...lpoEvents, ...expenseEvents];
  if (allEvents.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-navy-300 dark:text-navy-400 text-sm">
        No activity yet for this project
      </div>
    );
  }

  const times = allEvents.map((e) => e.date.getTime());
  if (projectStart) times.push(projectStart.getTime());
  const minDate = Math.min(...times);
  const todayPlus14 = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const maxDate = Math.max(...times, todayPlus14);
  const span = maxDate - minDate;
  const pad = span > 0 ? span * 0.04 : 24 * 60 * 60 * 1000;
  const startMs = minDate - pad;
  const endMs = maxDate + pad;
  const rangeMs = endMs - startMs;

  const width = 1000;
  const padLeft = 80;
  const padRight = 24;
  const padTop = 36;
  const laneHeight = 48;
  const height = padTop + laneHeight * 2 + 16;

  const xOf = (d: Date) => padLeft + ((d.getTime() - startMs) / rangeMs) * (width - padLeft - padRight);
  const today = new Date();
  const todayX = xOf(today);

  const monthTicks: { x: number; label: string }[] = [];
  const cursor = new Date(startMs);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endMs && monthTicks.length < 36) {
    monthTicks.push({
      x: xOf(new Date(cursor)),
      label: `${cursor.toLocaleString("en-US", { month: "short" })} ${String(cursor.getFullYear()).slice(2)}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const lpoLaneY = padTop + laneHeight / 2;
  const expLaneY = padTop + laneHeight + laneHeight / 2;

  const lpoFill = t.series.primary || "#1c2143";
  const expenseFill = "#ef4444";
  const gridStroke = t.grid;
  const axisText = t.axisText;
  const gold = t.series.accent || "#c9a84c";

  const renderTooltip = () => {
    if (!hovered) return null;
    const evt = hovered.lane === "lpo" ? lpoEvents[hovered.idx] : expenseEvents[hovered.idx];
    if (!evt) return null;
    const w = 200;
    const h = 50;
    const ttX = Math.min(Math.max(hovered.x - w / 2, padLeft), width - padRight - w);
    const ttY = Math.max(hovered.y - h - 10, 4);
    return (
      <g pointerEvents="none">
        <rect x={ttX} y={ttY} width={w} height={h} rx={6} fill="#1c2143" opacity={0.95} />
        <text x={ttX + w / 2} y={ttY + 15} textAnchor="middle" fill="#ffffff" fontSize={11} fontWeight={700}>
          {evt.label} · {evt.date.toLocaleDateString()}
        </text>
        <text x={ttX + w / 2} y={ttY + 29} textAnchor="middle" fill="#ffffff" fontSize={10}>
          {evt.sub.length > 32 ? evt.sub.slice(0, 30) + "…" : evt.sub}
        </text>
        <text x={ttX + w / 2} y={ttY + 43} textAnchor="middle" fill={gold} fontSize={11} fontWeight={700}>
          {fmtAED(evt.total)}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="none" style={{ minHeight: height }}>
        {monthTicks.map((tk, i) => (
          <g key={i}>
            <line x1={tk.x} y1={padTop} x2={tk.x} y2={height - 8} stroke={gridStroke} strokeWidth={1} />
            <text x={tk.x} y={padTop - 12} textAnchor="middle" fill={axisText} fontSize={10} fontWeight={700}>
              {tk.label}
            </text>
          </g>
        ))}

        {todayX >= padLeft && todayX <= width - padRight && (
          <g>
            <line x1={todayX} y1={padTop - 4} x2={todayX} y2={height - 8} stroke={gold} strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={todayX + 4} y={padTop - 4} fill={gold} fontSize={9} fontWeight={700}>today</text>
          </g>
        )}

        <text x={8} y={lpoLaneY + 4} fill={axisText} fontSize={12} fontWeight={700}>LPOs</text>
        <text x={8} y={expLaneY + 4} fill={axisText} fontSize={12} fontWeight={700}>Expenses</text>

        <line x1={padLeft} y1={lpoLaneY} x2={width - padRight} y2={lpoLaneY} stroke={gridStroke} strokeWidth={1} />
        <line x1={padLeft} y1={expLaneY} x2={width - padRight} y2={expLaneY} stroke={gridStroke} strokeWidth={1} />

        {lpoEvents.map((evt, i) => {
          const cx = xOf(evt.date);
          return (
            <circle
              key={evt.id}
              cx={cx}
              cy={lpoLaneY}
              r={6}
              fill={lpoFill}
              stroke="#ffffff"
              strokeWidth={1.5}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered({ lane: "lpo", idx: i, x: cx, y: lpoLaneY })}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered({ lane: "lpo", idx: i, x: cx, y: lpoLaneY })}
            />
          );
        })}

        {expenseEvents.map((evt, i) => {
          const cx = xOf(evt.date);
          return (
            <circle
              key={evt.id}
              cx={cx}
              cy={expLaneY}
              r={6}
              fill={expenseFill}
              stroke="#ffffff"
              strokeWidth={1.5}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered({ lane: "expense", idx: i, x: cx, y: expLaneY })}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered({ lane: "expense", idx: i, x: cx, y: expLaneY })}
            />
          );
        })}

        {renderTooltip()}
      </svg>
    </div>
  );
}
