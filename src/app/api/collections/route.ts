import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireAccountsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { writeLedgerEntry, reverseLedgerBySource } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoiceId");
    const snap = await adminDb.collection("collections").get();
    let collections = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, date: data.date?.toDate?.()?.toISOString() || data.date };
    });
    if (invoiceId) collections = collections.filter((c: any) => c.invoiceId === invoiceId);
    collections.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    return NextResponse.json({ ok: true, collections });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireAccountsWrite(auth);
  if (forbidden) return forbidden;
  try {
    const body = await req.json();
    const { invoiceId, date, amount, bankAccountId, reference, note } = body;
    if (!invoiceId || !date || !amount || !bankAccountId) {
      return NextResponse.json({ ok: false, message: "Missing fields" }, { status: 400 });
    }
    const amt = Number(amount);

    // Look up the invoice to copy its projectId/project name onto the collection.
    // Try the `invoices` collection first (mirror), then `taxInvoices` (canonical).
    // This ensures the project page can find this collection via projectId.
    let projectId = "";
    let projectName = "";
    let invoiceNo = "";
    try {
      const invSnap = await adminDb.collection("invoices").doc(invoiceId).get();
      if (invSnap.exists) {
        const d = invSnap.data() || {};
        projectId = d.projectId || "";
        projectName = d.project || d.clientName || "";
        invoiceNo = d.invoiceNo || "";

        // If the mirror doc is missing project info, look up the source taxInvoice
        if (!projectId && !projectName && d.sourceTaxInvoiceId) {
          const txSnap = await adminDb.collection("taxInvoices").doc(d.sourceTaxInvoiceId).get();
          if (txSnap.exists) {
            const tx = txSnap.data() || {};
            projectId = tx.projectId || "";
            projectName = tx.project || "";
            invoiceNo = tx.invoiceNo || invoiceNo;
          }
        }
      } else {
        // Maybe invoiceId is actually a taxInvoice doc ID
        const txSnap = await adminDb.collection("taxInvoices").doc(invoiceId).get();
        if (txSnap.exists) {
          const tx = txSnap.data() || {};
          projectId = tx.projectId || "";
          projectName = tx.project || "";
          invoiceNo = tx.invoiceNo || "";
        }
      }
    } catch (lookupErr) {
      console.warn("Failed to resolve invoice for projectId propagation:", lookupErr);
    }

    const docRef = await adminDb.collection("collections").add({
      invoiceId,
      invoiceNo,
      projectId,
      project: projectName,
      date: Timestamp.fromDate(new Date(date)),
      amount: amt,
      bankAccountId,
      reference: reference || "",
      note: note || "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    await writeLedgerEntry({
      bankAccountId,
      amount: amt,
      date,
      type: "collection",
      source: "collections",
      sourceId: docRef.id,
      description: `Collection for invoice: ${reference || invoiceId}`,
      createdBy: auth.email,
    });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "collection",
      entityId: docRef.id,
      entityName: `Collection for invoice ${invoiceId}`,
    });

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireAccountsWrite(auth);
  if (forbidden) return forbidden;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    await reverseLedgerBySource("collections", id);
    await adminDb.collection("collections").doc(id).delete();
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "collection",
      entityId: id,
      entityName: `Collection for invoice ${id}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}