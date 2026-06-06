import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireAccountsWrite } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const snap = await adminDb.collection("bankAccounts").get();
    const accounts = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const txSnap = await adminDb.collection("bankTransactions").where("bankAccountId", "==", d.id).get();
      const txSum = txSnap.docs.reduce((s, t) => s + (t.data().amount || 0), 0);
      const currentBalance = (data.openingBalance || 0) + txSum;
      return {
        id: d.id,
        name: data.name,
        openingBalance: data.openingBalance || 0,
        currentBalance,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    }));
    // Sort in memory by createdAt ascending
    accounts.sort((a: any, b: any) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    return NextResponse.json({ ok: true, accounts });
  } catch (err: any) {
    console.error("bank-accounts GET error:", err);
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
    const docRef = await adminDb.collection("bankAccounts").add({
      name: body.name.trim(),
      openingBalance: Number(body.openingBalance || 0),
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });
      await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "bank-account",
      entityId: docRef.id,
      entityName: `Bank Account: ${body.name.trim()}`,
    });
    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err: any) {
    console.error("bank-accounts POST error:", err);
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
    if (updates.openingBalance !== undefined) updates.openingBalance = Number(updates.openingBalance);
    await adminDb.collection("bankAccounts").doc(id).set({ ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "bank-account",
      entityId: id,
      entityName: `Bank Account: ${updates.name || ""}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("bank-accounts PUT error:", err);
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

    const docRef = adminDb.collection("bankAccounts").doc(id);

    // Get bank account details before deleting for audit log
    const bankSnap = await docRef.get();
    const bankData = bankSnap.exists ? bankSnap.data() : null;

    // Safety: prevent delete if transactions reference this bank account
    const txSnap = await adminDb
      .collection("bankTransactions")
      .where("bankAccountId", "==", id)
      .limit(1)
      .get();

    if (!txSnap.empty) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Cannot delete: this bank account has transactions. Remove all expenses, collections, and partner transactions linked to it first.",
        },
        { status: 400 }
      );
    }

    await docRef.delete();

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "bank-account",
      entityId: id,
      entityName: `Bank Account: ${bankData?.name || id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("bank-accounts DELETE error:", err);
    return NextResponse.json(
      { ok: false, message: err.message },
      { status: 500 }
    );
  }
}