import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const bankAccountId = url.searchParams.get("bankAccountId");
    const limit = Number(url.searchParams.get("limit") || 200);

    // Fetch all, sort in memory — avoids composite index requirement
    const snap = await adminDb.collection("bankTransactions").get();
    let transactions = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        date: data.date?.toDate?.()?.toISOString() || data.date,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    if (bankAccountId) transactions = transactions.filter((t: any) => t.bankAccountId === bankAccountId);
    transactions.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    transactions = transactions.slice(0, limit);
    return NextResponse.json({ ok: true, transactions });
  } catch (err: any) {
    console.error("bank-transactions GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}