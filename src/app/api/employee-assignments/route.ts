import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireHRWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";
import { syncEmployeeProjectIds } from "@/lib/employee-assignments";

const todayISO = () => new Date().toISOString().slice(0, 10);

function rangesOverlap(
  startA: string,
  endA: string | null,
  startB: string,
  endB: string | null,
): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = endA ? new Date(endA).getTime() : Number.POSITIVE_INFINITY;
  const bStart = new Date(startB).getTime();
  const bEnd = endB ? new Date(endB).getTime() : Number.POSITIVE_INFINITY;
  return aStart <= bEnd && bStart <= aEnd;
}

function normalizeAssignment(id: string, data: any) {
  return {
    id,
    ...data,
    startDate: data.startDate?.toDate?.()?.toISOString().slice(0, 10) || data.startDate,
    endDate: data.endDate?.toDate?.()?.toISOString().slice(0, 10) || data.endDate || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId");
    const projectId = url.searchParams.get("projectId");
    const activeOnly = url.searchParams.get("activeOnly") === "true";

    const snap = await adminDb.collection("employeeAssignments").get();
    let assignments = snap.docs.map((d) => normalizeAssignment(d.id, d.data()));

    if (employeeId) assignments = assignments.filter((a: any) => a.employeeId === employeeId);
    if (projectId) assignments = assignments.filter((a: any) => a.projectId === projectId);
    if (activeOnly) {
      const today = todayISO();
      assignments = assignments.filter((a: any) =>
        a.startDate <= today && (a.endDate === null || a.endDate >= today)
      );
    }

    assignments.sort((a: any, b: any) => String(b.startDate).localeCompare(String(a.startDate)));
    return NextResponse.json({ ok: true, assignments });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireHRWrite(auth);
  if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { employeeId, projectId, startDate, endDate, notes } = body;

    if (!employeeId || !projectId || !startDate) {
      return NextResponse.json(
        { ok: false, message: "employeeId, projectId, and startDate are required" },
        { status: 400 },
      );
    }
    if (endDate && new Date(endDate) < new Date(startDate)) {
      return NextResponse.json(
        { ok: false, message: "endDate must be on or after startDate" },
        { status: 400 },
      );
    }

    const empSnap = await adminDb.collection("employees").doc(employeeId).get();
    if (!empSnap.exists) {
      return NextResponse.json({ ok: false, message: "Employee not found" }, { status: 404 });
    }
    const empData = empSnap.data() || {};
    const employeeName = empData.name || "";
    const monthlySalary = Number(empData.monthlySalary || 0);

    // Reject overlapping assignment for SAME employee + SAME project. Different
    // projects can overlap freely.
    const existingSnap = await adminDb
      .collection("employeeAssignments")
      .where("employeeId", "==", employeeId)
      .where("projectId", "==", projectId)
      .get();

    const newEnd = endDate || null;
    for (const doc of existingSnap.docs) {
      const ex = doc.data();
      const exStart = ex.startDate?.toDate?.()?.toISOString().slice(0, 10) || ex.startDate;
      const exEnd = ex.endDate?.toDate?.()?.toISOString().slice(0, 10) || ex.endDate || null;
      if (rangesOverlap(startDate, newEnd, exStart, exEnd)) {
        return NextResponse.json(
          {
            ok: false,
            message: `Overlapping assignment exists for this employee on the same project (${exStart} → ${exEnd || "ongoing"}). End it first or pick a non-overlapping range.`,
          },
          { status: 409 },
        );
      }
    }

    const docRef = await adminDb.collection("employeeAssignments").add({
      employeeId,
      employeeName,
      projectId,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
      monthlySalary,
      notes: notes || "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    await syncEmployeeProjectIds(employeeId);

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "employee-assignment",
      entityId: docRef.id,
      entityName: `Assignment: ${employeeName} → project ${projectId} (${startDate} → ${endDate || "ongoing"})`,
    });

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireHRWrite(auth);
  if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { id, endDate, notes } = body;
    if (!id) {
      return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    }

    const docRef = adminDb.collection("employeeAssignments").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, message: "Assignment not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    const startDate = data.startDate?.toDate?.()?.toISOString().slice(0, 10) || data.startDate;
    const employeeId = data.employeeId;
    const projectId = data.projectId;

    const updates: any = { updatedAt: FieldValue.serverTimestamp(), updatedBy: auth.email || "" };

    if (endDate !== undefined) {
      if (endDate === null || endDate === "") {
        updates.endDate = null;
      } else {
        if (new Date(endDate) < new Date(startDate)) {
          return NextResponse.json(
            { ok: false, message: "endDate must be on or after startDate" },
            { status: 400 },
          );
        }
        // Also recheck overlap on this project (excluding the current doc) since
        // shrinking endDate from null could not cause new overlap, but extending
        // it could. We check anyway for safety.
        const others = await adminDb
          .collection("employeeAssignments")
          .where("employeeId", "==", employeeId)
          .where("projectId", "==", projectId)
          .get();
        for (const other of others.docs) {
          if (other.id === id) continue;
          const ex = other.data();
          const exStart = ex.startDate?.toDate?.()?.toISOString().slice(0, 10) || ex.startDate;
          const exEnd = ex.endDate?.toDate?.()?.toISOString().slice(0, 10) || ex.endDate || null;
          if (rangesOverlap(startDate, endDate, exStart, exEnd)) {
            return NextResponse.json(
              {
                ok: false,
                message: `Updated end date overlaps another assignment on the same project (${exStart} → ${exEnd || "ongoing"}).`,
              },
              { status: 409 },
            );
          }
        }
        updates.endDate = Timestamp.fromDate(new Date(endDate));
      }
    }
    if (notes !== undefined) updates.notes = notes;

    await docRef.update(updates);
    await syncEmployeeProjectIds(employeeId);

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "employee-assignment",
      entityId: id,
      entityName: `Assignment update: ${data.employeeName || ""} on project ${projectId}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireHRWrite(auth);
  if (forbidden) return forbidden;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });

    const docRef = adminDb.collection("employeeAssignments").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, message: "Assignment not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    const employeeId = data.employeeId;

    await docRef.delete();
    if (employeeId) await syncEmployeeProjectIds(employeeId);

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "employee-assignment",
      entityId: id,
      entityName: `Deleted assignment: ${data.employeeName || ""} → project ${data.projectId || ""}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
