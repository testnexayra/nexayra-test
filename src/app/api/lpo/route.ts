import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, checkFirebaseInit } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

function asNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeLpoItem(item: any) {
  const qty = asNumber(item.qty ?? item.quantity);
  const unitPrice = asNumber(item.unitPrice ?? item.rate ?? item.amount);
  const discount = asNumber(item.discount);
  const gross = qty * unitPrice;
  const discountAmount = gross * (discount / 100);
  const subtotal = gross - discountAmount;
  const vat = subtotal * 0.05;

  return {
    ...item,
    description: String(item.description || item.item || ""),
    qty: String(qty || ""),
    uom: String(item.uom || item.unit || "Nos"),
    amount: String(unitPrice || ""),
    discount: String(discount || "0"),
    lineTotal: Number((subtotal + vat).toFixed(2)),
  };
}

function normalizeLpo(data: FirebaseFirestore.DocumentData, id: string) {
  const items = Array.isArray(data.items) ? data.items.map(normalizeLpoItem) : [];
  const calculated = items.reduce(
    (acc, item) => {
      const qty = asNumber(item.qty);
      const unitPrice = asNumber(item.amount);
      const discount = asNumber(item.discount);
      const gross = qty * unitPrice;
      const discountAmount = gross * (discount / 100);
      const subtotal = gross - discountAmount;
      const vat = subtotal * 0.05;
      acc.totalDiscount += discountAmount;
      acc.subtotal += subtotal;
      acc.vat += vat;
      acc.total += subtotal + vat;
      return acc;
    },
    { totalDiscount: 0, subtotal: 0, vat: 0, total: 0 }
  );

  const subtotal = asNumber(data.subtotal) || Number(calculated.subtotal.toFixed(2));
  const vat = asNumber(data.vat) || asNumber(data.vatAmount) || Number(calculated.vat.toFixed(2));
  const total = asNumber(data.total) || asNumber(data.grandTotal) || asNumber(data.totalAmount) || Number((subtotal + vat).toFixed(2));

  return {
    ...data,
    _docId: id,
    items,
    clientName: data.clientName || data.projectName || data.site || "",
    project: data.project || data.projectName || data.site || "",
    siteLocation: data.siteLocation || data.site || data.projectName || "",
    contact: data.contact || data.attn || "",
    subtotal,
    totalDiscount: asNumber(data.totalDiscount) || Number(calculated.totalDiscount.toFixed(2)),
    vat,
    total,
    approved: Boolean(data.approved ?? data.status === "approved"),
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
    approvedAt: data.approvedAt?.toDate?.()?.toISOString() || data.approvedAt || null,
  };
}

