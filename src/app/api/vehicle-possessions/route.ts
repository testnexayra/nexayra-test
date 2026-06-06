import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireLogisticsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get("vehicleId");
    const snap = await adminDb.collection("vehiclePossessions").get();
    let possessions = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id, ...data,
        assignedDate: data.assignedDate?.toDate?.()?.toISOString() || data.assignedDate,
        returnDate: data.returnDate?.toDate?.()?.toISOString() || data.returnDate,
      };
    });
    if (vehicleId) possessions = possessions.filter((p: any) => p.vehicleId === vehicleId);
    possessions.sort((a: any, b: any) => String(b.assignedDate).localeCompare(String(a.assignedDate)));
    return NextResponse.json({ ok: true, possessions });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireLogisticsWrite(auth); if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { vehicleId, employeeName, assignedDate, purpose, returnDate, notes } = body;
    if (!vehicleId || !employeeName || !assignedDate)
      return NextResponse.json({ ok: false, message: "vehicleId, employeeName, assignedDate required" }, { status: 400 });

    // Auto-return any open possessions for this vehicle first
    const openSnap = await adminDb.collection("vehiclePossessions")
      .where("vehicleId", "==", vehicleId).get();
    const batch = adminDb.batch();
    openSnap.docs.forEach(d => {
      const data = d.data();
      if (!data.returnDate) batch.set(d.ref, { returnDate: Timestamp.fromDate(new Date(assignedDate)), autoClosed: true }, { merge: true });
    });
    await batch.commit();

    const docRef = await adminDb.collection("vehiclePossessions").add({
      vehicleId, employeeName: employeeName.trim(),
      assignedDate: Timestamp.fromDate(new Date(assignedDate)),
      purpose: purpose || "",
      returnDate: returnDate ? Timestamp.fromDate(new Date(returnDate)) : null,
      notes: notes || "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireLogisticsWrite(auth); if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { id, returnDate, notes } = body;
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    const updates: any = { updatedAt: FieldValue.serverTimestamp() };
    if (returnDate) updates.returnDate = Timestamp.fromDate(new Date(returnDate));
    if (notes !== undefined) updates.notes = notes;
    await adminDb.collection("vehiclePossessions").doc(id).set(updates, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireLogisticsWrite(auth); if (forbidden) return forbidden;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    await adminDb.collection("vehiclePossessions").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}