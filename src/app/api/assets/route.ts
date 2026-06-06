import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;

    const snap = await adminDb.collection("assets").orderBy("createdAt", "desc").get();
    const assets = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id, ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        lastScannedAt: data.lastScannedAt?.toDate?.()?.toISOString() || null,
      };
    });
    return NextResponse.json({ ok: true, assets });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (!["admin", "accounts", "logistics"].includes(auth.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
    }

    const body = await req.json();
    const { name, category, serialNumber, purchaseDate, purchaseValue, currentValue, condition, currentLocation, currentProjectId, assignedTo, notes } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ ok: false, message: "Name is required." }, { status: 400 });
    }
    if (!category || !String(category).trim()) {
      return NextResponse.json({ ok: false, message: "Category is required." }, { status: 400 });
    }

    const cleanName = String(name).trim();
    const cleanCategory = String(category).trim();

    const ref = await adminDb.collection("assets").add({
      name: cleanName,
      category: cleanCategory,
      serialNumber: serialNumber || null,
      purchaseDate: purchaseDate || null,
      purchaseValue: purchaseValue !== undefined ? Number(purchaseValue) : 0,
      currentValue: currentValue !== undefined ? Number(currentValue) : Number(purchaseValue) || 0,
      condition: condition || "Good",
      currentLocation: currentLocation || "Office",
      currentProjectId: currentProjectId || null,
      assignedTo: assignedTo || null,
      notes: notes || null,
      createdBy: auth.uid,
      createdByEmail: auth.email,
      createdAt: FieldValue.serverTimestamp(),
      lastScannedAt: FieldValue.serverTimestamp(),
    });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "asset",
      entityId: ref.id,
      entityName: cleanName,
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (!["admin", "accounts", "logistics"].includes(auth.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
    }

    const { id, scanLocation, ...updates } = await req.json();
    if (!id) return NextResponse.json({ ok: false, message: "Missing id." }, { status: 400 });

    const allowed = ["name", "category", "serialNumber", "purchaseDate", "purchaseValue", "currentValue", "condition", "currentLocation", "currentProjectId", "assignedTo", "notes"];
    const safe: any = {};
    for (const k of allowed) if (k in updates) safe[k] = updates[k];

    // "Scan" action: just update location + timestamp
    if (scanLocation) {
      safe.currentLocation = scanLocation;
      safe.lastScannedAt = FieldValue.serverTimestamp();
    }

    await adminDb.collection("assets").doc(id).set(safe, { merge: true });
    await logAudit({
      userId: auth.uid, userEmail: auth.email,
      action: scanLocation ? "update" : "update",
      entityType: "asset", entityId: id,
      details: scanLocation ? `Scanned to: ${scanLocation}` : `Fields: ${Object.keys(safe).join(", ")}`,
    });
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

    const snap = await adminDb.collection("assets").doc(id).get();
    const name = snap.exists ? (snap.data() as any).name : id;
    await adminDb.collection("assets").doc(id).delete();
    await logAudit({ userId: auth.uid, userEmail: auth.email, action: "delete", entityType: "asset", entityId: id, entityName: name });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}