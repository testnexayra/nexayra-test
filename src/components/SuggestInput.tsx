"use client";

import { useEffect, useRef, useState } from "react";
import { apiCall } from "@/lib/api-client";

interface Props {
  field: string; // "vendorName", "clientName", etc.
  value: string;
  onChange: (v: string) => void;
  onPick?: (v: string) => void; // fires when user picks a suggestion (lets you trigger lookups)
  placeholder?: string;
  className?: string;
  type?: string;
}

export default function SuggestInput({ field, value, onChange, onPick, placeholder, className, type = "text" }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value || value.length < 1) { setSuggestions([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await apiCall<{ suggestions: string[] }>(`/api/suggestions?field=${field}&q=${encodeURIComponent(value)}`);
        const filtered = (res.suggestions || []).filter(s => s.toLowerCase() !== value.toLowerCase());
        setSuggestions(filtered);
        setOpen(filtered.length > 0);
      } catch { setSuggestions([]); }
    }, 200);
  }, [value, field]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (s: string) => {
    onChange(s); setOpen(false); setActiveIdx(-1);
    if (onPick) onPick(s);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => value && suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(s)}
              className={`w-full text-left px-3 py-2 text-sm ${i === activeIdx ? "bg-navy-100 dark:bg-navy-700" : "hover:bg-navy-50 dark:hover:bg-navy-700"} text-navy dark:text-white`}
            >{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}