export async function POST(req: NextRequest) {
  const fbCheck = checkFirebaseInit();
  if (fbCheck) return fbCheck;
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const body = await req.json();
    const counterRef = adminDb.collection("counters").doc("lpo");
    const nxrNo = await adminDb.runTransaction(async (t: FirebaseFirestore.Transaction) => {
      const snap = await t.get(counterRef);
      const current = snap.exists ? (snap.data()?.current || 1000) : 1000;
      const next = current + 1;
      t.set(counterRef, { current: next }, { merge: true });
      return next;
    });
    const lpoData = { ...body, nxrNo, approved: false, approvedBy: "", approvedAt: null, createdBy: authResult.email || "", createdAt: FieldValue.serverTimestamp() };
    await adminDb.collection("lpos").doc(`LPO-${nxrNo}`).set(lpoData);
    await logAudit({
  userId: authResult.uid,
  userEmail: authResult.email,
  action: "create",
  entityType: "lpo",
  entityId: `LPO-${nxrNo}`,
  entityName: `LPO-${nxrNo} (${body.vendorName})`,
});
    return NextResponse.json({ ok: true, lpo: { ...lpoData, createdAt: new Date().toISOString() } });
  } catch (err: any) {
    console.error("LPO POST error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const fbCheck = checkFirebaseInit();
  if (fbCheck) return fbCheck;
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const snap = await adminDb.collection("lpos").orderBy("nxrNo", "desc").get();
    const lpos = snap.docs.map((d) => normalizeLpo(d.data(), d.id));
    return NextResponse.json({ ok: true, lpos });
  } catch (err: any) {
    console.error("LPO GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;

    const { requireLpoApprover } = await import("@/lib/api-auth");
    const forbidden = requireLpoApprover(authResult); if (forbidden) return forbidden;

    const { nxrNo, approvedBy, _docId } = await req.json();
    if ((!nxrNo && !_docId) || !approvedBy) return NextResponse.json({ ok: false, message: "Missing nxrNo/_docId or approvedBy" }, { status: 400 });

    let docRef;
    if (_docId) {
      docRef = adminDb.collection("lpos").doc(_docId);
    } else {
      docRef = adminDb.collection("lpos").doc(`LPO-${nxrNo}`);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        const query = await adminDb.collection("lpos").where("nxrNo", "==", nxrNo).limit(1).get();
        if (query.empty) return NextResponse.json({ ok: false, message: `LPO ${nxrNo} not found.` }, { status: 404 });
        docRef = query.docs[0].ref;
      }
    }

    await docRef.set({ approved: true, approvedBy, approvedAt: FieldValue.serverTimestamp() }, { merge: true });
    await logAudit({
  userId: authResult.uid,
  userEmail: authResult.email,
  action: "approve",
  entityType: "lpo",
  entityId: `LPO-${nxrNo}`,
  entityName: `LPO-${nxrNo}`,
  details: `Approved by ${approvedBy}`,
});
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("LPO PATCH error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const body = await req.json();
    const { nxrNo, _docId, ...updates } = body;
    if (!nxrNo && !_docId) return NextResponse.json({ ok: false, message: "Missing nxrNo or _docId" }, { status: 400 });

    let docId = _docId;
    if (!docId) {
      // Try canonical ID first
      docId = `LPO-${nxrNo}`;
      const canonical = await adminDb.collection("lpos").doc(docId).get();
      if (!canonical.exists) {
        const query = await adminDb.collection("lpos").where("nxrNo", "==", nxrNo).limit(1).get();
        if (query.empty) return NextResponse.json({ ok: false, message: `LPO ${nxrNo} not found.` }, { status: 404 });
        docId = query.docs[0].id;
      }
    }

    const { createRevision } = await import("@/lib/revisions");
    const newNumber = await createRevision("lpos", docId, "nxrNo", updates, authResult.email || "");
    return NextResponse.json({ ok: true, newNumber });
  } catch (err: any) {
    console.error("LPO PUT error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;

    const { requireProcurementWrite } = await import("@/lib/api-auth");
    const forbidden = requireProcurementWrite(authResult);
    if (forbidden) return forbidden;

    const { nxrNo, _docId } = await req.json();
    if (!nxrNo && !_docId) {
      return NextResponse.json({ ok: false, message: "Missing nxrNo or _docId" }, { status: 400 });
    }

    let docRef = _docId ? adminDb.collection("lpos").doc(_docId) : adminDb.collection("lpos").doc(`LPO-${nxrNo}`);
    let docSnap = await docRef.get();

    if (!docSnap.exists && nxrNo) {
      const query = await adminDb.collection("lpos").where("nxrNo", "==", nxrNo).limit(1).get();
      if (query.empty) {
        return NextResponse.json({ ok: false, message: `LPO ${nxrNo} not found.` }, { status: 404 });
      }
      docRef = query.docs[0].ref;
      docSnap = query.docs[0];
    }

    await docRef.delete();
    await logAudit({
      userId: authResult.uid,
      userEmail: authResult.email,
      action: "delete",
      entityType: "lpo",
      entityId: String(nxrNo || _docId),
      entityName: `LPO-${nxrNo || _docId}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("LPO DELETE error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
