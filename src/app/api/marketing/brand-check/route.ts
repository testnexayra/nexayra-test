import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { integrations } from "@/lib/integrations";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const BRAND_HEX = ["#192A56", "#C6A35E", "#718096"];
const APPROVED_HASHTAGS = ["NexayraArc", "MEPContractor", "UAEConstruction", "DubaiBuilds"];

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { caption, hashtags, base64Image, mimeType } = await req.json();

    const checks: { rule: string; pass: boolean; severity: "info" | "warn" | "fail" }[] = [];

    // Text rules
    checks.push({
      rule: "Mentions 'Nexayra' brand name",
      pass: /nexayra/i.test(caption || ""),
      severity: "warn",
    });

    const tagsArr: string[] = Array.isArray(hashtags) ? hashtags : [];
    const hasApproved = tagsArr.some((t) => APPROVED_HASHTAGS.some((a) => a.toLowerCase() === String(t).replace(/^#/, "").toLowerCase()));
    checks.push({
      rule: "Includes at least one approved brand hashtag",
      pass: hasApproved,
      severity: "warn",
    });

    checks.push({
      rule: "Caption is between 30 and 2,200 characters",
      pass: (caption?.length || 0) >= 30 && (caption?.length || 0) <= 2200,
      severity: "info",
    });

    // Image color audit (if image provided + Gemini enabled)
    if (base64Image && mimeType && integrations.gemini.enabled && integrations.gemini.apiKey) {
      try {
        const colorCheck = await checkBrandColors(base64Image, mimeType);
        checks.push({
          rule: `Image uses Nexayra brand colors (${BRAND_HEX.join(", ")})`,
          pass: colorCheck.usesBrandColors,
          severity: colorCheck.usesBrandColors ? "info" : "fail",
        });
      } catch (err) {
        // Skip silently if AI check fails
      }
    }

    const failures = checks.filter((c) => !c.pass && c.severity === "fail").length;
    const warnings = checks.filter((c) => !c.pass && c.severity === "warn").length;

    return NextResponse.json({
      ok: true,
      checks,
      summary: { failures, warnings, total: checks.length },
      blocked: failures > 0,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

async function checkBrandColors(base64Image: string, mimeType: string): Promise<{ usesBrandColors: boolean; reason: string }> {
  const genAI = new GoogleGenerativeAI(integrations.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: integrations.gemini.model });

  const prompt = `Analyze this image and answer: does it use any of these brand colors prominently?
- Navy blue (#192A56)
- Gold (#C6A35E)
- Slate grey (#718096)

Return ONLY a JSON object: { "usesBrandColors": true/false, "reason": "short reason" }`;

  const result = await model.generateContent([
    { inlineData: { data: base64Image, mimeType } },
    { text: prompt },
  ]);
  const text = result.response.text().trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(text);
}