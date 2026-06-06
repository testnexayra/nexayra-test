import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const STAGES = ["raw", "draft", "scheduled", "published"] as const;
const PLATFORMS = ["linkedin", "instagram", "facebook", "tiktok"] as const;

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const snap = await adminDb.collection("marketingPosts").orderBy("createdAt", "desc").limit(200).get();
    const posts = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        scheduledFor: data.scheduledFor?.toDate?.()?.toISOString() || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });
    return NextResponse.json({ ok: true, posts });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { title, caption, platform, stage, source, projectId, mediaUrl, hashtags, scheduledFor } = body;

    if (!String(title || "").trim()) return NextResponse.json({ ok: false, message: "Title is required." }, { status: 400 });

    const cleanStage = STAGES.includes(stage) ? stage : "raw";
    const cleanPlatform = PLATFORMS.includes(platform) ? platform : "linkedin";

    const ref = await adminDb.collection("marketingPosts").add({
      title: String(title).trim(),
      caption: caption || "",
      platform: cleanPlatform,
      stage: cleanStage,
      source: source || "manual",      // 'site', 'ai', 'studio', 'manual'
      projectId: projectId || null,
      mediaUrl: mediaUrl || null,
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      publishedAt: null,
      createdBy: auth.uid,
      createdByEmail: auth.email,
      createdAt: FieldValue.serverTimestamp(),
    });

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "marketing-post",
      entityId: ref.id,
      entityName: title,
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, message: "id is required." }, { status: 400 });

    const docRef = adminDb.collection("marketingPosts").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, message: "Post not found." }, { status: 404 });

    const cleanUpdates: any = {};
    if (updates.title !== undefined) cleanUpdates.title = String(updates.title).trim();
    if (updates.caption !== undefined) cleanUpdates.caption = updates.caption;
    if (updates.platform !== undefined && PLATFORMS.includes(updates.platform)) cleanUpdates.platform = updates.platform;
    if (updates.stage !== undefined && STAGES.includes(updates.stage)) {
      cleanUpdates.stage = updates.stage;
      if (updates.stage === "published") cleanUpdates.publishedAt = FieldValue.serverTimestamp();
    }
    if (updates.scheduledFor !== undefined) cleanUpdates.scheduledFor = updates.scheduledFor ? new Date(updates.scheduledFor) : null;
    if (updates.hashtags !== undefined) cleanUpdates.hashtags = Array.isArray(updates.hashtags) ? updates.hashtags : [];
    if (updates.mediaUrl !== undefined) cleanUpdates.mediaUrl = updates.mediaUrl;

    cleanUpdates.updatedAt = FieldValue.serverTimestamp();
    cleanUpdates.updatedBy = auth.uid;

    await docRef.update(cleanUpdates);
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "update",
      entityType: "marketing-post",
      entityId: id,
      entityName: snap.data()?.title || id,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  if (!["admin", "marketing"].includes(auth.role)) return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id is required." }, { status: 400 });

    const docRef = adminDb.collection("marketingPosts").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, message: "Post not found." }, { status: 404 });

    const name = snap.data()?.title || id;
    await docRef.delete();
    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "delete",
      entityType: "marketing-post",
      entityId: id,
      entityName: name,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}