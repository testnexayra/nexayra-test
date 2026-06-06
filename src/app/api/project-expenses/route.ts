import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireAccountsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { writeLedgerEntry, reverseLedgerBySource } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

type PEItem = {
  description: string;
  categoryId: string;
  qty: number;
  unit: string;
  amount: number;
};

// Convert flat (old) rows or items-array (new) rows into a consistent shape
function normalizeExpense(id: string, data: any) {
  const dateISO = data.date?.toDate?.()?.toISOString() || data.date;

  if (Array.isArray(data.items) && data.items.length > 0) {
    const items: PEItem[] = data.items.map((it: any) => ({
      description: String(it.description || ""),
      categoryId: String(it.categoryId || ""),
      qty: Number(it.qty) || 1,
      unit: String(it.unit || ""),
      amount: Number(it.amount) || 0,
    }));
    const totalAmount =
      Number(data.totalAmount) ||
      items.reduce((s, it) => s + it.amount * (it.qty || 1), 0);
    return { id, ...data, items, totalAmount, date: dateISO };
  }

  // Old flat shape -> wrap into one item
  const flatAmt = Number(data.amount) || 0;
  const items: PEItem[] = [{
    description: String(data.description || ""),
    categoryId: String(data.categoryId || ""),
    qty: 1,
    unit: "",
    amount: flatAmt,
  }];
  return { id, ...data, items, totalAmount: flatAmt, date: dateISO };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const snap = await adminDb.collection("projectExpenses").get();
    let expenses = snap.docs.map((d) => normalizeExpense(d.id, d.data()));
    if (projectId) expenses = expenses.filter((e: any) => e.projectId === projectId);
    expenses.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    return NextResponse.json({ ok: true, expenses });
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
      projectId, date, bankAccountId, vendor, paidBy, paymentMode, paymentModeCustom,
      billData, billName, billType, expenseType,
      items: rawItems,
      // Legacy fallback fields
      description, amount, categoryId,
    } = body;

    if (!projectId || !date || !bankAccountId) {
      return NextResponse.json(
        { ok: false, message: "projectId, date, bankAccountId required" },
        { status: 400 }
      );
    }

    // Build items array (new shape) or fall back to legacy single-item
    let items: PEItem[];
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      items = rawItems.map((it: any) => ({
        description: String(it.description || ""),
        categoryId: String(it.categoryId || ""),
        qty: Number(it.qty) || 1,
        unit: String(it.unit || ""),
        amount: Number(it.amount) || 0,
      }));
    } else {
      items = [{
        description: description || "",
        categoryId: categoryId || "",
        qty: 1,
        unit: "",
        amount: Number(amount) || 0,
      }];
    }

    if (items.every((it) => !it.amount)) {
      return NextResponse.json(
        { ok: false, message: "At least one item with an amount is required" },
        { status: 400 }
      );
    }

    const totalAmount = items.reduce((s, it) => s + it.amount * (it.qty || 1), 0);

    const docRef = await adminDb.collection("projectExpenses").add({
      projectId,
      date: Timestamp.fromDate(new Date(date)),
      items,
      totalAmount,
      bankAccountId,
      vendor: vendor || "",
      paidBy: paidBy || "",
      paymentMode: paymentMode || "",
      paymentModeCustom: paymentModeCustom || "",
      billData: billData || "",
      billName: billName || "",
      billType: billType || "",
      expenseType: expenseType || "material",
      createdBy: auth.email || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    const descSummary =
      items.length === 1
        ? items[0].description
        : `${items[0].description} +${items.length - 1} more`;

    await writeLedgerEntry({
      bankAccountId,
      amount: -totalAmount,
      date,
      type: "project-expense",
      source: "projectExpenses",
      sourceId: docRef.id,
      description: `Project expense: ${descSummary}`,
      createdBy: auth.email,
    });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "project-expense",
      entityId: docRef.id,
      entityName: `Project expense: ${descSummary}`,
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
      return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
    }

    const docRef = adminDb.collection("projectExpenses").doc(id);
    const expenseSnap = await docRef.get();
    const pe = expenseSnap.exists ? expenseSnap.data() : null;

    let descSummary = id;
    if (pe) {
      if (Array.isArray(pe.items) && pe.items.length > 0) {
        descSummary =
          pe.items.length === 1
            ? pe.items[0].description
            : `${pe.items[0].description} +${pe.items.length - 1} more`;
      } else {
        descSummary = pe.description || id;
      }
    }

    await reverseLedgerBySource("projectExpenses", id);
    await docRef.delete();

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "project-expense",
      entityId: id,
      entityName: `Project expense: ${descSummary}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}