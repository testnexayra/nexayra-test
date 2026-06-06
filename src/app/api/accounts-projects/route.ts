import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireProjectsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const snap = await adminDb.collection("projects").get();
    const projects = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const peSnap = await adminDb.collection("projectExpenses").where("projectId", "==", d.id).get();
      const totalExpenses = peSnap.docs.reduce((s, e) => s + (e.data().amount || 0), 0);
      // Cost breakdown by expenseType
      const costBreakdown = { material: 0, manpower: 0, equipment: 0, subcontractor: 0, misc: 0 };
      peSnap.docs.forEach(e => {
        const t = e.data().expenseType || "material";
        if (t in costBreakdown) (costBreakdown as any)[t] += (e.data().amount || 0);
      });
      const invSnap = await adminDb.collection("invoices").where("projectId", "==", d.id).get();
      const totalInvoiced = invSnap.docs.reduce((s, i) => s + (i.data().total || 0), 0);
      const invoiceIds = invSnap.docs.map(d => d.id);
      let totalCollected = 0;
      if (invoiceIds.length > 0) {
        const colSnap = await adminDb.collection("collections").get();
        colSnap.docs.forEach(c => {
          const cd = c.data();
          if (invoiceIds.includes(cd.invoiceId)) totalCollected += cd.amount || 0;
        });
      }
      // LPO totals (linked by project name match — Phase 2 will refine via projectId)
      const lpoSnap = await adminDb.collection("lpos").get();
      const linkedLpos = lpoSnap.docs.filter(l => l.data().projectId === d.id || (l.data().project && l.data().project === data.name));
      const totalLpo = linkedLpos.reduce((s, l) => s + (l.data().total || 0), 0);
      const lpoCount = linkedLpos.length;
      // Manpower
      const empSnap = await adminDb.collection("employees").where("assignedProjectIds", "array-contains", d.id).get();
      const monthlyManpower = empSnap.docs.reduce((s, e) => s + (e.data().monthlySalary || 0), 0);

      return {
        id: d.id,
        ...data,
        totalExpenses,
        costBreakdown,
        totalInvoiced,
        totalCollected,
        outstandingInvoice: totalInvoiced - totalCollected,
        totalLpo,
        lpoCount,
        monthlyManpower,
        profit: totalInvoiced - totalExpenses,
        budgetUsedPct: data.budgetedCost > 0 ? (totalExpenses / data.budgetedCost) * 100 : 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    }));
    projects.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return NextResponse.json({ ok: true, projects });
  } catch (err: any) {
    console.error("projects GET:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireProjectsWrite(auth); if (forbidden) return forbidden;
  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ ok: false, message: "Name required" }, { status: 400 });
    const docRef = await adminDb.collection("projects").add({
      code: body.code?.trim() || "",
      name: body.name.trim(),
      client: body.client?.trim() || "",
      location: body.location?.trim() || "",
      scope: body.scope?.trim() || "",
      contractValue: Number(body.contractValue || 0),
      budgetedCost: Number(body.budgetedCost || 0),
      projectManager: body.projectManager || "",
      engineerAssigned: body.engineerAssigned || "",
      startDate: body.startDate || "",
      endDate: body.endDate || "",
      plannedStart: body.plannedStart || body.startDate || "",
      plannedEnd: body.plannedEnd || body.endDate || "",
      actualProgress: Number(body.actualProgress || 0),
      status: body.status || "planning",
      notes: body.notes || "",
      driveFolderId: "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "project",
      entityId: docRef.id,
      entityName: `Project: ${body.name.trim()}`,
    });
    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  // Allow PMs full edit; engineers only progress field
  if (auth.role !== "admin" && auth.role !== "project-manager" && auth.role !== "engineer") {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    if (auth.role === "engineer") {
      // Restrict engineers to progress + notes only
      const filtered: any = {};
      if ("actualProgress" in updates) filtered.actualProgress = Number(updates.actualProgress);
      if ("notes" in updates) filtered.notes = updates.notes;
      if (Object.keys(filtered).length === 0) return NextResponse.json({ ok: false, message: "Engineers may only update progress." }, { status: 403 });
      await adminDb.collection("projects").doc(id).set({ ...filtered, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ ok: true });
    }
    if (updates.contractValue !== undefined) updates.contractValue = Number(updates.contractValue);
    if (updates.budgetedCost !== undefined) updates.budgetedCost = Number(updates.budgetedCost);
    if (updates.actualProgress !== undefined) updates.actualProgress = Number(updates.actualProgress);
    await adminDb.collection("projects").doc(id).set({ ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "project",
      entityId: id,
      entityName: `Project: ${updates.name || ""}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireProjectsWrite(auth); if (forbidden) return forbidden;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    // Safety: don't delete if it has expenses
    const peSnap = await adminDb.collection("projectExpenses").where("projectId", "==", id).limit(1).get();
    if (!peSnap.empty) return NextResponse.json({ ok: false, message: "Cannot delete: project has expenses linked. Remove them first." }, { status: 400 });
    await adminDb.collection("projects").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}