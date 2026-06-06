import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireAccountsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { writeLedgerEntry, reverseLedgerBySource } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

type TxnType = "allocation" | "expense" | "reimbursement";

function normalizeTxn(id: string, data: any) {
  const dateISO = data.date?.toDate?.()?.toISOString() || data.date;
  const createdAtISO = data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "";
  return { id, ...data, date: dateISO, createdAt: createdAtISO };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const type = url.searchParams.get("type");
    const snap = await adminDb.collection("pettyCashTransactions").get();
    let transactions = snap.docs.map((d) => normalizeTxn(d.id, d.data()));
    if (projectId) transactions = transactions.filter((t: any) => t.projectId === projectId);
    if (type) transactions = transactions.filter((t: any) => t.type === type);
    transactions.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    return NextResponse.json({ ok: true, transactions });
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
    const {
      type,
      projectId,
      date,
      amount,
      description,
      bankAccountId,
      categoryId,
      vendor,
      paidBy,
      billData,
      billName,
      billType,
    } = body;

    const validTypes: TxnType[] = ["allocation", "expense", "reimbursement"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ ok: false, message: "type must be allocation, expense, or reimbursement" }, { status: 400 });
    }
    if (!projectId) return NextResponse.json({ ok: false, message: "projectId required" }, { status: 400 });
    if (!date) return NextResponse.json({ ok: false, message: "date required" }, { status: 400 });
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      return NextResponse.json({ ok: false, message: "amount must be a positive number" }, { status: 400 });
    }
    if ((type === "allocation" || type === "reimbursement") && !bankAccountId) {
      return NextResponse.json({ ok: false, message: "bankAccountId required for allocation/reimbursement" }, { status: 400 });
    }

    const docRef = await adminDb.collection("pettyCashTransactions").add({
      type,
      projectId,
      date: Timestamp.fromDate(new Date(date)),
      amount: amt,
      description: description || "",
      bankAccountId: bankAccountId || "",
      categoryId: categoryId || "",
      vendor: vendor || "",
      paidBy: paidBy || "",
      billData: billData || "",
      billName: billName || "",
      billType: billType || "",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    if (type === "allocation" || type === "reimbursement") {
      const ledgerType = type === "allocation" ? "petty-cash-allocation" : "petty-cash-reimbursement";
      const label = type === "allocation" ? "Petty cash allocation" : "Petty cash reimbursement";
      await writeLedgerEntry({
        bankAccountId,
        amount: -amt,
        date,
        type: ledgerType,
        source: "pettyCashTransactions",
        sourceId: docRef.id,
        description: `${label}${description ? `: ${description}` : ""}`,
        createdBy: auth.email,
      });
    }

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "petty-cash",
      entityId: docRef.id,
      entityName: `Petty cash ${type}${description ? `: ${description}` : ""}`,
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

    const docRef = adminDb.collection("pettyCashTransactions").doc(id);
    const snap = await docRef.get();
    const data = snap.exists ? snap.data() : null;
    const type = data?.type;
    const description = data?.description || "";

    if (type === "allocation" || type === "reimbursement") {
      await reverseLedgerBySource("pettyCashTransactions", id);
    }
    await docRef.delete();

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "petty-cash",
      entityId: id,
      entityName: `Petty cash ${type || ""}${description ? `: ${description}` : ""}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
