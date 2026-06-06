"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import { Search, ArrowRight } from "lucide-react";

type SearchResult = { type: string; label: string; href: string };

type ModuleSearchBarProps = {
  /**
   * Module identifier passed to the search API. The /api/search endpoint
   * scopes results to that module (e.g. "accounts" only returns expenses,
   * invoices, partners, etc., not LPOs).
   */
  module: "accounts" | "estimation" | "procurement" | "company-overview" | "hr" | "logistics" | "projects" | "marketing";
  placeholder?: string;
};

export default function ModuleSearchBar({ module, placeholder }: ModuleSearchBarProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiCall<{ results: SearchResult[] }>(
          `/api/search?q=${encodeURIComponent(search)}&module=${module}`
        );
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, module]);

  const showResults = search.trim().length >= 2;

  return (
    <div className="mb-5 animate-fade-in-up delay-1">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder || `Search within ${module}…`}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl text-sm text-navy dark:text-white placeholder-navy-400 focus:outline-none focus:border-gold transition-all shadow-sm"
        />
      </div>

      {showResults && (
        <div className="mt-3 bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl shadow-md overflow-hidden animate-fade-in-up">
          {searching ? (
            <div className="p-4 text-center text-navy-400 text-sm">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-navy-400 text-sm">No results found.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {results.map((r, i) => (
                <Link
                  key={i}
                  href={r.href}
                  className="flex items-center justify-between p-3 hover:bg-navy-50 dark:hover:bg-navy-700 transition-all border-b border-navy-50 dark:border-navy-700 last:border-0"
                >
                  <div>
                    <p className="text-xs text-navy-400 font-bold uppercase">{r.type}</p>
                    <p className="text-sm text-navy dark:text-white font-semibold">{r.label}</p>
                  </div>
                  <ArrowRight size={14} className="text-navy-300" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}