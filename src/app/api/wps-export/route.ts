import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  if (!["admin", "hr", "accounts"].includes(auth.role)) {
    return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const { month, year, employerEID, employerBankCode, fileReference, salaryFreqCode = "M" } = await req.json();

    if (!month || !year) return NextResponse.json({ ok: false, message: "month and year required." }, { status: 400 });
    if (!employerEID) return NextResponse.json({ ok: false, message: "employerEID required." }, { status: 400 });

    const empSnap = await adminDb.collection("employees").get();
    const employees = empSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const eligible = employees.filter((e) => e.monthlySalary && Number(e.monthlySalary) > 0 && e.bankIBAN);

    if (eligible.length === 0) {
      return NextResponse.json({ ok: false, message: "No eligible employees (need monthlySalary and bankIBAN)." }, { status: 400 });
    }

    const monthStr = String(month).padStart(2, "0");
    const yearStr = String(year);
    const ref = fileReference || `NX${yearStr}${monthStr}${Date.now().toString().slice(-4)}`;

    // SIF format reference: WPS by UAE Central Bank
    // Header (EDR/SCR/EDR or HDR varies by bank — use HDR/EDR generic format)
    const lines: string[] = [];

    // SCR — Salary Control Record (header)
    const totalSalaries = eligible.reduce((s, e) => s + Number(e.monthlySalary || 0), 0);
    lines.push([
      "SCR",
      employerEID,                              // Employer EID number
      employerBankCode || "",                   // Employer bank routing code
      ref,                                       // File reference
      `${yearStr}-${monthStr}-01`,              // Salary month
      eligible.length.toString(),                // Number of records
      totalSalaries.toFixed(2),                  // Total salaries
      "AED",                                     // Currency
      salaryFreqCode,                            // M = monthly
    ].join(","));

    // EDR — Employee Detail Records
    eligible.forEach((e) => {
      lines.push([
        "EDR",
        e.emiratesId || e.id,                    // Employee ID (EID or local)
        e.bankIBAN,                              // IBAN
        e.bankCode || "",                        // Receiving bank routing code
        Number(e.monthlySalary).toFixed(2),     // Salary amount
        Number(e.fixedAllowances || 0).toFixed(2),
        Number(e.variableAllowances || 0).toFixed(2),
        Number(e.daysOnLeave || 0).toString(),
        Number(e.leaveStartDate ? 1 : 0).toString(),
        e.leaveStartDate || "",
        e.leaveEndDate || "",
      ].join(","));
    });

    const sifContent = lines.join("\n");
    const filename = `WPS_${ref}_${yearStr}${monthStr}.sif`;

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "wps-export",
      entityId: ref,
      entityName: `${eligible.length} employees, AED ${totalSalaries.toFixed(2)}`,
    });

    return new NextResponse(sifContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}