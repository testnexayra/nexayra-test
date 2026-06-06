import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return authResult.error;

    if (authResult.role !== "admin") {
      return NextResponse.json({ ok: false, message: "Forbidden — admin only." }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

    const snap = await adminDb
      .collection("auditLogs")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const logs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userEmail: data.userEmail || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        entityName: data.entityName || null,
        details: data.details || null,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ ok: true, logs });
  } catch (err: any) {
    console.error("Audit logs GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}