"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import { fmtAED, fmtDate } from "@/lib/format";
import { Users } from "lucide-react";

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

type Props = {
  projectId: string;
};

function isActive(a: Assignment): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return a.startDate <= today && (a.endDate === null || a.endDate >= today);
}

export default function ProjectTeam({ projectId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiCall<{ assignments: Assignment[] }>(`/api/employee-assignments?projectId=${projectId}`);
        setAssignments(res.assignments || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const { active, past, monthlyCommitment } = useMemo(() => {
    const a: Assignment[] = [];
    const p: Assignment[] = [];
    let total = 0;
    assignments.forEach((row) => {
      if (isActive(row)) {
        a.push(row);
        total += Number(row.monthlySalary || 0);
      } else if (row.endDate !== null) {
        // Past (ended) — pending future-dated rows skip both buckets
        p.push(row);
      }
    });
    a.sort((x, y) => String(x.employeeName || "").localeCompare(String(y.employeeName || "")));
    p.sort((x, y) => String(y.endDate || "").localeCompare(String(x.endDate || "")));
    return { active: a, past: p, monthlyCommitment: total };
  }, [assignments]);

  return (
    <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-navy dark:text-white" />
          <h3 className="font-display text-base font-bold text-navy dark:text-white">Team &amp; Labor</h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold text-navy-400 tracking-wider">Current monthly commitment</p>
          <p className="text-lg font-bold text-navy dark:text-white">{fmtAED(monthlyCommitment)}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-navy-400 text-sm py-4">Loading team…</p>
      ) : assignments.length === 0 ? (
        <p className="text-navy-300 text-sm py-6 text-center">No employees assigned to this project.</p>
      ) : (
        <>
          {active.length === 0 ? (
            <p className="text-navy-300 text-sm py-4 text-center">No currently-active assignments.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-navy dark:text-white text-xs uppercase font-bold tracking-wider border-b border-navy-100 dark:border-navy-700">
                    <th className="text-left py-2">Employee</th>
                    <th className="text-left">Start</th>
                    <th className="text-left">End</th>
                    <th className="text-right">Monthly Salary</th>
                    <th className="text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((a) => (
                    <tr key={a.id} className="border-b border-navy-50 dark:border-navy-700">
                      <td className="py-2 font-semibold text-navy dark:text-white">
                        <Link href={`/dashboard/hr/employees/${a.employeeId}`} className="hover:underline">
                          {a.employeeName || a.employeeId}
                        </Link>
                      </td>
                      <td>{fmtDate(a.startDate)}</td>
                      <td>{a.endDate ? fmtDate(a.endDate) : <span className="text-emerald-600 dark:text-emerald-400">ongoing</span>}</td>
                      <td className="text-right font-semibold">{fmtAED(a.monthlySalary || 0)}</td>
                      <td className="text-navy-500 dark:text-navy-300 text-xs italic">{a.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {past.length > 0 && (
            <>
              <div className="mt-5 mb-2 pt-3 border-t border-navy-100 dark:border-navy-700">
                <p className="text-xs font-bold uppercase tracking-wider text-navy-400">Past Assignments ({past.length})</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm opacity-75">
                  <tbody>
                    {past.map((a) => (
                      <tr key={a.id} className="border-b border-navy-50 dark:border-navy-700">
                        <td className="py-2 text-navy dark:text-white">
                          <Link href={`/dashboard/hr/employees/${a.employeeId}`} className="hover:underline">
                            {a.employeeName || a.employeeId}
                          </Link>
                        </td>
                        <td className="text-navy-400 text-xs">{fmtDate(a.startDate)} → {a.endDate ? fmtDate(a.endDate) : "—"}</td>
                        <td className="text-right text-navy-500 dark:text-navy-300">{fmtAED(a.monthlySalary || 0)}</td>
                        <td className="text-navy-400 text-xs italic">{a.notes || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
