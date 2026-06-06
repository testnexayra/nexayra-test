import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type Result = { type: string; label: string; href: string };

const MODULE_SCOPE: Record<string, string[]> = {
  accounts:           ["expenses", "tax-invoice", "collections", "partners", "bank-accounts"],
  estimation:         ["quotations", "tax-invoice", "receiverCopies"],
  procurement:        ["lpos"],
  "company-overview": ["vaultDocuments", "brandAssets", "contacts", "assets", "auditLogs"],
  hr:                 ["employees"],
  logistics:          ["vehicles", "vehiclePossessions"],
  projects:           ["projects"],
  marketing:          [],   // placeholder until module is built
};

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const module = url.searchParams.get("module") || "";
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  const collectionsToSearch =
    module && MODULE_SCOPE[module] ? MODULE_SCOPE[module] : Object.values(MODULE_SCOPE).flat();

  const results: Result[] = [];
  const max = 30;

  // Search each relevant collection
  await Promise.all(
    collectionsToSearch.map(async (collName) => {
      try {
        const snap = await adminDb.collection(collName).limit(50).get();
        snap.docs.forEach((doc) => {
          if (results.length >= max) return;
          const data = doc.data();
          const haystack = JSON.stringify(data).toLowerCase();
          if (!haystack.includes(q)) return;

          // Build label & href per collection type
          const result = formatResult(collName, doc.id, data);
          if (result) results.push(result);
        });
      } catch (err) {
        console.error(`Search failed for ${collName}:`, err);
      }
    })
  );

  return NextResponse.json({ ok: true, results: results.slice(0, max) });
}

function formatResult(collection: string, id: string, data: any): Result | null {
  switch (collection) {
    case "expenses":         return { type: "Expense",       label: data.description || `Expense ${id}`,       href: "/dashboard/accounts/expenses" };
    case "tax-invoice":      return { type: "Tax Invoice",   label: data.documentNo || `Invoice ${id}`,        href: "/dashboard/accounts/tax-invoice" };
    case "collections":      return { type: "Collection",    label: `${data.amount || ""} from ${data.from || ""}`, href: "/dashboard/accounts/invoicing" };
    case "partners":         return { type: "Partner",       label: data.name || id,                            href: "/dashboard/accounts/partners" };
    case "bank-accounts":    return { type: "Bank Account",  label: data.name || id,                            href: "/dashboard/accounts" };
    case "quotations":       return { type: "Quotation",     label: data.documentNo || `Quotation ${id}`,       href: "/dashboard/estimation/quotation/history" };
    case "receiverCopies":   return { type: "Receiver Copy", label: data.documentNo || id,                      href: "/dashboard/estimation/receiver-copy/history" };
    case "lpos":             return { type: "LPO",           label: `LPO-${data.nxrNo || id} · ${data.vendorName || ""}`, href: "/dashboard/procurement/lpo/history" };
    case "vaultDocuments":   return { type: "Vault",         label: data.label || id,                           href: "/dashboard/company-overview/vault" };
    case "brandAssets":      return { type: "Brand",         label: data.label || id,                           href: "/dashboard/company-overview/brand" };
    case "contacts":         return { type: "Contact",       label: `${data.name} (${data.type})`,              href: "/dashboard/company-overview/contacts" };
    case "assets":           return { type: "Asset",         label: data.name || id,                            href: "/dashboard/company-overview/assets" };
    case "auditLogs":        return { type: "Audit",         label: `${data.userEmail} ${data.action} ${data.entityName || data.entityId}`, href: "/dashboard/company-overview/audit-log" };
    case "employees":        return { type: "Employee",      label: data.name || id,                            href: "/dashboard/hr/employees" };
    case "vehicles":         return { type: "Vehicle",       label: `${data.plateNumber} · ${data.make || ""} ${data.model || ""}`, href: "/dashboard/logistics/vehicles" };
    case "projects":         return { type: "Project",       label: `${data.code || ""} · ${data.name || id}`, href: `/dashboard/projects/${id}` };
    default: return null;
  }
}