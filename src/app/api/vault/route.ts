import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { uploadFile, deleteFile } from "@/lib/drive-uploader";
import { extractDocumentData } from "@/lib/gemini-extractor";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const VAULT_CATEGORIES = [
  "trade-license", "chamber-cert", "vat-cert", "moa", "ejari",
  "emirates-id", "passport", "visa", "mulkiya", "insurance", "other",
] as const;

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const snap = await adminDb.collection("vaultDocuments").orderBy("uploadedAt", "desc").get();
    const docs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || null,
        // never return base64 in list — only in single fetch
        base64: undefined,
      };
    });

    return NextResponse.json({ ok: true, documents: docs });
  } catch (err: any) {
    console.error("Vault GET error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const body = await req.json();
    const { fileName, mimeType, base64Data, category, label, holderName, manualExpiry, manualDocNumber } = body;

    if (!fileName || !mimeType || !base64Data || !category) {
      return NextResponse.json({ ok: false, message: "Missing required fields." }, { status: 400 });
    }
    if (!VAULT_CATEGORIES.includes(category)) {
      return NextResponse.json({ ok: false, message: `Invalid category. Allowed: ${VAULT_CATEGORIES.join(", ")}` }, { status: 400 });
    }

    // Upload (Drive or Firestore depending on flag)
    const uploaded = await uploadFile({
      fileName,
      mimeType,
      base64Data,
      folderType: "vault",
    });

    // Extract via Gemini (returns {} if disabled)
    const hint = (VAULT_CATEGORIES.includes(category) ? category : "generic") as any;
    const extracted = await extractDocumentData({ base64Data, mimeType, hint });

    // Resolve final fields — manual entries override AI
    const finalDocNumber = manualDocNumber || extracted.documentNumber || null;
    const finalExpiry = manualExpiry || extracted.expiryDate || null;
    const finalHolder = holderName || extracted.holderName || null;

    const docData: any = {
      category,
      label: label || extracted.documentType || fileName,
      fileName,
      mimeType,
      sizeBytes: uploaded.sizeBytes,
      storage: uploaded.storage,
      // Drive-specific fields
      driveFileId: uploaded.driveFileId || null,
      webViewLink: uploaded.webViewLink || null,
      // Firestore fallback
      base64: uploaded.storage === "firestore" ? uploaded.base64 : null,
      // Extracted data
      documentNumber: finalDocNumber,
      issueDate: extracted.issueDate || null,
      expiryDate: finalExpiry,
      issuingAuthority: extracted.issuingAuthority || null,
      holderName: finalHolder,
      extractedBy: extracted.expiryDate ? "gemini" : "manual",
      extractionConfidence: extracted.confidence || null,
      uploadedBy: auth.uid,
      uploadedByEmail: auth.email,
      uploadedAt: FieldValue.serverTimestamp(),
    };

    const ref = await adminDb.collection("vaultDocuments").add(docData);

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "vault-doc",
      entityId: ref.id,
      entityName: docData.label,
      details: `Category: ${category}${finalExpiry ? ` · Expires ${finalExpiry}` : ""}`,
    });

    return NextResponse.json({
      ok: true,
      id: ref.id,
      extracted: {
        documentType: extracted.documentType,
        documentNumber: extracted.documentNumber,
        expiryDate: extracted.expiryDate,
        confidence: extracted.confidence,
      },
    });
  } catch (err: any) {
    console.error("Vault POST error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "Missing id." }, { status: 400 });

    const docRef = adminDb.collection("vaultDocuments").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

    const data = snap.data() as any;

    if (data.storage === "drive" && data.driveFileId) {
      await deleteFile({ storage: "drive", driveFileId: data.driveFileId }).catch(() => {});
    }

    await docRef.delete();

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "vault-doc",
      entityId: id,
      entityName: data.label,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Vault DELETE error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if ("error" in auth) return auth.error;
    if (auth.role !== "admin") return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });

    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, message: "Missing id." }, { status: 400 });

    // Allow only certain fields to be updated manually
    const allowed = ["label", "documentNumber", "expiryDate", "issueDate", "issuingAuthority", "holderName"];
    const safeUpdates: any = {};
    for (const k of allowed) if (k in updates) safeUpdates[k] = updates[k];

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ ok: false, message: "No valid fields to update." }, { status: 400 });
    }

    await adminDb.collection("vaultDocuments").doc(id).set(safeUpdates, { merge: true });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "vault-doc",
      entityId: id,
      details: `Fields: ${Object.keys(safeUpdates).join(", ")}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Vault PATCH error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}