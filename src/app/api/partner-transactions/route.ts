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
    const partnerId = url.searchParams.get("partnerId");
    const snap = await adminDb.collection("partnerTransactions").get();
    let transactions = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, date: data.date?.toDate?.()?.toISOString() || data.date };
    });
    if (partnerId) transactions = transactions.filter((t: any) => t.partnerId === partnerId);
    transactions.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    return NextResponse.json({ ok: true, transactions });
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
    const { partnerId, type, amount, bankAccountId, date, note } = body;
    if (!partnerId || !type || !amount || !bankAccountId || !date)
      return NextResponse.json({ ok: false, message: "Missing fields" }, { status: 400 });
    if (!["contribution", "withdrawal", "distribution"].includes(type))
      return NextResponse.json({ ok: false, message: "Invalid type" }, { status: 400 });

    const amt = Number(amount);
    const docRef = await adminDb.collection("partnerTransactions").add({
      partnerId, type, amount: amt, bankAccountId,
      date: Timestamp.fromDate(new Date(date)),
      note: note || "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Ledger: contribution = +, withdrawal/distribution = -
    const ledgerAmount = type === "contribution" ? amt : -amt;
    await writeLedgerEntry({
      bankAccountId, amount: ledgerAmount, date, type: `partner-${type}` as any,
      source: "partnerTransactions", sourceId: docRef.id,
      description: `Partner ${type}: ${note || ""}`,
      createdBy: auth.email,
    });
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "partner-transaction",
      entityId: docRef.id,
      entityName: `Partner transaction: ${type}: ${note || ""}`,
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

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "id required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("partnerTransactions").doc(id);

    // Get transaction details before deleting for audit log
    const transactionSnap = await docRef.get();
    const transactionData = transactionSnap.exists ? transactionSnap.data() : null;

    await reverseLedgerBySource("partnerTransactions", id);

    await docRef.delete();

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "partner-transaction",
      entityId: id,
      entityName: `Partner transaction: ${transactionData?.type || ""}: ${transactionData?.note || ""}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err.message },
      { status: 500 }
    );
  }
}