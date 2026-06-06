"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtDate } from "@/lib/format";
import { Trash2 } from "lucide-react";
import Loader from "@/components/Loader";

type Possession = { id: string; vehicleId: string; employeeName: string; assignedDate: string; returnDate: string | null; purpose: string; notes: string };
type Vehicle = { id: string; plateNumber: string; make: string; model: string };

export default function PossessionsPage() {
  const { canWriteLogistics } = useRole();
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVehicle, setFilterVehicle] = useState("");

  const load = async () => {
    try {
      const [p, v] = await Promise.all([
        apiCall<{ possessions: Possession[] }>("/api/vehicle-possessions"),
        apiCall<{ vehicles: Vehicle[] }>("/api/vehicles"),
      ]);
      setPossessions(p.possessions); setVehicles(v.vehicles);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm("Delete this possession record?")) return;
    await apiCall(`/api/vehicle-possessions?id=${id}`, { method: "DELETE" }); load();
  };

  if (loading) return <Loader fullScreen />;

  const inp = "px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm";
  const filtered = filterVehicle ? possessions.filter(p => p.vehicleId === filterVehicle) : possessions;

  return (
    <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-lato text-navy dark:text-white text-lg font-bold">Vehicle Possession Log</h2>
        <select value={filterVehicle} onChange={e=>setFilterVehicle(e.target.value)} className={inp + " w-auto"}>
          <option value="">All vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber} ({v.make} {v.model})</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
            <th className="text-left py-2">Vehicle</th><th className="text-left">Employee</th><th className="text-left">Assigned</th>
            <th className="text-left">Returned</th><th className="text-left">Purpose</th>{canWriteLogistics && <th/>}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-navy dark:text-white-300">No records.</td></tr> :
              filtered.map(p => {
                const v = vehicles.find(x => x.id === p.vehicleId);
                return (
                  <tr key={p.id} className="border-b border-navy-50 dark:border-navy-700">
                    <td className="py-2 font-semibold text-navy dark:text-white">{v ? v.plateNumber : "—"}</td>
                    <td>{p.employeeName}</td>
                    <td>{fmtDate(p.assignedDate)}</td>
                    <td>{p.returnDate ? fmtDate(p.returnDate) : <span className="text-green-600 font-semibold">Active</span>}</td>
                    <td className="text-navy dark:text-white">{p.purpose}</td>
                    {canWriteLogistics && <td><button onClick={()=>del(p.id)} className="text-red-500"><Trash2 size={14}/></button></td>}
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}