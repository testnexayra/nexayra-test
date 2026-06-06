"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import { fmtAED, fmtDate } from "@/lib/format";
import Loader from "@/components/Loader";
import EmployeeAssignments from "@/components/hr/EmployeeAssignments";
import {
  ArrowLeft, User, Briefcase, Calendar, Banknote,
  Mail, Phone,
} from "lucide-react";

type Employee = {
  id: string;
  name: string;
  empId?: string;
  role?: string;
  department?: string;
  monthlySalary: number;
  phone?: string;
  email?: string;
  emiratesIdNumber?: string | null;
  emiratesIdExpiry?: string | null;
  visaNumber?: string | null;
  visaExpiry?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  joinDate?: string;
  status?: string;
};

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiCall<{ employees: Employee[] }>("/api/employees");
        setEmployee(res.employees.find((e) => e.id === employeeId) || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [employeeId]);

  if (loading) return <Loader compact />;

  if (!employee) {
    return (
      <div className="text-center py-16">
        <p className="text-navy-400 mb-4">Employee not found.</p>
        <Link href="/dashboard/hr/employees" className="text-gold font-semibold hover:underline">← Back to Employees</Link>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/dashboard/hr/employees")}
        className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all"
      >
        <ArrowLeft size={16} /> Back to Employees
      </button>

      {/* Header */}
      <div className="bg-brand-navy rounded-2xl p-6 mb-6 text-white relative overflow-hidden animate-fade-in-up">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-gold/10 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          {employee.empId && <p className="text-gold font-semibold text-sm mb-1">{employee.empId}</p>}
          <h1 className="font-display text-3xl font-bold mb-2">{employee.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-navy-200 text-sm">
            {employee.role && <span className="flex items-center gap-1.5"><Briefcase size={14} /> {employee.role}</span>}
            {employee.department && <span className="flex items-center gap-1.5"><User size={14} /> {employee.department}</span>}
            {employee.joinDate && <span className="flex items-center gap-1.5"><Calendar size={14} /> Joined {fmtDate(employee.joinDate)}</span>}
            <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-bold uppercase">{employee.status || "active"}</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="bg-gradient-to-br from-gold to-gold-500 text-navy rounded-2xl p-4 shadow-sm">
          <Banknote size={16} className="opacity-80 mb-2" />
          <p className="text-[10px] font-bold uppercase opacity-80">Monthly Salary</p>
          <p className="text-base font-bold mt-1">{fmtAED(employee.monthlySalary || 0)}</p>
        </div>
        <div className="bg-gradient-to-br from-slate-600 to-slate-700 text-white rounded-2xl p-4 shadow-sm">
          <Calendar size={16} className="opacity-80 mb-2" />
          <p className="text-[10px] font-bold uppercase opacity-80">Status</p>
          <p className="text-base font-bold mt-1 capitalize">{employee.status || "active"}</p>
        </div>
      </div>

      {/* Contact & Compliance */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-3">Contact</h3>
          <div className="space-y-2 text-sm">
            {employee.email && (
              <div className="flex items-center gap-2 text-navy dark:text-white">
                <Mail size={14} className="text-navy-400" />
                <span>{employee.email}</span>
              </div>
            )}
            {employee.phone && (
              <div className="flex items-center gap-2 text-navy dark:text-white">
                <Phone size={14} className="text-navy-400" />
                <span>{employee.phone}</span>
              </div>
            )}
            {!employee.email && !employee.phone && (
              <p className="text-navy-400 text-sm">No contact info.</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-3">Compliance</h3>
          <div className="space-y-1.5 text-xs text-navy dark:text-white">
            <div className="flex items-center justify-between">
              <span className="text-navy-400">Emirates ID</span>
              <span>{employee.emiratesIdNumber || "—"} {employee.emiratesIdExpiry && <span className="text-navy-400">(exp {fmtDate(employee.emiratesIdExpiry)})</span>}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-navy-400">Visa</span>
              <span>{employee.visaNumber || "—"} {employee.visaExpiry && <span className="text-navy-400">(exp {fmtDate(employee.visaExpiry)})</span>}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-navy-400">Passport</span>
              <span>{employee.passportNumber || "—"} {employee.passportExpiry && <span className="text-navy-400">(exp {fmtDate(employee.passportExpiry)})</span>}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Assignments — owns its own data fetch + write flow */}
      <EmployeeAssignments employeeId={employee.id} employeeName={employee.name} />
    </div>
  );
}
