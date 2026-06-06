import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const snap = await adminDb.collection("brandAssets").doc(params.id).get();
    if (!snap.exists) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    const data = snap.data() as any;
    return NextResponse.json({ ok: true, asset: { id: snap.id, ...data, uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || null } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}