import type { QuotationData } from "@/components/quotation/QuotationDocument";

// Normalize a quotation into draft Project payload
export function quotationToProjectPayload(q: QuotationData) {
  // Generate a code suggestion from quotation number, e.g., QTN-NEX-1055 -> P-1055
  const num = String(q.quotationNo).match(/\d+/)?.[0] || Math.floor(Math.random() * 9000 + 1000);
  return {
    code: `P-${num}`,
    name: q.serviceTitle || q.project || `Project from ${q.quotationNo}`,
    client: q.to || "",
    scope: "",
    contractValue: Number(q.totalWithVat || 0),
    startDate: "",
    endDate: "",
    status: "active",
  };
}

// Normalize a quotation into a draft LPO payload
// Note: an LPO is a vendor purchase order, so the "client" field is filled with the quotation client.
// Items from the quotation BOQ become LPO items.
export function quotationToLpoPayload(q: QuotationData) {
  const items = (q.boqItems || []).map((b: any) => ({
    description: b.description || "",
    qty: String(b.qty || "1"),
    uom: b.unit || "Nos",
    amount: String(b.amount || "0"),
    discount: "0",
  }));
  return {
    clientName: q.to || "",
    clientPhone: "",
    project: q.serviceTitle || q.project || "",
    siteLocation: q.project || "",
    contact: q.attn || "",
    reference: q.quotationNo || "",
    vendorName: "",
    vendorAddress: "",
    vendorPhone: "",
    vendorTRN: "",
    items: items.length > 0 ? items : [{ description: "", qty: "1", uom: "Nos", amount: "", discount: "0" }],
    paymentTerms: q.paymentTerms?.[0] || "30 days Credit",
    deliveryterms: "days",
    requestedBy: "",
    preparedBy: "",
  };
}