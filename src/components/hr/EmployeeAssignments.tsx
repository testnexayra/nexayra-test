"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import { useRole } from "@/lib/use-role";
import { fmtAED, fmtDate } from "@/lib/format";
import { Plus, X, StopCircle, Trash2, AlertTriangle } from "lucide-react";

type Project = { id: string; code: string; name: string; status?: string };

type Assignment = {
  id: string;
  employeeId: string;
  employeeName?: string;
  projectId: string;
  startDate: string;
  endDate: string | null;
  monthlySalary: number;
  notes?: string;
};

type Status = "active" | "pending" | "ended";

function statusOf(a: Assignment): Status {
  const today = new Date().toISOString().slice(0, 10);
  if (a.startDate > today) return "pending";
  if (a.endDate === null || a.endDate >= today) return "active";
  return "ended";
}

type Props = {
  employeeId: string;
  employeeName: string;
};

export default function EmployeeAssignments({ employeeId, employeeName }: Props) {
  const { canWriteHR } = useRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // New-assignment form state
  const [showForm, setShowForm] = useState(false);
  const [formProjectId, setFormProjectId] = useState("");
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // End-assignment dialog state
  const [endingAssignment, setEndingAssignment] = useState<Assignment | null>(null);
  const [endDateValue, setEndDateValue] = useState(new Date().toISOString().slice(0, 10));
  const [endError, setEndError] = useState("");

  const load = async () => {
    try {
      const [projRes, asnRes] = await Promise.all([
        apiCall<{ projects: Project[] }>("/api/accounts-projects"),
        apiCall<{ assignments: Assignment[] }>(`/api/employee-assignments?employeeId=${employeeId}`),
      ]);
      setProjects(projRes.projects || []);
      setAssignments(asnRes.assignments || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [employeeId]);

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, `${p.code || ""} ${p.name}`.trim()]));
    return (id: string) => map.get(id) || id;
  }, [projects]);

  const submitAssignment = async () => {
    setFormError("");
    if (!formProjectId) { setFormError("Please select a project."); return; }
    if (!formStartDate) { setFormError("Please pick a start date."); return; }
    if (formEndDate && formEndDate < formStartDate) { setFormError("End date must be on or after start date."); return; }

    setFormSubmitting(true);
    try {
      await apiCall("/api/employee-assignments", {
        method: "POST",
        body: {
          employeeId,
          projectId: formProjectId,
          startDate: formStartDate,
          endDate: formEndDate || null,
          notes: formNotes,
        },
      });
      setShowForm(false);
      setFormProjectId(""); setFormStartDate(new Date().toISOString().slice(0, 10));
      setFormEndDate(""); setFormNotes("");
      load();
    } catch (err: any) {
      setFormError(err.message || "Failed to create assignment.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const submitEndAssignment = async () => {
    if (!endingAssignment) return;
    setEndError("");
    if (endDateValue < endingAssignment.startDate) {
      setEndError("End date must be on or after the assignment's start date.");
      return;
    }
    try {
      await apiCall("/api/employee-assignments", {
        method: "PUT",
        body: { id: endingAssignment.id, endDate: endDateValue },
      });
      setEndingAssignment(null);
      load();
    } catch (err: any) {
      setEndError(err.message || "Failed to end assignment.");
    }
  };

  const deleteAssignment = async (a: Assignment) => {
    if (!confirm(`Delete the assignment to ${projectName(a.projectId)}? This is permanent — use "End assignment" if you only want to mark it completed.`)) return;
    try {
      await apiCall(`/api/employee-assignments?id=${a.id}`, { method: "DELETE" });
      load();
    } catch (err: any) {
      alert(err.message || "Failed to delete assignment.");
    }
  };

  const inp = "w-full px-3 py-2 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-lg text-navy dark:text-white text-sm";
  const lbl = "block text-navy-500 dark:text-navy-300 text-xs font-bold uppercase tracking-wider mb-1";

  const statusBadge = (s: Status) => {
    const cls =
      s === "active" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
      s === "pending" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
      "bg-navy-100 dark:bg-navy-700 text-navy-600 dark:text-navy-300";
    return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cls}`}>{s}</span>;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm">
        <p className="text-navy-400 text-sm">Loading assignments…</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-base font-bold text-navy dark:text-white">Project Assignments</h3>
          <p className="text-xs text-navy-400">Assign {employeeName} to projects so payroll can prorate their salary correctly.</p>
        </div>
        {canWriteHR && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-4 py-2 bg-navy hover:bg-navy-700 text-white dark:bg-gold dark:text-navy rounded-lg text-sm font-semibold btn-press"
          >
            <Plus size={14} /> New Assignment
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={lbl}>Project *</label>
              <select value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} className={inp}>
                <option value="">— Choose a project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}{p.status ? ` (${p.status})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Start Date *</label>
              <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>End Date (blank = ongoing)</label>
              <input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Notes (optional)</label>
              <input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Role on project, special instructions…" className={inp} />
            </div>
          </div>

          {formError && (
            <div className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-lg flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button onClick={submitAssignment} disabled={formSubmitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm btn-press">
              {formSubmitting ? "Saving…" : "Save Assignment"}
            </button>
            <button onClick={() => { setShowForm(false); setFormError(""); }} className="px-4 py-2 bg-navy-100 dark:bg-navy-600 hover:bg-navy-200 text-navy dark:text-white font-semibold rounded-lg text-sm btn-press">
              Cancel
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <p className="text-navy-300 text-sm py-8 text-center">No project assignments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                <th className="text-left py-2">Status</th>
                <th className="text-left">Project</th>
                <th className="text-left">Start</th>
                <th className="text-left">End</th>
                <th className="text-right">Salary Snapshot</th>
                <th className="text-left">Notes</th>
                {canWriteHR && <th />}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const s = statusOf(a);
                const canEnd = s === "active" && a.endDate === null;
                return (
                  <tr key={a.id} className="border-b border-navy-50 dark:border-navy-700">
                    <td className="py-2">{statusBadge(s)}</td>
                    <td className="font-semibold text-navy dark:text-white">
                      <Link href={`/dashboard/projects/${a.projectId}`} className="hover:underline">
                        {projectName(a.projectId)}
                      </Link>
                    </td>
                    <td>{fmtDate(a.startDate)}</td>
                    <td>{a.endDate ? fmtDate(a.endDate) : <span className="text-emerald-600 dark:text-emerald-400">ongoing</span>}</td>
                    <td className="text-right font-semibold">{fmtAED(a.monthlySalary || 0)}</td>
                    <td className="text-navy-500 dark:text-navy-300 text-xs italic">{a.notes || "—"}</td>
                    {canWriteHR && (
                      <td>
                        <div className="flex gap-1 justify-end">
                          {canEnd && (
                            <button
                              onClick={() => { setEndingAssignment(a); setEndDateValue(new Date().toISOString().slice(0, 10)); setEndError(""); }}
                              className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"
                              title="End assignment"
                            >
                              <StopCircle size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteAssignment(a)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete assignment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {endingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-navy dark:text-white">End Assignment</h3>
              <button onClick={() => setEndingAssignment(null)} className="text-navy-400 hover:text-navy"><X size={18} /></button>
            </div>
            <p className="text-sm text-navy-500 dark:text-navy-300 mb-4">
              End {employeeName}'s assignment to <strong>{projectName(endingAssignment.projectId)}</strong>.
            </p>
            <label className={lbl}>End Date</label>
            <input type="date" value={endDateValue} onChange={(e) => setEndDateValue(e.target.value)} className={inp} />
            {endError && (
              <div className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{endError}</span>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={submitEndAssignment} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-sm">
                End Assignment
              </button>
              <button onClick={() => setEndingAssignment(null)} className="px-4 py-2 bg-navy-100 dark:bg-navy-600 text-navy dark:text-white font-semibold rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
