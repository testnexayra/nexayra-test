import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireLogisticsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const snap = await adminDb.collection("vehicles").get();
    const vehicles = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const posSnap = await adminDb
          .collection("vehiclePossessions")
          .where("vehicleId", "==", d.id)
          .get();

        const possessions = posSnap.docs.map((p) => {
          const pd = p.data();
          return {
            id: p.id,
            ...pd,
            assignedDate: pd.assignedDate?.toDate?.()?.toISOString() || pd.assignedDate,
            returnDate: pd.returnDate?.toDate?.()?.toISOString() || pd.returnDate,
          };
        });

        possessions.sort((a: any, b: any) =>
          String(b.assignedDate).localeCompare(String(a.assignedDate))
        );

        const current = possessions.find((p: any) => !p.returnDate) || null;

        return {
          id: d.id,
          ...data,
          currentPossession: current,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        };
      })
    );

    vehicles.sort((a: any, b: any) =>
      String(a.plateNumber || "").localeCompare(String(b.plateNumber || ""))
    );

    return NextResponse.json({ ok: true, vehicles });
  } catch (err: any) {
    console.error("vehicles GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireLogisticsWrite(auth);
  if (forbidden) return forbidden;
  try {
    const body = await req.json();
    if (!body.plateNumber?.trim()) {
      return NextResponse.json({ ok: false, message: "Plate number required" }, { status: 400 });
    }

    const docRef = await adminDb.collection("vehicles").add({
      // Core
      plateNumber: body.plateNumber.trim(),
      make: body.make || "",
      model: body.model || "",
      year: body.year || "",
      color: body.color || "",

      // Compliance — Mulkiya / Insurance / Service
      mulkiyaNumber: body.mulkiyaNumber || null,
      mulkiyaExpiry: body.mulkiyaExpiry || body.registrationExpiry || null,
      registrationExpiry: body.registrationExpiry || body.mulkiyaExpiry || "",
      insurancePolicy: body.insurancePolicy || null,
      insuranceExpiry: body.insuranceExpiry || "",
      lastServiceDate: body.lastServiceDate || null,

      // Ownership
      ownership: body.ownership || "owned",
      rentalCompany: body.rentalCompany || "",
      rentalStartDate: body.rentalStartDate || "",
      rentalEndDate: body.rentalEndDate || "",
      monthlyRentalCost: Number(body.monthlyRentalCost || 0),

      notes: body.notes || "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "vehicle",
      entityId: docRef.id,
      entityName: `Vehicle: ${body.plateNumber.trim()}`,
    });

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err: any) {
    console.error("vehicles POST error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireLogisticsWrite(auth);
  if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });

    if (updates.monthlyRentalCost !== undefined) {
      updates.monthlyRentalCost = Number(updates.monthlyRentalCost);
    }

    const allowed = [
      "plateNumber", "make", "model", "year", "color",
      "registrationExpiry", "mulkiyaNumber", "mulkiyaExpiry",
      "insurancePolicy", "insuranceExpiry", "lastServiceDate",
      "ownership", "rentalCompany", "rentalStartDate", "rentalEndDate",
      "monthlyRentalCost", "notes",
    ];
    const safeUpdates: any = { updatedAt: FieldValue.serverTimestamp() };
    for (const k of allowed) if (k in updates) safeUpdates[k] = updates[k];

    await adminDb.collection("vehicles").doc(id).set(safeUpdates, { merge: true });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "vehicle",
      entityId: id,
      entityName: `Vehicle: ${updates.plateNumber || id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireLogisticsWrite(auth);
  if (forbidden) return forbidden;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });

    // Read the doc first so we can log a meaningful name
    const snap = await adminDb.collection("vehicles").doc(id).get();
    const plate = snap.exists ? (snap.data() as any).plateNumber || id : id;

    await adminDb.collection("vehicles").doc(id).delete();

    // Also delete possessions
    const posSnap = await adminDb.collection("vehiclePossessions").where("vehicleId", "==", id).get();
    if (!posSnap.empty) {
      const batch = adminDb.batch();
      posSnap.docs.forEach((p) => batch.delete(p.ref));
      await batch.commit();
    }

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "vehicle",
      entityId: id,
      entityName: `Vehicle: ${plate}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}