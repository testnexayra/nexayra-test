import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

// GET ?field=vendorName&q=m&module=lpo
// GET ?lookup=vendor&name=ABC+Trading (returns associated details)
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const field = url.searchParams.get("field");
    const q = (url.searchParams.get("q") || "").toLowerCase().trim();
    const moduleName = url.searchParams.get("module") || "";
    const lookup = url.searchParams.get("lookup");
    const name = url.searchParams.get("name");

    // LOOKUP MODE: given a vendor/client name, return their most-recent associated details
    if (lookup === "vendor" && name) {
      const snap = await adminDb.collection("lpos").where("vendorName", "==", name).limit(1).get();
      if (!snap.empty) {
        const d = snap.docs[0].data();
        return NextResponse.json({ ok: true, details: {
          vendorAddress: d.vendorAddress || "",
          vendorPhone: d.vendorPhone || "",
          vendorTRN: d.vendorTRN || "",
        }});
      }
      return NextResponse.json({ ok: true, details: null });
    }
    if (lookup === "client" && name) {
      // Try tax invoice first, then LPO
      const tSnap = await adminDb.collection("taxInvoices").where("clientName", "==", name).limit(1).get();
      if (!tSnap.empty) {
        const d = tSnap.docs[0].data();
        return NextResponse.json({ ok: true, details: {
          clientAddress: d.clientAddress || "",
          clientPhone: d.clientPhone || "",
          clientTRN: d.clientTRN || "",
        }});
      }
      return NextResponse.json({ ok: true, details: null });
    }

    if (!field) return NextResponse.json({ ok: false, message: "field required" }, { status: 400 });

    // SUGGESTIONS MODE: return distinct values for a field matching prefix q
    const values = new Set<string>();

    const collectFrom = async (coll: string, fieldPath: string) => {
      const snap = await adminDb.collection(coll).get();
      snap.docs.forEach(d => {
        const v = d.data()?.[fieldPath];
        if (typeof v === "string" && v.trim() && v.toLowerCase().includes(q)) values.add(v.trim());
      });
    };

    // Field → collections to search
    const map: Record<string, Array<{coll: string; path: string}>> = {
      vendorName: [{coll: "lpos", path: "vendorName"}],
      vendorAddress: [{coll: "lpos", path: "vendorAddress"}],
      vendorPhone: [{coll: "lpos", path: "vendorPhone"}],
      vendorTRN: [{coll: "lpos", path: "vendorTRN"}],
      clientName: [
        {coll: "lpos", path: "clientName"},
        {coll: "taxInvoices", path: "clientName"},
        {coll: "invoices", path: "clientName"},
      ],
      clientAddress: [{coll: "taxInvoices", path: "clientAddress"}],
      clientPhone: [{coll: "taxInvoices", path: "clientPhone"}, {coll: "lpos", path: "clientPhone"}],
      clientTRN: [{coll: "taxInvoices", path: "clientTRN"}],
      project: [
        {coll: "lpos", path: "project"},
        {coll: "quotations", path: "project"},
        {coll: "taxInvoices", path: "project"},
      ],
      contact: [{coll: "lpos", path: "contact"}],
      to: [{coll: "quotations", path: "to"}],
      attn: [{coll: "quotations", path: "attn"}],
      receivedFrom: [{coll: "receiverCopies", path: "receivedFrom"}],
      companyName: [{coll: "receiverCopies", path: "companyName"}],
      vendor: [
        {coll: "expenses", path: "vendor"},
        {coll: "projectExpenses", path: "vendor"},
      ],
      paidBy: [
        {coll: "expenses", path: "paidBy"},
        {coll: "projectExpenses", path: "paidBy"},
      ],
      description: [
        {coll: "expenses", path: "description"},
        {coll: "projectExpenses", path: "description"},
      ],
    };

    const sources = map[field] || [];
    for (const s of sources) await collectFrom(s.coll, s.path);

    const results = Array.from(values).slice(0, 10);
    return NextResponse.json({ ok: true, suggestions: results });
  } catch (err: any) {
    console.error("suggestions error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}