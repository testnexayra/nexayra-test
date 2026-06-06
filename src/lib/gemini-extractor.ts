import { integrations } from "./integrations";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type ExtractedDocumentData = {
  documentType?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  holderName?: string;
  rawText?: string;
  confidence?: "high" | "medium" | "low";
};

export async function extractDocumentData(params: {
  base64Data: string;
  mimeType: string;
  hint?: "trade-license" | "emirates-id" | "passport" | "vat-cert" | "chamber-cert" | "mulkiya" | "insurance" | "generic";
}): Promise<ExtractedDocumentData> {
  if (!integrations.gemini.enabled) {
    return {};
  }

  if (!integrations.gemini.apiKey) {
    console.warn("Gemini enabled but GEMINI_API_KEY missing");
    return {};
  }

  try {
    return await callGemini(params);
  } catch (err: any) {
    console.error("Gemini extraction failed:", err.message || err);
    return {};
  }
}

async function callGemini(params: {
  base64Data: string;
  mimeType: string;
  hint?: string;
}): Promise<ExtractedDocumentData> {
  const genAI = new GoogleGenerativeAI(integrations.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: integrations.gemini.model });

  const docTypeHint =
    params.hint && params.hint !== "generic"
      ? `This is a ${params.hint.replace(/-/g, " ")}.`
      : "Identify the document type.";

  const prompt = `${docTypeHint} Extract the following fields and return ONLY a JSON object (no markdown, no explanation, no code fences):
{
  "documentType": "...",
  "documentNumber": "...",
  "issueDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "issuingAuthority": "...",
  "holderName": "...",
  "confidence": "high|medium|low"
}

For UAE documents:
- Trade License: extract license number, issue date, expiry date, issuing authority (DED/Sharjah Economic Dept/etc), trade name as holderName
- Emirates ID: extract ID number (15 digits), name, expiry date
- Passport: extract passport number, full name, expiry date, issuing country as issuingAuthority
- VAT Certificate: extract TRN as documentNumber, registered name as holderName, registration date as issueDate
- Chamber of Commerce: extract membership number, member name, issue and expiry dates
- Mulkiya: extract plate number as documentNumber, owner name as holderName, expiry date
- Insurance: extract policy number as documentNumber, insured party as holderName, expiry date

Use null for any field you cannot reliably extract. Date format must be strictly YYYY-MM-DD.`;

  const result = await model.generateContent([
    {
      inlineData: {
        data: params.base64Data,
        mimeType: params.mimeType,
      },
    },
    { text: prompt },
  ]);

  const text = result.response.text().trim();
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      documentType: parsed.documentType || undefined,
      documentNumber: parsed.documentNumber || undefined,
      issueDate: parsed.issueDate || undefined,
      expiryDate: parsed.expiryDate || undefined,
      issuingAuthority: parsed.issuingAuthority || undefined,
      holderName: parsed.holderName || undefined,
      confidence: parsed.confidence || "medium",
    };
  } catch (err) {
    console.error("Gemini returned non-JSON response:", text);
    return {};
  }
}