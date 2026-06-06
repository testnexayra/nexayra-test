"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiCall } from "@/lib/api-client";
import { Search, Loader2, X } from "lucide-react";

type Result = { type: string; title: string; subtitle: string; href: string };

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inputPos, setInputPos] = useState({ top: 0, left: 0, width: 0 });
  const router = useRouter();
  const timerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true); setOpen(true);
    timerRef.current = setTimeout(async () => {
      try {
        const r = await apiCall<{results: Result[]}>(`/api/search?q=${encodeURIComponent(q)}`);
        setResults(r.results || []);
      } finally { setLoading(false); }
    }, 300);
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateInputPos = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setInputPos({ top: rect.bottom, left: rect.left, width: rect.width });
    }
  };

  const goto = (href: string) => { setOpen(false); setQ(""); router.push(href); };

  const typeColors: Record<string, string> = {
    "LPO": "bg-blue-100 text-blue-700",
    "Quotation": "bg-gold/20 text-amber-700",
    "Receipt": "bg-green-100 text-green-700",
    "Tax Invoice": "bg-purple-100 text-purple-700",
    "Project": "bg-teal-100 text-teal-700",
    "Partner": "bg-pink-100 text-pink-700",
    "Expense": "bg-red-100 text-red-700",
    "Project Expense": "bg-amber-100 text-amber-700",
    "Invoice": "bg-indigo-100 text-indigo-700",
  };

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400"/>
        <input
          ref={inputRef}
          value={q}
          onChange={e=>setQ(e.target.value)}
          onFocus={()=>{q && setOpen(true); updateInputPos();}}
          placeholder="Search LPOs, quotations, invoices, partners, projects, expenses..."
          className="w-full pl-11 pr-10 py-3 bg-white border border-navy-200 rounded-xl text-navy text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
        {q && (
          <button onClick={()=>{setQ(""); setOpen(false);}} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy"><X size={16}/></button>
        )}
      </div>

      {open && (
        <div 
          className="bg-white border border-navy-100 border-t-0 rounded-b-2xl shadow-xl z-[9999] max-h-96 overflow-y-auto animate-scale-in w-full mt-0"
        >
          {loading ? (
            <div className="p-6 flex items-center justify-center text-navy-400"><Loader2 size={16} className="animate-spin mr-2"/> Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-navy-400 text-sm">No results for "{q}"</div>
          ) : (
            <div className="py-2">
              {results.map((r, i) => (
                <button key={i} onClick={()=>goto(r.href)} className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-navy-50 text-left transition-colors">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 mt-0.5 ${typeColors[r.type] || "bg-navy-100 text-navy"}`}>{r.type}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{r.title}</p>
                    <p className="text-xs text-navy-400 truncate">{r.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}