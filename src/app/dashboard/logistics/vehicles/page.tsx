"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import LocationCapture, { LocationData } from "@/components/LocationCapture";
import {
  Plus, Trash2, Pencil, Check, X, Key, AlertTriangle, MapPin, ExternalLink,
} from "lucide-react";

type Vehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  color: string;
  registrationExpiry: string;
  mulkiyaNumber?: string | null;
  mulkiyaExpiry?: string | null;
  insurancePolicy?: string | null;
  insuranceExpiry: string;
  lastServiceDate?: string | null;
  ownership: string;
  rentalCompany: string;
  rentalStartDate: string;
  rentalEndDate: string;
  monthlyRentalCost: number;
  notes: string;
  currentLocation?: LocationData | null;
  currentPossession: any;
};

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ date, label }: { date?: string | null; label: string }) {
  const d = daysUntil(date);
  if (d === null) return null;
  const cls = d < 0
    ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
    : d <= 30
    ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
    : d <= 90
    ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400";
  const text = d < 0 ? `${label} expired` : d <= 90 ? `${label}: ${d}d left` : null;
  if (!text) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls} inline-flex items-center gap-1`}>
      <AlertTriangle size={9} /> {text}
    </span>
  );
}

export default function VehiclesPage() {
  const { canWriteLogistics } = useRole();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");

  // Compliance fields
  const [mulkiyaNumber, setMulkiyaNumber] = useState("");
  const [mulkiyaExpiry, setMulkiyaExpiry] = useState("");
  const [insurancePolicy, setInsurancePolicy] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");

  // Ownership
  const [ownership, setOwnership] = useState("owned");
  const [rentalCompany, setRentalCompany] = useState("");
  const [rentalStartDate, setRentalStartDate] = useState("");
  const [rentalEndDate, setRentalEndDate] = useState("");
  const [monthlyRentalCost, setMonthlyRentalCost] = useState("");
  const [notes, setNotes] = useState("");

  // Location
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

  // Assign possession
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [empName, setEmpName] = useState("");
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState("");

  // Edit vehicle
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Vehicle>>({});

  const load = async () => {
    try {
      const r = await apiCall<{ vehicles: Vehicle[] }>("/api/vehicles");
      setVehicles(r.vehicles || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setPlateNumber(""); setMake(""); setModel(""); setYear(""); setColor("");
    setMulkiyaNumber(""); setMulkiyaExpiry("");
    setInsurancePolicy(""); setInsuranceExpiry("");
    setLastServiceDate("");
    setOwnership("owned"); setRentalCompany(""); setRentalStartDate(""); setRentalEndDate("");
    setMonthlyRentalCost(""); setNotes("");
    setCurrentLocation(null);
  };

  const add = async () => {
    if (!plateNumber.trim()) return alert("Please add the plate number.");
    if (ownership === "rented" && !rentalCompany.trim()) return alert("Please add the rental company.");

    await apiCall("/api/vehicles", {
      method: "POST",
      body: {
        plateNumber, make, model, year, color,
        mulkiyaNumber, mulkiyaExpiry,
        registrationExpiry: mulkiyaExpiry, // keep legacy field in sync
        insurancePolicy, insuranceExpiry,
        lastServiceDate,
        ownership, rentalCompany, rentalStartDate, rentalEndDate,
        monthlyRentalCost: Number(monthlyRentalCost || 0),
        notes,
        currentLocation,
      },
    });
    resetForm();
    load();
  };

  const del = async (id: string, plate: string) => {
    if (!confirm(`Delete vehicle ${plate}? This removes its possession history too.`)) return;
    try {
      await apiCall(`/api/vehicles?id=${id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const startEdit = (v: Vehicle) => { setEditingId(v.id); setEditData({ ...v }); };

  const saveEdit = async () => {
    await apiCall("/api/vehicles", { method: "PUT", body: { id: editingId, ...editData } });
    setEditingId(null);
    setEditData({});
    load();
  };

  const assign = async (vehicleId: string) => {
    if (!empName.trim()) return alert("Please add the employee name.");
    await apiCall("/api/vehicle-possessions", {
      method: "POST",
      body: { vehicleId, employeeName: empName, assignedDate: assignDate, purpose },
    });
    setAssigningId(null);
    setEmpName("");
    setPurpose("");
    load();
  };

  const returnVehicle = async (possessionId: string) => {
    if (!confirm("Mark this vehicle as returned?")) return;
    await apiCall("/api/vehicle-possessions", {
      method: "PUT",
      body: { id: possessionId, returnDate: new Date().toISOString() },
    });
    load();
  };

  if (loading) return <Loader compact />;

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm";

  return (
    <div className="space-y-6">
      {canWriteLogistics && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h2 className="font-lato text-navy dark:text-white text-lg font-bold mb-4">Add Vehicle</h2>

          <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <input placeholder="Plate Number *" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} className={inp} />
            <input placeholder="Make (e.g. Toyota)" value={make} onChange={(e) => setMake(e.target.value)} className={inp} />
            <input placeholder="Model (e.g. Hilux)" value={model} onChange={(e) => setModel(e.target.value)} className={inp} />
            <input placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} className={inp} />
            <input placeholder="Color" value={color} onChange={(e) => setColor(e.target.value)} className={inp} />
            <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className={inp}>
              <option value="owned">Owned</option>
              <option value="rented">Rented from</option>
            </select>
            {ownership === "rented" && (
              <>
                <input placeholder="Rental Company *" value={rentalCompany} onChange={(e) => setRentalCompany(e.target.value)} className={inp} />
                <div>
                  <label className="block text-[10px] text-navy dark:text-white font-bold uppercase tracking-wider mb-0.5">Rental Start</label>
                  <input type="date" value={rentalStartDate} onChange={(e) => setRentalStartDate(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-[10px] text-navy dark:text-white font-bold uppercase tracking-wider mb-0.5">Rental End</label>
                  <input type="date" value={rentalEndDate} onChange={(e) => setRentalEndDate(e.target.value)} className={inp} />
                </div>
                <input type="number" step="0.01" placeholder="Monthly Cost (AED)" value={monthlyRentalCost} onChange={(e) => setMonthlyRentalCost(e.target.value)} className={inp} />
              </>
            )}
          </div>

          {/* Compliance & Service */}
          <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-2">Compliance & Service</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block mb-0.5">Mulkiya #</label>
                <input value={mulkiyaNumber} onChange={(e) => setMulkiyaNumber(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block mb-0.5">Mulkiya Expiry</label>
                <input type="date" value={mulkiyaExpiry} onChange={(e) => setMulkiyaExpiry(e.target.value)} className={inp} />
              </div>
              <div />
              <div>
                <label className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block mb-0.5">Insurance Policy #</label>
                <input value={insurancePolicy} onChange={(e) => setInsurancePolicy(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block mb-0.5">Insurance Expiry</label>
                <input type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block mb-0.5">Last Service</label>
                <input type="date" value={lastServiceDate} onChange={(e) => setLastServiceDate(e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Location capture */}
          <div className="mt-4">
            <LocationCapture
              value={currentLocation}
              onChange={setCurrentLocation}
              label="Current Location"
            />
          </div>

          <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inp} mt-2 min-h-[60px]`} />
          <button onClick={add} className="mt-3 px-5 py-2 bg-navy text-white dark:bg-gold-400 dark:text-white font-semibold rounded-lg text-sm btn-press flex items-center gap-1">
            <Plus size={14} /> Add Vehicle
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <h2 className="font-lato text-navy dark:text-white text-lg font-bold mb-4">Fleet ({vehicles.length})</h2>
        <div className="space-y-3">
          {vehicles.length === 0 ? (
            <p className="text-center py-8 text-navy-300">No vehicles yet.</p>
          ) : (
            vehicles.map((v) => (
              <div key={v.id} className="p-4 border border-navy-100 dark:border-navy-700 rounded-xl">
                {editingId === v.id ? (
                  <div className="space-y-2">
                    <div className="grid sm:grid-cols-3 gap-2">
                      <input value={editData.plateNumber || ""} onChange={(e) => setEditData((p) => ({ ...p, plateNumber: e.target.value }))} className={inp} placeholder="Plate" />
                      <input value={editData.make || ""} onChange={(e) => setEditData((p) => ({ ...p, make: e.target.value }))} className={inp} placeholder="Make" />
                      <input value={editData.model || ""} onChange={(e) => setEditData((p) => ({ ...p, model: e.target.value }))} className={inp} placeholder="Model" />
                      <div>
                        <label className="text-[10px] text-navy-400 font-bold uppercase block mb-0.5">Mulkiya Expiry</label>
                        <input type="date" value={editData.mulkiyaExpiry || editData.registrationExpiry || ""} onChange={(e) => setEditData((p) => ({ ...p, mulkiyaExpiry: e.target.value, registrationExpiry: e.target.value }))} className={inp} />
                      </div>
                      <div>
                        <label className="text-[10px] text-navy-400 font-bold uppercase block mb-0.5">Insurance Expiry</label>
                        <input type="date" value={editData.insuranceExpiry || ""} onChange={(e) => setEditData((p) => ({ ...p, insuranceExpiry: e.target.value }))} className={inp} />
                      </div>
                      <div>
                        <label className="text-[10px] text-navy-400 font-bold uppercase block mb-0.5">Last Service</label>
                        <input type="date" value={editData.lastServiceDate || ""} onChange={(e) => setEditData((p) => ({ ...p, lastServiceDate: e.target.value }))} className={inp} />
                      </div>
                      <input type="number" step="0.01" value={(editData.monthlyRentalCost as any) || 0} onChange={(e) => setEditData((p) => ({ ...p, monthlyRentalCost: Number(e.target.value) }))} className={inp} placeholder="Monthly Cost" />
                    </div>

                    {/* Location capture in edit mode */}
                    <LocationCapture
                      value={editData.currentLocation as LocationData | null | undefined}
                      onChange={(loc) => setEditData((p) => ({ ...p, currentLocation: loc }))}
                      label="Current Location"
                    />

                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold btn-press flex items-center gap-1"><Check size={14} /> Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-navy-100 dark:bg-navy-700 text-navy dark:text-white rounded-lg text-sm btn-press"><X size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-navy dark:text-white">
                          {v.plateNumber} · {v.make} {v.model} {v.year && `(${v.year})`}
                        </p>
                        <p className="text-navy dark:text-white text-xs">
                          {v.color && `${v.color} · `}
                          {v.ownership === "owned" ? "Owned by company" : `Rented from ${v.rentalCompany || "—"}`}
                          {v.ownership === "rented" && v.monthlyRentalCost > 0 && ` · ${fmtAED(v.monthlyRentalCost)}/mo`}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <ExpiryBadge date={v.mulkiyaExpiry || v.registrationExpiry} label="Mulkiya" />
                          <ExpiryBadge date={v.insuranceExpiry} label="Insurance" />
                        </div>

                        {(v.mulkiyaExpiry || v.registrationExpiry || v.insuranceExpiry || v.lastServiceDate) && (
                          <p className="text-navy-400 text-xs mt-1">
                            {(v.mulkiyaExpiry || v.registrationExpiry) && <>Mulkiya: {fmtDate(v.mulkiyaExpiry || v.registrationExpiry)} </>}
                            {v.insuranceExpiry && <>· Insurance: {fmtDate(v.insuranceExpiry)} </>}
                            {v.lastServiceDate && <>· Last service: {fmtDate(v.lastServiceDate)}</>}
                          </p>
                        )}

                        {v.currentLocation && (
                          <a
                            href={`https://www.google.com/maps?q=${v.currentLocation.lat},${v.currentLocation.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-gold hover:text-gold-600 text-xs font-semibold mt-1.5"
                          >
                            <MapPin size={11} /> {v.currentLocation.address || `${v.currentLocation.lat.toFixed(4)}, ${v.currentLocation.lng.toFixed(4)}`}
                            <ExternalLink size={10} />
                          </a>
                        )}

                        {v.currentPossession && (
                          <p className="text-green-700 dark:text-green-400 text-xs mt-1 font-semibold">
                            🔑 With {v.currentPossession.employeeName} since {fmtDate(v.currentPossession.assignedDate)}{" "}
                            {v.currentPossession.purpose && `· ${v.currentPossession.purpose}`}
                          </p>
                        )}
                      </div>

                      {canWriteLogistics && (
                        <div className="flex gap-1">
                          {!v.currentPossession ? (
                            <button onClick={() => setAssigningId(v.id)} className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-700 rounded-lg text-xs font-semibold btn-press flex items-center gap-1">
                              <Key size={12} /> Assign
                            </button>
                          ) : (
                            <button onClick={() => returnVehicle(v.currentPossession.id)} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold btn-press">
                              Return
                            </button>
                          )}
                          <button onClick={() => startEdit(v)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Pencil size={14} /></button>
                          <button onClick={() => del(v.id, v.plateNumber)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>

                    {assigningId === v.id && (
                      <div className="mt-3 pt-3 border-t border-navy-50 dark:border-navy-700 grid sm:grid-cols-4 gap-2">
                        <input placeholder="Employee name *" value={empName} onChange={(e) => setEmpName(e.target.value)} className={inp} />
                        <input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} className={inp} />
                        <input placeholder="Purpose / project" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inp} />
                        <div className="flex gap-1">
                          <button onClick={() => assign(v.id)} className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold btn-press">Save</button>
                          <button onClick={() => setAssigningId(null)} className="px-3 py-1.5 bg-navy-100 dark:bg-navy-700 text-navy dark:text-white rounded-lg text-sm">✕</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
