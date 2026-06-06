import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/audit";
import { integrations } from "@/lib/integrations";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { projectId } = await req.json();
    if (!projectId) return NextResponse.json({ ok: false, message: "projectId required" }, { status: 400 });

    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists) return NextResponse.json({ ok: false, message: "Project not found" }, { status: 404 });
    const project: any = { id: projectSnap.id, ...projectSnap.data() };

    if (!integrations.gemini.enabled || !integrations.gemini.apiKey) {
      // Fallback when Gemini is off — generate template-based drafts
      return NextResponse.json({ ok: true, drafts: fallbackDrafts(project) });
    }

    const drafts = await callGemini(project);

    // Save AI drafts to marketingPosts
    const batch = adminDb.batch();
    drafts.forEach((d) => {
      const ref = adminDb.collection("marketingPosts").doc();
      batch.set(ref, {
        title: d.title,
        caption: d.caption,
        platform: d.platform,
        hashtags: d.hashtags || [],
        stage: "draft",
        source: "ai",
        projectId,
        mediaUrl: null,
        createdBy: auth.uid,
        createdByEmail: auth.email,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    await logAudit({
      userId: auth.uid,
      userEmail: auth.email,
      action: "create",
      entityType: "ai-marketing-drafts",
      entityId: projectId,
      entityName: `${drafts.length} drafts for ${project.name}`,
    });

    return NextResponse.json({ ok: true, drafts });
  } catch (err: any) {
    console.error("AI post generation failed:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

function fallbackDrafts(project: any) {
  return [
    {
      title: `LinkedIn — ${project.name}`,
      platform: "linkedin",
      caption: `Proud to share another milestone delivered by Nexayra Arc — ${project.name}${project.location ? ` in ${project.location}` : ""}.\n\nOur team continues to set the bar for MEP and HVAC excellence across the UAE.\n\n#NexayraArc #MEPContractor #UAEConstruction`,
      hashtags: ["NexayraArc", "MEPContractor", "UAEConstruction", "ConstructionExcellence"],
    },
    {
      title: `Instagram — ${project.name}`,
      platform: "instagram",
      caption: `Another one in the books. ✨\n\n${project.name}${project.location ? ` · ${project.location}` : ""}\n\n#NexayraArc #MEP #DubaiBuilds`,
      hashtags: ["NexayraArc", "MEP", "DubaiBuilds", "ConstructionLife"],
    },
    {
      title: `TikTok script — ${project.name}`,
      platform: "tiktok",
      caption: `[15-sec script]\n\n0–3s: Drone shot — empty site\n3–7s: Crew in action, fast cuts\n7–12s: Final reveal — completed installation\n12–15s: Logo + "Built by Nexayra Arc"\n\nSong: upbeat, motivational`,
      hashtags: ["NexayraArc", "ConstructionTok", "MEP"],
    },
  ];
}

async function callGemini(project: any) {
  const genAI = new GoogleGenerativeAI(integrations.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: integrations.gemini.model });

  const prompt = `You are a marketing copywriter for Nexayra Arc General Contracting L.L.C., a UAE-based MEP and HVAC contractor. Generate three marketing posts based on this completed project.

Project details:
- Name: ${project.name}
- Code: ${project.code || "N/A"}
- Location: ${project.location || "UAE"}
- Client: ${project.client || "Confidential"}
- Scope: ${project.scope || "MEP and HVAC works"}
- Contract value: ${project.contractValue ? `AED ${project.contractValue}` : "N/A"}

Return ONLY a JSON array (no markdown, no code fences) of exactly 3 objects with this shape:
[
  {
    "title": "string — short label for the draft",
    "platform": "linkedin" | "instagram" | "tiktok",
    "caption": "string — full post text",
    "hashtags": ["string", "string"]
  }
]

Requirements:
- Post 1: LinkedIn — professional, technical, highlight engineering challenges, 2-3 short paragraphs, end with relevant hashtags
- Post 2: Instagram — punchy, visual, max 280 characters before hashtags, use emojis sparingly
- Post 3: TikTok/Reel script — 15-second video script with timestamps, NOT a caption

All posts should reference Nexayra Arc and the UAE construction sector tastefully.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Expected array");
    return parsed;
  } catch (err) {
    console.error("Gemini returned non-JSON:", text);
    return fallbackDrafts(project);
  }
}