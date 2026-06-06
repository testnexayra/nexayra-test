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
    const snap = await adminDb.collection("expenses").get();
    const expenses = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, date: data.date?.toDate?.()?.toISOString() || data.date };
    });
    expenses.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    return NextResponse.json({ ok: true, expenses });
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
    const { date, categoryId, description, amount, bankAccountId, vendor, paidBy, paymentMode, paymentModeCustom, billData, billName, billType } = body;
    if (!date || !amount || !bankAccountId)
      return NextResponse.json({ ok: false, message: "date, amount, bankAccountId required" }, { status: 400 });
    const amt = Number(amount);
    const docRef = await adminDb.collection("expenses").add({
      date: Timestamp.fromDate(new Date(date)),
      categoryId: categoryId || "",
      description: description || "",
      amount: amt,
      bankAccountId,
      vendor: vendor || "",
      paidBy: paidBy || "",
      paymentMode: paymentMode || "",
      paymentModeCustom: paymentModeCustom || "",
      billData: billData || "",
      billName: billName || "",
      billType: billType || "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });
    await writeLedgerEntry({
      bankAccountId, amount: -amt, date, type: "expense",
      source: "expenses", sourceId: docRef.id,
      description: `Expense: ${description || ""}`,
      createdBy: auth.email,
    });
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "expense",
      entityId: docRef.id,
      entityName: `Expense: ${description || ""}`,
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
    if (updates.amount !== undefined) updates.amount = Number(updates.amount);
    if (updates.date) updates.date = Timestamp.fromDate(new Date(updates.date));

    const existingSnap = await adminDb.collection("expenses").doc(id).get();
    const existing = existingSnap.data();
    await adminDb.collection("expenses").doc(id).set({ ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    if (existing && (updates.amount !== undefined || updates.bankAccountId !== undefined || updates.date !== undefined)) {
      await reverseLedgerBySource("expenses", id);
      const newAmt = updates.amount !== undefined ? updates.amount : existing.amount;
      const newBank = updates.bankAccountId || existing.bankAccountId;
      const newDate = body.date || existing.date?.toDate?.()?.toISOString() || existing.date;
      await writeLedgerEntry({
        bankAccountId: newBank, amount: -newAmt, date: newDate, type: "expense",
        source: "expenses", sourceId: id,
        description: `Expense: ${updates.description || existing.description || ""}`,
        createdBy: auth.email,
      });
      await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "expense",
      entityId: id,
      entityName: `Expense: ${updates.description || existing.description || ""}`,
      details: `Updated expense ${id}`,
    });
    }
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  const forbidden = requireAccountsWrite(auth); if (forbidden) return forbidden;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    await reverseLedgerBySource("expenses", id);
    await adminDb.collection("expenses").doc(id).delete();
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "expense",
      entityId: id,
      entityName: `Expense ${id}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}