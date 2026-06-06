import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { uploadFile, deleteFile } from "@/lib/drive-uploader";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const snap = await adminDb.collection("brandAssets").orderBy("uploadedAt", "desc").get();
    const assets = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || null, base64: undefined };
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
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const { fileName, mimeType, base64Data, category, label } = await req.json();
    if (!fileName || !mimeType || !base64Data || !category) {
      return NextResponse.json({ ok: false, message: "Missing required fields." }, { status: 400 });
    }

    const uploaded = await uploadFile({ fileName, mimeType, base64Data, folderType: "brand" });

    const ref = await adminDb.collection("brandAssets").add({
      category, label: label || fileName, fileName, mimeType,
      sizeBytes: uploaded.sizeBytes, storage: uploaded.storage,
      driveFileId: uploaded.driveFileId || null,
      webViewLink: uploaded.webViewLink || null,
      base64: uploaded.storage === "firestore" ? uploaded.base64 : null,
      uploadedBy: auth.uid, uploadedByEmail: auth.email,
      uploadedAt: FieldValue.serverTimestamp(),
    });

    await logAudit({ userId: auth.uid, userEmail: auth.email, action: "create", entityType: "brand-asset", entityId: ref.id, entityName: label || fileName });
    return NextResponse.json({ ok: true, id: ref.id });
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

    const docRef = adminDb.collection("brandAssets").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

    const data = snap.data() as any;
    if (data.storage === "drive" && data.driveFileId) {
      await deleteFile({ storage: "drive", driveFileId: data.driveFileId }).catch(() => {});
    }
    await docRef.delete();
    await logAudit({ userId: auth.uid, userEmail: auth.email, action: "delete", entityType: "brand-asset", entityId: id, entityName: data.label });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}