import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireHRWrite, requireAccountsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { writeLedgerEntry } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Allocation = { projectId: string; projectName: string; amount: number; assignmentId: string };
type EmployeeEntry = {
  employeeId: string;
  name: string;
  monthlySalary: number;
  allocations: Allocation[];
  totalCharge: number;
  unallocatedDays: number;
};
type Preview = {
  period: string;
  periodLabel: string;
  toPay: EmployeeEntry[];
  alreadyPaid: EmployeeEntry[];
  totalAmount: number;
  totalEmployees: number;
};

const periodKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
const periodLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const padDay = (d: number) => String(d).padStart(2, "0");

function readDateField(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (typeof v?.toDate === "function") return v.toDate().toISOString().slice(0, 10);
  return "";
}

async function computePreview(
  year: number,
  month: number,
): Promise<Preview> {
  const period = periodKey(year, month);
  const label = periodLabel(year, month);
  const D = daysInMonth(year, month);
  const monthStart = `${year}-${padDay(month)}-01`;
  const monthEnd = `${year}-${padDay(month)}-${padDay(D)}`;

  // Eligible employees
  const empSnap = await adminDb.collection("employees").get();
  const employees = empSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((e) => (e.status || "active") === "active" && Number(e.monthlySalary || 0) > 0);

  if (employees.length === 0) {
    return { period, periodLabel: label, toPay: [], alreadyPaid: [], totalAmount: 0, totalEmployees: 0 };
  }

  // All assignments (we'll filter per-employee). Single fetch is cheaper than N round-trips.
  const asnSnap = await adminDb.collection("employeeAssignments").get();
  const assignments = asnSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      employeeId: data.employeeId as string,
      projectId: data.projectId as string,
      startDate: readDateField(data.startDate),
      endDate: data.endDate ? readDateField(data.endDate) : null,
      monthlySalary: Number(data.monthlySalary || 0),
    };
  });

  // Project names for display
  const projSnap = await adminDb.collection("projects").get();
  const projName = new Map<string, string>(
    projSnap.docs.map((d) => [d.id, (d.data().name as string) || "(unnamed project)"]),
  );

  // Already-paid tuples for this period
  const paidSnap = await adminDb
    .collection("projectExpenses")
    .where("payrollPeriod", "==", period)
    .get();
  const paidTuples = new Set<string>();
  paidSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.employeeId && data.projectId) {
      paidTuples.add(`${data.employeeId}|${data.projectId}`);
    }
  });

  const toPay: EmployeeEntry[] = [];
  const alreadyPaid: EmployeeEntry[] = [];

  for (const emp of employees) {
    // Assignments that touch the target month at all
    const overlapping = assignments.filter((a) =>
      a.employeeId === emp.id &&
      a.startDate &&
      a.startDate <= monthEnd &&
      (a.endDate === null || a.endDate >= monthStart),
    );
    if (overlapping.length === 0) continue;

    const chargePerProject: Record<string, number> = {};
    const firstAssignByProject: Record<string, string> = {};
    let unallocatedDays = 0;

    for (let d = 1; d <= D; d++) {
      const dayISO = `${year}-${padDay(month)}-${padDay(d)}`;
      const activeToday = overlapping.filter((a) =>
        a.startDate <= dayISO && (a.endDate === null || a.endDate >= dayISO),
      );
      const n = activeToday.length;
      if (n === 0) {
        unallocatedDays++;
        continue;
      }
      for (const a of activeToday) {
        const perDay = a.monthlySalary / D / n;
        chargePerProject[a.projectId] = (chargePerProject[a.projectId] || 0) + perDay;
        if (!firstAssignByProject[a.projectId]) {
          firstAssignByProject[a.projectId] = a.id;
        }
      }
    }

    const allAllocations: Allocation[] = Object.entries(chargePerProject)
      .map(([pid, amt]) => ({
        projectId: pid,
        projectName: projName.get(pid) || "(unknown project)",
        amount: round2(amt),
        assignmentId: firstAssignByProject[pid],
      }))
      .filter((a) => a.amount > 0)
      .sort((a, b) => a.projectName.localeCompare(b.projectName));

    const newAllocations = allAllocations.filter((a) => !paidTuples.has(`${emp.id}|${a.projectId}`));
    const paidAllocations = allAllocations.filter((a) => paidTuples.has(`${emp.id}|${a.projectId}`));

    const baseEntry = {
      employeeId: emp.id,
      name: emp.name || "(unnamed)",
      monthlySalary: Number(emp.monthlySalary || 0),
      unallocatedDays,
    };

    if (newAllocations.length > 0) {
      toPay.push({
        ...baseEntry,
        allocations: newAllocations,
        totalCharge: round2(newAllocations.reduce((s, a) => s + a.amount, 0)),
      });
    }
    if (paidAllocations.length > 0) {
      alreadyPaid.push({
        ...baseEntry,
        allocations: paidAllocations,
        totalCharge: round2(paidAllocations.reduce((s, a) => s + a.amount, 0)),
      });
    }
  }

  toPay.sort((a, b) => a.name.localeCompare(b.name));
  alreadyPaid.sort((a, b) => a.name.localeCompare(b.name));
  const totalAmount = round2(toPay.reduce((s, e) => s + e.totalCharge, 0));

  return { period, periodLabel: label, toPay, alreadyPaid, totalAmount, totalEmployees: toPay.length };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const snap = await adminDb.collection("payrollRuns").orderBy("createdAt", "desc").get();
    const runs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return NextResponse.json({ ok: true, runs });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  // Payroll is HR's decision but it moves bank money, so both gates must pass.
  // With the current role model, this effectively limits payroll to admin.
  const hrForbidden = requireHRWrite(auth);
  if (hrForbidden) return hrForbidden;
  const acctForbidden = requireAccountsWrite(auth);
  if (acctForbidden) return acctForbidden;

  try {
    const body = await req.json();
    const { action, year, month, bankAccountId } = body;

    if (!action || !["preview", "run"].includes(action)) {
      return NextResponse.json({ ok: false, message: "action must be 'preview' or 'run'" }, { status: 400 });
    }
    const y = Number(year);
    const m = Number(month);
    if (!y || !m || m < 1 || m > 12) {
      return NextResponse.json({ ok: false, message: "year and month (1-12) required" }, { status: 400 });
    }
    if (action === "run" && !bankAccountId) {
      return NextResponse.json({ ok: false, message: "bankAccountId required for run" }, { status: 400 });
    }

    const preview = await computePreview(y, m);

    if (action === "preview") {
      return NextResponse.json({ ok: true, preview });
    }

    // action === "run"
    if (preview.toPay.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No new charges for this period — nothing to pay.",
        runId: null,
        created: [],
        totalAmount: 0,
        preview,
      });
    }

    const payDate = new Date(y, m - 1, 1);
    const payDateISO = payDate.toISOString().slice(0, 10);
    const created: any[] = [];

    for (const emp of preview.toPay) {
      for (const alloc of emp.allocations) {
        const description =
          `Salary - ${emp.name} - ${preview.periodLabel} ` +
          `(${alloc.amount.toFixed(2)} / ${emp.totalCharge.toFixed(2)})`;

        const items = [{
          description,
          categoryId: "",
          qty: 1,
          unit: "month",
          amount: alloc.amount,
        }];

        const peRef = await adminDb.collection("projectExpenses").add({
          projectId: alloc.projectId,
          date: Timestamp.fromDate(payDate),
          items,
          totalAmount: alloc.amount,
          bankAccountId,
          vendor: emp.name,
          paidBy: "Payroll",
          paymentMode: "payroll",
          paymentModeCustom: "",
          billData: "",
          billName: "",
          billType: "",
          expenseType: "Company Manpower",
          // Payroll markers used by the idempotency check on re-runs.
          employeeId: emp.employeeId,
          payrollPeriod: preview.period,
          payrollAssignmentId: alloc.assignmentId,
          createdBy: auth.email || "",
          createdAt: FieldValue.serverTimestamp(),
        });

        await writeLedgerEntry({
          bankAccountId,
          amount: -alloc.amount,
          date: payDateISO,
          type: "project-expense",
          source: "projectExpenses",
          sourceId: peRef.id,
          description: `Payroll: ${emp.name} → ${alloc.projectName} (${preview.periodLabel})`,
          createdBy: auth.email,
        });

        created.push({
          employeeId: emp.employeeId,
          name: emp.name,
          projectId: alloc.projectId,
          projectName: alloc.projectName,
          amount: alloc.amount,
          expenseId: peRef.id,
        });
      }
    }

    const totalAmount = round2(created.reduce((s, c) => s + c.amount, 0));
    const totalEmployees = new Set(created.map((c) => c.employeeId)).size;

    const runRef = await adminDb.collection("payrollRuns").add({
      period: preview.period,
      periodLabel: preview.periodLabel,
      bankAccountId,
      totalEmployees,
      totalAmount,
      items: created,
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "payroll-run",
      entityId: runRef.id,
      entityName: `Payroll: ${preview.periodLabel} (${totalEmployees} employees, AED ${totalAmount.toLocaleString()})`,
    });

    return NextResponse.json({ ok: true, runId: runRef.id, created, totalAmount, totalEmployees });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
