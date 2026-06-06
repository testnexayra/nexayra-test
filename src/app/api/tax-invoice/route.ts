import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const body = await req.json();

    const counterRef = adminDb.collection("counters").doc("taxInvoice");
    const num = await adminDb.runTransaction(async (t: FirebaseFirestore.Transaction) => {
      const snap = await t.get(counterRef);
      const current = snap.exists ? (snap.data()?.current || 1000) : 1000;
      const next = current + 1;
      t.set(counterRef, { current: next }, { merge: true });
      return next;
    });

    const invoiceNo = `INV-NEX-${num}`;
    const data = {
      ...body,
      invoiceNo,
      createdBy: authResult.email || "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await adminDb.collection("taxInvoices").doc(invoiceNo.replace(/[^\w\-]/g, "_")).set(data);

    await logAudit({
      userId: authResult.uid,
      userEmail: authResult.email,
      action: "create",
      entityType: "taxInvoice",
      entityId: invoiceNo,
      entityName: invoiceNo,
      details: `Created tax invoice ${invoiceNo}`,
    });

    // Auto-mirror into accounts invoices collection.
    // Carry projectId/project from the tax invoice so collections inherit them.
    try {
      await adminDb.collection("invoices").add({
        invoiceNo,
        clientName: data.clientName || "",
        total: Number(data.total || 0),
        date: data.date || "",
        dueDate: data.dueDate || "",
        projectId: data.projectId || "",
        project: data.project || "",
        projectCode: data.projectCode || "",
        sourceTaxInvoiceId: invoiceNo.replace(/[^\w\-]/g, "_"),
        createdBy: authResult.email || "",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (mirrorErr) {
      console.warn("Failed to mirror tax invoice to accounts:", mirrorErr);
    }

    return NextResponse.json({ ok: true, invoice: { ...data, createdAt: new Date().toISOString() } });
  } catch (err: any) {
    console.error("TaxInvoice POST error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const snap = await adminDb.collection("taxInvoices").orderBy("createdAt", "desc").get();
    const invoices = snap.docs.map((d: any) => {
      const data = d.data();
      return {
        ...data,
        id: d.id,                                            // canonical id
        _docId: d.id,                                        // backward-compat alias
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return NextResponse.json({ ok: true, invoices });
  } catch (err: any) {
    console.error("TaxInvoice GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;
    const body = await req.json();
    const { invoiceNo, _docId, ...updates } = body;
    if (!invoiceNo && !_docId) {
      return NextResponse.json({ ok: false, message: "Missing invoiceNo or _docId" }, { status: 400 });
    }

    const docId = _docId || invoiceNo.replace(/[^\w\-]/g, "_");
    const docSnap = await adminDb.collection("taxInvoices").doc(docId).get();
    if (!docSnap.exists) {
      return NextResponse.json({ ok: false, message: `Invoice ${invoiceNo} not found.` }, { status: 404 });
    }

    const { createRevision } = await import("@/lib/revisions");
    const newNumber = await createRevision("taxInvoices", docId, "invoiceNo", updates, authResult.email || "");

    await logAudit({
      userId: authResult.uid,
      userEmail: authResult.email,
      action: "update",
      entityType: "taxInvoice",
      entityId: invoiceNo,
      entityName: invoiceNo,
      details: `Updated tax invoice ${invoiceNo}`,
    });

    return NextResponse.json({ ok: true, newNumber });
  } catch (err: any) {
    console.error("TaxInvoice PUT error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}