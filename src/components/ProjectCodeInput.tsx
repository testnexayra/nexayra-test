"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { AlertCircle, CheckCircle2, Search } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type ProjectLookup = {
  id: string;
  code: string;
  name: string;
  client?: string;
  location?: string;
  projectManager?: string;
  contractValue?: number;
  budgetedCost?: number;
  plannedStart?: string;
  plannedEnd?: string;
  status?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientTRN?: string;
};

type Props = {
  /** Current project code value (e.g. "P-1055") */
  value: string;
  /** Called as the user types — updates the code input */
  onChange: (code: string) => void;
  /** Called when a project is fully resolved (exact code match) */
  onProjectFound: (project: ProjectLookup) => void;
  /** Called when the input is cleared or code becomes invalid */
  onProjectCleared?: () => void;
  /** Label above the input (default "Project Code") */
  label?: string;
  /** Show a small "(required)" mark in the label */
  required?: boolean;
  /** Optional className override for the input */
  inputClassName?: string;
  /** Optional className override for the label */
  labelClassName?: string;
  /** Auto-show the suggestions dropdown on focus */
  openOnFocus?: boolean;
  /** Disable the input */
  disabled?: boolean;
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function ProjectCodeInput({
  value,
  onChange,
  onProjectFound,
  onProjectCleared,
  label = "Project Code",
  required = false,
  inputClassName,
  labelClassName,
  openOnFocus = true,
  disabled = false,
}: Props) {
  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // ----- Load all projects once on mount -----
  useEffect(() => {
    (async () => {
      try {
        const res = await apiCall<{ projects: ProjectLookup[] }>("/api/accounts-projects");
        setProjects(res.projects || []);
      } catch (err) {
        console.error("Failed to load projects for code input:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ----- Close dropdown when clicking outside -----
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ----- Find an exact-code match (case-insensitive) -----
  const exactMatch = useMemo(() => {
    if (!value.trim()) return null;
    const v = value.trim().toLowerCase();
    return projects.find(p => p.code?.toLowerCase() === v) || null;
  }, [value, projects]);

  // ----- Fuzzy suggestions for the dropdown -----
  const suggestions = useMemo(() => {
    if (!value.trim()) return projects.slice(0, 8);
    const v = value.trim().toLowerCase();
    return projects
      .filter(p =>
        p.code?.toLowerCase().includes(v) ||
        p.name?.toLowerCase().includes(v) ||
        p.client?.toLowerCase().includes(v)
      )
      .slice(0, 8);
  }, [value, projects]);

  // ----- Fire the autofill callback when a code becomes a valid project -----
  // Track the last fired id so we don't refire on every render
  const lastFiredIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (exactMatch) {
      if (lastFiredIdRef.current !== exactMatch.id) {
        lastFiredIdRef.current = exactMatch.id;
        onProjectFound(exactMatch);
      }
    } else {
      if (lastFiredIdRef.current !== null) {
        lastFiredIdRef.current = null;
        onProjectCleared?.();
      }
    }
  }, [exactMatch, onProjectFound, onProjectCleared]);

  // ----- Validation state -----
  const validationState: "empty" | "valid" | "invalid" | "loading" =
    loading ? "loading" :
    !value.trim() ? "empty" :
    exactMatch ? "valid" :
    "invalid";

  // ----- Keyboard navigation -----
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (hoverIdx >= 0 && suggestions[hoverIdx]) {
        e.preventDefault();
        onChange(suggestions[hoverIdx].code);
        setIsFocused(false);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
    }
  };

  // ----- Default styles (overridable) -----
  const defaultInputClass = "w-full px-4 py-3 pr-10 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white placeholder-navy-300 text-sm transition-all duration-200 hover:border-navy-300 focus:outline-none focus:border-gold";
  const defaultLabelClass = "block text-navy-500 dark:text-navy-300 text-xs font-bold uppercase tracking-wider mb-1.5";

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className={labelClassName || defaultLabelClass}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="flex items-center w-full bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-xl pr-10 transition-all duration-200 hover:border-navy-300 focus-within:border-gold">
          <span className="pl-4 pr-1 text-navy-400 font-semibold text-sm select-none">P-</span>
          <input
            type="text"
            value={value.replace(/^P-/i, "")}
            onChange={e => {
              // Only allow digits/letters/dashes — auto-prepend P-
              const cleaned = e.target.value.replace(/^P-/i, "");
              onChange(cleaned ? `P-${cleaned}` : "");
            }}
            onFocus={() => openOnFocus && setIsFocused(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={loading ? "Loading projects…" : ""}
            className="flex-1 px-1 py-3 bg-transparent text-navy dark:text-white placeholder-navy-300 text-sm focus:outline-none"
            autoComplete="off"
          />
        </div>

        {/* Status icon on the right */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {validationState === "loading" && (
            <div className="w-4 h-4 border-2 border-navy-300 border-t-transparent rounded-full animate-spin" />
          )}
          {validationState === "empty" && <Search size={16} className="text-navy-400" />}
          {validationState === "valid" && <CheckCircle2 size={16} className="text-emerald-500" />}
          {validationState === "invalid" && <AlertCircle size={16} className="text-red-500" />}
        </div>
      </div>

      {/* Validation message */}
      {validationState === "invalid" && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={12} /> Project code does not exist
        </p>
      )}
      {validationState === "valid" && exactMatch && (
        <p className="text-xs text-emerald-600 mt-1">
          ✓ Linked to <span className="font-semibold">{exactMatch.name}</span>
          {exactMatch.client ? <span className="text-navy-400"> · {exactMatch.client}</span> : null}
        </p>
      )}

      {/* Suggestions dropdown */}
      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 left-0 right-0 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {suggestions.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => setHoverIdx(idx)}
              onClick={() => {
                onChange(p.code);
                setIsFocused(false);
              }}
              className={`w-full text-left px-4 py-2.5 border-b border-navy-50 dark:border-navy-700 last:border-b-0 transition-colors ${
                hoverIdx === idx ? "bg-navy-50 dark:bg-navy-700" : "hover:bg-navy-50 dark:hover:bg-navy-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-navy dark:text-white truncate">
                    {p.code}
                    <span className="font-normal text-navy-500 dark:text-navy-300"> — {p.name}</span>
                  </p>
                  {p.client && (
                    <p className="text-xs text-navy-400 truncate">{p.client}{p.location ? ` · ${p.location}` : ""}</p>
                  )}
                </div>
                {p.status && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy-100 dark:bg-navy-700 text-navy dark:text-white">
                    {p.status}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}