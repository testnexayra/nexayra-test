import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, message: "GEMINI_API_KEY not configured in .env.local" }, { status: 500 });

    const body = await req.json();
    const { billData, billType } = body;
    if (!billData) return NextResponse.json({ ok: false, message: "billData required" }, { status: 400 });

    // billData is a data URL like "data:image/jpeg;base64,...."
    const match = /^data:([^;]+);base64,(.+)$/.exec(billData);
    if (!match) return NextResponse.json({ ok: false, message: "Invalid billData format" }, { status: 400 });
    const mimeType = match[1];
    const base64 = match[2];

    const prompt = `You are a receipt/bill data extractor. Extract ONLY the following fields from the bill image as JSON:
{
  "vendor": "vendor/merchant/company name exactly as printed",
  "amount": "TOTAL amount as a number string e.g. '123.45' (total incl. VAT if VAT is shown)",
  "date": "date on the bill in YYYY-MM-DD format",
  "description": "brief description of items/services purchased (max 10 words) — summary of all items",
  "currency": "currency code e.g. AED, USD, EUR",
  "items": [
    {
      "description": "line item description as printed",
      "qty": 1,
      "unit": "unit of measure e.g. pcs, kg, m, hr — empty string if not specified",
      "amount": 100.50
    }
  ]
}
Rules:
- If a field is not clearly visible in the bill, use empty string "" (or empty array for items).
- For the items array: include EVERY line item visible on the bill. qty defaults to 1 if not shown, unit defaults to "" if not shown.
- The "amount" per item should be the line total (qty × unit price). If only unit price is shown, multiply by qty.
- If the bill only shows a single total with no line breakdown, return a single item with description = the summary and amount = the total.
- Do NOT include tax/VAT, subtotal, discount, or grand total rows inside items — those belong only in the top-level "amount" field.
- Do NOT invent or infer information not on the bill.
- Return ONLY valid JSON, no markdown, no code fences, no explanation.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return NextResponse.json({ ok: false, message: `Gemini API error (${response.status}). ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed: any = {};
    try {
      parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
    } catch {
      return NextResponse.json({ ok: false, message: "AI returned unparseable output.", raw: text }, { status: 500 });
    }

    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = rawItems
      .map((it: any) => ({
        description: String(it?.description || "").trim(),
        qty: Number(it?.qty) > 0 ? Number(it.qty) : 1,
        unit: String(it?.unit || "").trim(),
        amount: Number(it?.amount) || 0,
      }))
      .filter((it: { description: string; amount: number }) => it.description || it.amount > 0);

    return NextResponse.json({
      ok: true,
      extracted: {
        vendor: parsed.vendor || "",
        amount: parsed.amount || "",
        date: parsed.date || "",
        description: parsed.description || "",
        currency: parsed.currency || "",
        items,
      },
    });
  } catch (err: any) {
    console.error("ai-scan-bill error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}