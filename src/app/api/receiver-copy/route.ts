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
    const counterRef = adminDb.collection("counters").doc("receiverCopy");
    const num = await adminDb.runTransaction(async (t: FirebaseFirestore.Transaction) => {
      const snap = await t.get(counterRef);
      const current = snap.exists ? (snap.data()?.current || 1000) : 1000;
      const next = current + 1;
      t.set(counterRef, { current: next }, { merge: true });
      return next;
    });
    const documentNo = `RC-NEX-${num}`;
    const data = { ...body, documentNo, createdBy: authResult.email || "", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    await adminDb.collection("receiverCopies").doc(documentNo.replace(/[^\w\-]/g, "_")).set(data);
    await logAudit({
      userId: authResult.uid,
      userEmail: authResult.email,
      action: "create",
      entityType: "receiverCopy",
      entityId: documentNo,
      entityName: documentNo,
    });
    return NextResponse.json({ ok: true, receiverCopy: { ...data, createdAt: new Date().toISOString() } });
  } catch (err: any) {
    console.error("ReceiverCopy POST error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const fbCheck = checkFirebaseInit();
  if (fbCheck) return fbCheck;
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const snap = await adminDb.collection("receiverCopies").orderBy("createdAt", "desc").get();
    const receiverCopies = snap.docs.map((d) => {
      const data = d.data();
      return { ...data, _docId: d.id, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
    });
    return NextResponse.json({ ok: true, receiverCopies });
  } catch (err: any) {
    console.error("ReceiverCopy GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const body = await req.json();
    const { documentNo, _docId, ...updates } = body;
    if (!documentNo && !_docId) return NextResponse.json({ ok: false, message: "Missing documentNo or _docId" }, { status: 400 });

    let docId = _docId || documentNo.replace(/[^\w\-]/g, "_");
    const docSnap = await adminDb.collection("receiverCopies").doc(docId).get();
    if (!docSnap.exists) return NextResponse.json({ ok: false, message: `Receipt ${documentNo} not found.` }, { status: 404 });

    const { createRevision } = await import("@/lib/revisions");
    const newNumber = await createRevision("receiverCopies", docId, "documentNo", updates, authResult.email || "");
    await logAudit({
  userId: authResult.uid,
  userEmail: authResult.email,
  action: "update",
  entityType: "receiverCopy",
  entityId: documentNo,
  entityName: documentNo,
  details: `Updated receiver copy ${documentNo}`,
});
    return NextResponse.json({ ok: true, newNumber });
  } catch (err: any) {
    console.error("ReceiverCopy PUT error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}