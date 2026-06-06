import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireAccountsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const snap = await adminDb.collection("partners").orderBy("createdAt", "asc").get();
    const partners = await Promise.all(snap.docs.map(async (d: any) => {
      const data = d.data();
      const txSnap = await adminDb.collection("partnerTransactions").where("partnerId", "==", d.id).get();
      let contributed = 0, withdrawn = 0, distributed = 0;
      txSnap.docs.forEach((t: any) => {
        const td = t.data();
        if (td.type === "contribution") contributed += td.amount || 0;
        else if (td.type === "withdrawal") withdrawn += td.amount || 0;
        else if (td.type === "distribution") distributed += td.amount || 0;
      });
      return {
        id: d.id,
        name: data.name,
        email: data.email || "",
        ownershipPct: data.ownershipPct || 0,
        contributed,
        withdrawn,
        distributed,
        netCapital: contributed - withdrawn,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    }));
    return NextResponse.json({ ok: true, partners });
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
    if (!body.name?.trim()) return NextResponse.json({ ok: false, message: "Name required" }, { status: 400 });
    const docRef = await adminDb.collection("partners").add({
      name: body.name.trim(),
      email: body.email?.trim() || "",
      ownershipPct: Number(body.ownershipPct || 0),
      createdAt: FieldValue.serverTimestamp(),
    });
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "partner",
      entityId: docRef.id,
      entityName: `Partner: ${body.name.trim()}`,
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
    if (updates.ownershipPct !== undefined) updates.ownershipPct = Number(updates.ownershipPct);
    await adminDb.collection("partners").doc(id).set({ ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "partner",
      entityId: id,
      entityName: `Partner: ${updates.name || ""}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}