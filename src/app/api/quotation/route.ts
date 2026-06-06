import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, checkFirebaseInit } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const fbCheck = checkFirebaseInit();
  if (fbCheck) return fbCheck;
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const body = await req.json();
    const counterRef = adminDb.collection("counters").doc("quotation");
    const num = await adminDb.runTransaction(async (t: FirebaseFirestore.Transaction) => {
      const snap = await t.get(counterRef);
      const current = snap.exists ? (snap.data()?.current || 1054) : 1054;
      const next = current + 1;
      t.set(counterRef, { current: next }, { merge: true });
      return next;
    });
    const quotationNo = `QTN-NEX-${num}`;
    const data = { ...body, quotationNo, createdBy: authResult.email || "", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    await adminDb.collection("quotations").doc(quotationNo.replace(/[^\w\-]/g, "_")).set(data);
    await logAudit({
      userId: authResult.uid,
      userEmail: authResult.email,
      action: "create",
      entityType: "quotation",
      entityId: quotationNo,
      entityName: quotationNo,
    });
    return NextResponse.json({ ok: true, quotation: { ...data, createdAt: new Date().toISOString() } });
  } catch (err: any) {
    console.error("Quotation POST error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const fbCheck = checkFirebaseInit();
  if (fbCheck) return fbCheck;
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const snap = await adminDb.collection("quotations").orderBy("createdAt", "desc").get();
    const quotations = snap.docs.map((d) => {
      const data = d.data();
      return { ...data, _docId: d.id, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
    });
    return NextResponse.json({ ok: true, quotations });
  } catch (err: any) {
    console.error("Quotation GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const body = await req.json();
    const { quotationNo, _docId, ...updates } = body;
    if (!quotationNo && !_docId) return NextResponse.json({ ok: false, message: "Missing quotationNo or _docId" }, { status: 400 });

    let docId = _docId || quotationNo.replace(/[^\w\-]/g, "_");
    const docSnap = await adminDb.collection("quotations").doc(docId).get();
    if (!docSnap.exists) return NextResponse.json({ ok: false, message: `Quotation ${quotationNo} not found.` }, { status: 404 });

    const { createRevision } = await import("@/lib/revisions");
    const newNumber = await createRevision("quotations", docId, "quotationNo", updates, authResult.email || "");
    await logAudit({
  userId: authResult.uid,
  userEmail: authResult.email,
  action: "update",
  entityType: "quotation",
  entityId: quotationNo,
  entityName: quotationNo,
  details: `Updated quotation ${quotationNo}`,
});
    return NextResponse.json({ ok: true, newNumber });
  } catch (err: any) {
    console.error("Quotation PUT error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}