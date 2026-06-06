"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import { Plus, Trash2, Pencil, Check, X, AlertTriangle } from "lucide-react";
import NextLink from "next/link";

type Employee = {
  id: string;
  name: string;
  empId: string;
  role: string;
  department: string;
  monthlySalary: number;
  phone: string;
  email: string;
  emiratesId?: string;
  emiratesIdNumber?: string | null;
  emiratesIdExpiry?: string | null;
  visaNumber?: string | null;
  visaExpiry?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  joinDate: string;
  status: string;
  notes: string;
  assignedProjectIds: string[];
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
  const text = d < 0 ? `${label}: expired` : d <= 90 ? `${label}: ${d}d` : null;
  if (!text) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls} flex items-center gap-1`}>
      <AlertTriangle size={9} /> {text}
    </span>
  );
}

export default function EmployeesPage() {
  const { canWriteHR } = useRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Employee>>({});

  // Add form state
  const [name, setName] = useState("");
  const [empId, setEmpId] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [status, setStatus] = useState("active");

  // Compliance fields
  const [emiratesIdNumber, setEmiratesIdNumber] = useState("");
  const [emiratesIdExpiry, setEmiratesIdExpiry] = useState("");
  const [visaNumber, setVisaNumber] = useState("");
  const [visaExpiry, setVisaExpiry] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");

  const load = async () => {
    try {
      const r = await apiCall<{ employees: Employee[] }>("/api/employees");
      setEmployees(r.employees);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(""); setEmpId(""); setRole(""); setDepartment(""); setMonthlySalary("");
    setPhone(""); setEmail(""); setJoinDate(""); setStatus("active");
    setEmiratesIdNumber(""); setEmiratesIdExpiry("");
    setVisaNumber(""); setVisaExpiry("");
    setPassportNumber(""); setPassportExpiry("");
  };

  const add = async () => {
    if (!name.trim()) return alert("Please add the employee name.");
    if (!role.trim()) return alert("Please add the role.");
    if (!monthlySalary || isNaN(Number(monthlySalary))) return alert("Please add a valid monthly salary.");

    await apiCall("/api/employees", {
      method: "POST",
      body: {
        name, empId, role, department, monthlySalary: Number(monthlySalary),
        phone, email, joinDate, status,
        emiratesIdNumber, emiratesIdExpiry,
        visaNumber, visaExpiry,
        passportNumber, passportExpiry,
      },
    });
    resetForm();
    load();
  };

  const startEdit = (e: Employee) => { setEditing(e.id); setEditData({ ...e }); };

  const saveEdit = async () => {
    await apiCall("/api/employees", { method: "PUT", body: { id: editing, ...editData } });
    setEditing(null);
    setEditData({});
    load();
  };

  const del = async (id: string, n: string) => {
    if (!confirm(`Delete employee ${n}?`)) return;
    await apiCall(`/api/employees?id=${id}`, { method: "DELETE" });
    load();
  };

  if (loading) {
    return <div className="w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />;
  }

  const inp =
    "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm";

  return (
    <div className="space-y-6">
      {canWriteHR && (
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
          <h2 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Add Employee</h2>

          <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} className={inp} />
            <input placeholder="Employee ID" value={empId} onChange={(e) => setEmpId(e.target.value)} className={inp} />
            <input placeholder="Role *" value={role} onChange={(e) => setRole(e.target.value)} className={inp} />
            <input placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className={inp} />
            <input
              type="number"
              step="0.01"
              placeholder="Monthly Salary (AED) *"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              className={inp}
            />
            <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} />
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} />
            <div>
              <label className="text-[10px] text-navy-400 font-bold uppercase tracking-wider mb-0.5 block">Join Date</label>
              <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className={inp} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
              <option value="active">Active</option>
              <option value="on-leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>

          {/* Compliance section */}
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-2">Compliance Documents</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase block mb-0.5">Emirates ID #</label>
                <input value={emiratesIdNumber} onChange={(e) => setEmiratesIdNumber(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase block mb-0.5">EID Expiry</label>
                <input type="date" value={emiratesIdExpiry} onChange={(e) => setEmiratesIdExpiry(e.target.value)} className={inp} />
              </div>
              <div />
              <div>
                <label className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase block mb-0.5">Visa #</label>
                <input value={visaNumber} onChange={(e) => setVisaNumber(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase block mb-0.5">Visa Expiry</label>
                <input type="date" value={visaExpiry} onChange={(e) => setVisaExpiry(e.target.value)} className={inp} />
              </div>
              <div />
              <div>
                <label className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase block mb-0.5">Passport #</label>
                <input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase block mb-0.5">Passport Expiry</label>
                <input type="date" value={passportExpiry} onChange={(e) => setPassportExpiry(e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          <button onClick={add} className="mt-3 px-5 py-2 bg-navy text-white dark:bg-gold-400 dark:text-white font-semibold rounded-lg text-sm btn-press flex items-center gap-1">
            <Plus size={14} /> Add Employee
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
        <h2 className="font-lato text-lg font-bold text-navy dark:text-white mb-4">Employees ({employees.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-navy-400 text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                <th className="text-left py-2">Name</th>
                <th className="text-left">Role</th>
                <th className="text-left">Dept</th>
                <th className="text-right">Salary</th>
                <th className="text-left">Compliance</th>
                <th className="text-left">Status</th>
                {canWriteHR && <th />}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-navy-300">No employees yet.</td></tr>
              ) : (
                employees.map((e) =>
                  editing === e.id ? (
                    <tr key={e.id} className="border-b border-navy-50 dark:border-navy-700 bg-blue-50/30 dark:bg-blue-900/10">
                      <td className="py-2"><input value={editData.name || ""} onChange={(ev) => setEditData((p) => ({ ...p, name: ev.target.value }))} className={inp} /></td>
                      <td><input value={editData.role || ""} onChange={(ev) => setEditData((p) => ({ ...p, role: ev.target.value }))} className={inp} /></td>
                      <td><input value={editData.department || ""} onChange={(ev) => setEditData((p) => ({ ...p, department: ev.target.value }))} className={inp} /></td>
                      <td><input type="number" value={editData.monthlySalary || 0} onChange={(ev) => setEditData((p) => ({ ...p, monthlySalary: Number(ev.target.value) }))} className={inp} /></td>
                      <td>
                        <div className="space-y-1">
                          <input type="date" placeholder="EID" value={editData.emiratesIdExpiry || ""} onChange={(ev) => setEditData((p) => ({ ...p, emiratesIdExpiry: ev.target.value }))} className={inp} title="Emirates ID Expiry" />
                          <input type="date" placeholder="Visa" value={editData.visaExpiry || ""} onChange={(ev) => setEditData((p) => ({ ...p, visaExpiry: ev.target.value }))} className={inp} title="Visa Expiry" />
                          <input type="date" placeholder="Passport" value={editData.passportExpiry || ""} onChange={(ev) => setEditData((p) => ({ ...p, passportExpiry: ev.target.value }))} className={inp} title="Passport Expiry" />
                        </div>
                      </td>
                      <td>
                        <select value={editData.status || "active"} onChange={(ev) => setEditData((p) => ({ ...p, status: ev.target.value }))} className={inp}>
                          <option value="active">Active</option>
                          <option value="on-leave">On Leave</option>
                          <option value="terminated">Terminated</option>
                        </select>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="p-1.5 text-green-600"><Check size={14} /></button>
                          <button onClick={() => { setEditing(null); setEditData({}); }} className="p-1.5 text-navy-400"><X size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={e.id} className="border-b border-navy-50 dark:border-navy-700">
                      <td className="py-2">
                        <NextLink href={`/dashboard/hr/employees/${e.id}`} className="font-semibold text-navy dark:text-white hover:text-gold hover:underline transition-colors">
                          {e.name}
                        </NextLink>
                        <br />
                        <span className="text-xs text-navy-400">{e.empId}</span>
                      </td> 
                      <td>{e.role}</td>
                      <td className="text-navy-400">{e.department}</td>
                      <td className="text-right font-semibold">{fmtAED(e.monthlySalary)}</td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <ExpiryBadge date={e.emiratesIdExpiry} label="EID" />
                          <ExpiryBadge date={e.visaExpiry} label="Visa" />
                          <ExpiryBadge date={e.passportExpiry} label="Passport" />
                          {!e.emiratesIdExpiry && !e.visaExpiry && !e.passportExpiry && (
                            <span className="text-[10px] text-navy-300">—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          e.status === "active" ? "bg-green-100 text-green-700"
                          : e.status === "on-leave" ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>{e.status}</span>
                      </td>
                      {canWriteHR && (
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(e)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Pencil size={14} /></button>
                            <button onClick={() => del(e.id, e.name)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}