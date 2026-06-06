import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, checkFirebaseInit } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fbCheck = checkFirebaseInit();
  if (fbCheck) return fbCheck;
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    return NextResponse.json({ ok: true, uid: auth.uid, email: auth.email, role: auth.role });
  } catch (err: any) {
    console.error("GET /api/me error:", err);
    return NextResponse.json({ ok: false, message: err.message || "Internal server error" }, { status: 500 });
  }
}
