import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireHRWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const snap = await adminDb.collection("employees").get();
    const employees = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        joinDate: data.joinDate?.toDate?.()?.toISOString() || data.joinDate || "",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });
    employees.sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));
    return NextResponse.json({ ok: true, employees });
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
    if (!body.name?.trim()) {
      return NextResponse.json({ ok: false, message: "Name required" }, { status: 400 });
    }

    const docRef = await adminDb.collection("employees").add({
      // Core
      name: body.name.trim(),
      empId: body.empId || "",
      role: body.role || "",
      department: body.department || "",
      monthlySalary: Number(body.monthlySalary || 0),
      phone: body.phone || "",
      email: body.email || "",
      joinDate: body.joinDate || "",
      status: body.status || "active",
      // assignedProjectIds is owned by /api/employee-assignments and is a read-only
      // mirror of currently-active assignments. Seed it empty on create.
      assignedProjectIds: [],
      notes: body.notes || "",

      // Compliance — Emirates ID (legacy `emiratesId` kept for old records, new fields preferred)
      emiratesId: body.emiratesId || "",
      emiratesIdNumber: body.emiratesIdNumber || body.emiratesId || null,
      emiratesIdExpiry: body.emiratesIdExpiry || null,

      // Compliance — Visa
      visaNumber: body.visaNumber || null,
      visaExpiry: body.visaExpiry || null,

      // Compliance — Passport
      passportNumber: body.passportNumber || null,
      passportExpiry: body.passportExpiry || null,

      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "employee",
      entityId: docRef.id,
      entityName: `Employee: ${body.name.trim()}`,
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
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });

    if (updates.monthlySalary !== undefined) updates.monthlySalary = Number(updates.monthlySalary);

    // Allow-list of fields that can be updated.
    // assignedProjectIds is intentionally NOT here — it is owned by the
    // /api/employee-assignments endpoint, which keeps it in sync as a read-only
    // mirror of currently-active assignments.
    const allowed = [
      "name", "empId", "role", "department", "monthlySalary",
      "phone", "email", "joinDate", "status", "notes",
      "emiratesId", "emiratesIdNumber", "emiratesIdExpiry",
      "visaNumber", "visaExpiry",
      "passportNumber", "passportExpiry",
    ];
    const safeUpdates: any = { updatedAt: FieldValue.serverTimestamp() };
    for (const k of allowed) if (k in updates) safeUpdates[k] = updates[k];

    await adminDb.collection("employees").doc(id).set(safeUpdates, { merge: true });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "employee",
      entityId: id,
      entityName: `Employee: ${updates.name || ""}`,
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

    // Read the doc first so we can log a meaningful name
    const snap = await adminDb.collection("employees").doc(id).get();
    const empName = snap.exists ? (snap.data() as any).name || id : id;

    await adminDb.collection("employees").doc(id).delete();

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "employee",
      entityId: id,
      entityName: `Employee: ${empName}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}