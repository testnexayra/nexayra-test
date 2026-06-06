import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";
import { getUserRole, type UserRole } from "./roles";

type AuthResult =
  | { error: NextResponse }
  | { uid: string; email: string | undefined; role: UserRole };

export async function verifyAuth(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return { error: NextResponse.json({ ok: false, message: "No auth token provided." }, { status: 401 }) };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    let role: UserRole = "viewer";
    try {
      role = await getUserRole(decoded.uid);
    } catch {}
    return { uid: decoded.uid, email: decoded.email, role };
  } catch (err: any) {
    const msg = err?.message || "Invalid or expired token.";
    console.error("verifyAuth error:", msg);
    const status = msg.includes("not initialized") ? 503 : 401;
    return { error: NextResponse.json({ ok: false, message: msg }, { status }) };
  }
}

export function requireAccountsWrite(auth: { role: UserRole }) {
  if (auth.role !== "admin" && auth.role !== "accounts") {
    return NextResponse.json({ ok: false, message: "Forbidden: accounts access required." }, { status: 403 });
  }
  return null;
}

export function requireProcurementWrite(auth: { role: UserRole }) {
  if (auth.role !== "admin" && auth.role !== "procurement" && auth.role !== "procurement-approver") {
    return NextResponse.json({ ok: false, message: "Forbidden: procurement access required." }, { status: 403 });
  }
  return null;
}

export function requireLpoApprover(auth: { role: UserRole }) {
  if (auth.role !== "procurement-approver") {
    return NextResponse.json({ ok: false, message: "Forbidden: LPO approver access required." }, { status: 403 });
  }
  return null;
}

export function requireEstimationWrite(auth: { role: UserRole }) {
  if (auth.role !== "admin" && auth.role !== "estimation") {
    return NextResponse.json({ ok: false, message: "Forbidden: estimation access required." }, { status: 403 });
  }
  return null;
}

export function requireLogisticsWrite(auth: { role: UserRole }) {
  if (auth.role !== "admin" && auth.role !== "logistics") {
    return NextResponse.json({ ok: false, message: "Forbidden: logistics access required." }, { status: 403 });
  }
  return null;
}

export function requireHRWrite(auth: { role: UserRole }) {
  if (auth.role !== "admin" && auth.role !== "hr") {
    return NextResponse.json({ ok: false, message: "Forbidden: HR access required." }, { status: 403 });
  }
  return null;
}

export function requireProjectsWrite(auth: { role: UserRole }) {
  if (auth.role !== "admin" && auth.role !== "project-manager") {
    return NextResponse.json({ ok: false, message: "Forbidden: project manager access required." }, { status: 403 });
  }
  return null;
}

export function requireProgressUpdate(auth: { role: UserRole }) {
  if (auth.role !== "admin" && auth.role !== "project-manager" && auth.role !== "engineer") {
    return NextResponse.json({ ok: false, message: "Forbidden: cannot update project progress." }, { status: 403 });
  }
  return null;
}

export function checkFirebaseInit() {
  return null;
}
