"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED } from "@/lib/format";
import Loader from "@/components/Loader";
import { Plus } from "lucide-react";

type Project = { id: string; code: string; name: string; client: string; contractValue: number; startDate: string; endDate: string; status: string; totalExpenses: number; totalInvoiced: number; totalCollected: number; profit: number };

export default function ProjectsPage() {
  const { canWrite } = useRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [client, setClient] = useState("");
  const [scope, setScope] = useState("");
  const [scopeCustom, setScopeCustom] = useState("");
  const [contractValue, setContractValue] = useState(""); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const load = async () => { try { const r = await apiCall<{projects: Project[]}>("/api/accounts-projects"); setProjects(r.projects); } finally { setLoading(false); } };
  useEffect(()=>{load();},[]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("prefill") === "1") {
      const raw = sessionStorage.getItem("prefillProject");
      if (raw) {
        try {
          const p = JSON.parse(raw);
          setCode(p.code || ""); setName(p.name || ""); setClient(p.client || "");
          const presets = ["HVAC", "Electrical", "Plumbing", "Mixed"];
          if (p.scope && !presets.includes(p.scope)) {
            setScope("custom"); setScopeCustom(p.scope);
          } else {
            setScope(p.scope || ""); setScopeCustom("");
          }
          setContractValue(String(p.contractValue || ""));
          setStartDate(p.startDate || ""); setEndDate(p.endDate || "");
          sessionStorage.removeItem("prefillProject");
          // Scroll to form
          setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
          alert("Quotation data pre-filled. Review and save to create the project.");
        } catch {}
      }
    }
  }, []);

  const add = async () => {
    if (!code.trim()) { alert("Please add the project code."); return; }
    if (!name.trim()) { alert("Please add the project name."); return; }
    if (!client.trim()) { alert("Please add the client name."); return; }
    if (!contractValue || isNaN(Number(contractValue)) || Number(contractValue) <= 0) { alert("Please add a valid contract value."); return; }
    if (!startDate) { alert("Please add the start date."); return; }
    if (scope === "custom" && !scopeCustom.trim()) { alert("Please specify the custom scope."); return; }
    const scopeValue = scope === "custom" ? scopeCustom.trim() : scope;
    await apiCall("/api/accounts-projects", { method: "POST", body: { code, name, client, scope: scopeValue, contractValue: Number(contractValue||0), startDate, endDate, status: "active" }});
    setCode(""); setName(""); setClient(""); setScope(""); setScopeCustom(""); setContractValue(""); setStartDate(""); setEndDate(""); load();
  };


  if (loading) return <Loader fullScreen />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm placeholder:text-navy dark:text-white-300 dark:placeholder:text-navy dark:text-white";;

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h2 className="font-latoxt-navy dark:text-white text-lg font-bold mb-4">New Project</h2>
          <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <input placeholder="Code *" value={code} onChange={e=>setCode(e.target.value)} className={inp}/>
            <input placeholder="Project name *" value={name} onChange={e=>setName(e.target.value)} className={inp}/>
            <input placeholder="Client *" value={client} onChange={e=>setClient(e.target.value)} className={inp}/>
            <select value={scope} onChange={e=>{ setScope(e.target.value); if (e.target.value !== "custom") setScopeCustom(""); }} className={inp}>
              <option value="">Scope</option>
              <option value="HVAC">HVAC</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Mixed">Mixed</option>
              <option value="custom">Custom…</option>
            </select>
            {scope === "custom" && (
              <input placeholder="Specify custom scope" value={scopeCustom} onChange={e=>setScopeCustom(e.target.value)} className={inp}/>
            )}
            <input type="number" placeholder="Contract value *" value={contractValue} onChange={e=>setContractValue(e.target.value)} className={inp}/>
            <input type="date" placeholder="Start date" value={startDate} onChange={e=>setStartDate(e.target.value)} className={inp}/>
            <input type="date" placeholder="Expected end date" value={endDate} onChange={e=>setEndDate(e.target.value)} className={inp}/>
            <button onClick={add} className="px-4 py-2 bg-navy text-white dark:bg-gold dark:text-navy hover:bg-navy-800 dark:hover:bg-gold-400 transition-colors font-semibold rounded-lg text-sm btn-press flex items-center justify-center gap-1"><Plus size={14}/> Add Project</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? <p className="col-span-3 text-center py-16 text-navy dark:text-white-300">No projects.</p> :
          projects.map(p => (
            <div key={p.id} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover-lift">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-navy dark:text-white text-xs">{p.code} {(p as any).scope ? `· ${(p as any).scope}` : ""}</p>
                  <h3 className="font-bold text-navy dark:text-white">{p.name}</h3>
                  <p className="text-navy dark:text-white text-sm">{p.client}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-navy-100 text-navy dark:text-white-500"}`}>{p.status}</span>
              </div>
              <div className="space-y-1 text-sm border-t border-navy-50 pt-3">
                <div className="flex justify-between"><span className="text-navy dark:text-white">Contract:</span><span className="font-semibold">{fmtAED(p.contractValue)}</span></div>
                <div className="flex justify-between"><span className="text-navy dark:text-white">Invoiced:</span><span className="font-semibold text-blue-600">{fmtAED(p.totalInvoiced)}</span></div>
                <div className="flex justify-between"><span className="text-navy dark:text-white">Collected:</span><span className="font-semibold text-green-600">{fmtAED(p.totalCollected)}</span></div>
                <div className="flex justify-between"><span className="text-navy dark:text-white">Expenses:</span><span className="font-semibold text-red-500">{fmtAED(p.totalExpenses)}</span></div>
                <div className="flex justify-between border-t border-navy-50 pt-1 mt-1"><span className="text-navy dark:text-white font-latold">Profit:</span><span className={`font-bold ${p.profit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmtAED(p.profit)}</span></div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
