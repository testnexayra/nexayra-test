import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireAccountsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const snap = await adminDb.collection("invoices").orderBy("createdAt", "desc").get();
    const invoices = await Promise.all(snap.docs.map(async (d: any) => {
      const data = d.data();
      // Compute amountPaid from collections
      const colSnap = await adminDb.collection("collections").where("invoiceId", "==", d.id).get();
      const amountPaid = colSnap.docs.reduce((s: number, c: any) => s + (c.data().amount || 0), 0);
      const total = data.total || 0;
      let status = "unpaid";
      if (amountPaid >= total && total > 0) status = "paid";
      else if (amountPaid > 0) status = "partial";
      return {
        id: d.id, ...data,
        amountPaid, status,
        outstanding: total - amountPaid,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    }));
    return NextResponse.json({ ok: true, invoices });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireAccountsWrite(auth); if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { invoiceNo, clientName, total, date, dueDate, projectId } = body;
    if (!invoiceNo || !total) return NextResponse.json({ ok: false, message: "invoiceNo and total required" }, { status: 400 });
    const docRef = await adminDb.collection("invoices").add({
      invoiceNo, clientName: clientName || "", total: Number(total),
      date: date || "", dueDate: dueDate || "", projectId: projectId || "",
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
  const forbidden = requireAccountsWrite(auth); if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    if (updates.total !== undefined) updates.total = Number(updates.total);
    await adminDb.collection("invoices").doc(id).set({ ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}