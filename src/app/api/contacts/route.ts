import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TYPES = ["subcontractor", "supplier", "consultant", "engineer", "labour", "client", "other"] as const;

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;

    const snap = await adminDb.collection("contacts").orderBy("createdAt", "desc").get();
    const contacts = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id, ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });
    return NextResponse.json({ ok: true, contacts });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (!["admin", "accounts", "procurement", "estimation", "hr"].includes(auth.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
    }

    const body = await req.json();
    const { name, type, company, role, phone, email, emirate, address, rating, remarks, tags } = body;

   if (!name || !String(name).trim()) {
  return NextResponse.json({ ok: false, message: "Name is required." }, { status: 400 });
}
if (!type || !String(type).trim()) {
  return NextResponse.json({ ok: false, message: "Type is required." }, { status: 400 });
}
const cleanType = String(type).trim();
if (!TYPES.includes(cleanType as any)) {
  return NextResponse.json({ ok: false, message: `Type must be one of: ${TYPES.join(", ")}` }, { status: 400 });
}

    const ref = await adminDb.collection("contacts").add({
      type: cleanType,
      name, company: company || null, role: role || null,
      phone: phone || null, email: email || null,
      emirate: emirate || null, address: address || null,
      rating: rating !== undefined ? Number(rating) : null,
      remarks: remarks || null,
      tags: Array.isArray(tags) ? tags : [],
      createdBy: auth.uid, createdByEmail: auth.email,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logAudit({ userId: auth.uid, userEmail: auth.email, action: "create", entityType: "contact", entityId: ref.id, entityName: `${name} (${type})` });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (!["admin", "accounts", "procurement", "estimation", "hr"].includes(auth.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, message: "Missing id." }, { status: 400 });

    const allowed = ["name", "type", "company", "role", "phone", "email", "emirate", "address", "rating", "remarks", "tags"];
    const safe: any = { updatedAt: FieldValue.serverTimestamp() };
    for (const k of allowed) if (k in updates) safe[k] = updates[k];

    await adminDb.collection("contacts").doc(id).set(safe, { merge: true });
    await logAudit({ userId: auth.uid, userEmail: auth.email, action: "update", entityType: "contact", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "Missing id." }, { status: 400 });

    const snap = await adminDb.collection("contacts").doc(id).get();
    const name = snap.exists ? (snap.data() as any).name : id;
    await adminDb.collection("contacts").doc(id).delete();
    await logAudit({ userId: auth.uid, userEmail: auth.email, action: "delete", entityType: "contact", entityId: id, entityName: name });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}