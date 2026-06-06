"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import type { LpoItem, LpoPdfData } from "./LpoDocument";
import PreviewModal from "@/components/PreviewModal";
import { Eye } from "lucide-react";
import SuggestInput from "@/components/SuggestInput";
import ProjectCodeInput, { type ProjectLookup } from "@/components/ProjectCodeInput";

type PaymentPreset = "15" | "30" | "60" | "90" | "custom";
type DeliveryPreset = "Days" | "Weeks" | "Months" | "custom";

const DRAFT_KEY = "createLpoDraftV10";
const makeEmpty = (): LpoItem => ({ description: "", qty: "1", uom: "Nos", amount: "", discount: "0" });

export default function CreateLPO() {
  // ----- LPO header fields -----
  const [nxrNo, setNxrNo] = useState<number | null>(null);

  // Project linkage
  const [projectId, setProjectId] = useState("");      // canonical link
  const [projectName, setProjectName] = useState("");  // denormalized name
  const [projectCode, setProjectCode] = useState("");  // denormalized code

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [contact, setContact] = useState("");
  const [reference, setReference] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorTRN, setVendorTRN] = useState("");
  const [paymentPreset, setPaymentPreset] = useState<PaymentPreset>("30");
  const [customPaymentDays, setCustomPaymentDays] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [deliveryPreset, setDeliveryPreset] = useState<DeliveryPreset>("Days");
  const [customDeliveryTime, setCustomDeliveryTime] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [items, setItems] = useState<LpoItem[]>([makeEmpty()]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ----- Pre-fill from quotation conversion -----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("prefill") === "1") {
      const raw = sessionStorage.getItem("prefillLpo");
      if (raw) {
        try {
          const p = JSON.parse(raw);
          setClientName(p.clientName || "");
          setClientPhone(p.clientPhone || "");
          setProjectName(p.project || "");
          setProjectCode(p.projectCode || "");
          if (p.projectId) setProjectId(p.projectId);
          setSiteLocation(p.siteLocation || "");
          setContact(p.contact || "");
          setReference(p.reference || "");
          setVendorName(p.vendorName || "");
          setVendorAddress(p.vendorAddress || "");
          setVendorPhone(p.vendorPhone || "");
          setVendorTRN(p.vendorTRN || "");
          if (Array.isArray(p.items) && p.items.length > 0) setItems(p.items);
          if (p.paymentTerms) {
            const m = String(p.paymentTerms).match(/(\d+)/);
            if (m) setPaymentPreset(m[1] as any);
          }
          sessionStorage.removeItem("prefillLpo");
          setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
          alert("Quotation data pre-filled. Add vendor info and save.");
        } catch {}
      }
    }
  }, []);

  // ----- Draft load -----
  useEffect(() => {
    try {
      const s = localStorage.getItem(DRAFT_KEY);
      if (!s) return;
      const d = JSON.parse(s);
      setProjectId(d.projectId ?? "");
      setProjectName(d.projectName ?? "");
      setProjectCode(d.projectCode ?? "");
      setClientName(d.clientName ?? "");
      setClientPhone(d.clientPhone ?? "");
      setSiteLocation(d.siteLocation ?? "");
      setContact(d.contact ?? "");
      setReference(d.reference ?? "");
      setVendorName(d.vendorName ?? "");
      setVendorAddress(d.vendorAddress ?? "");
      setVendorPhone(d.vendorPhone ?? "");
      setVendorTRN(d.vendorTRN ?? "");
      setPaymentPreset(d.paymentPreset ?? "30");
      setCustomPaymentDays(d.customPaymentDays ?? "");
      setDeliveryNumber(d.deliveryNumber ?? "");
      setDeliveryPreset(d.deliveryPreset ?? "Days");
      setCustomDeliveryTime(d.customDeliveryTime ?? "");
      setRequestedBy(d.requestedBy ?? "");
      setPreparedBy(d.preparedBy ?? "");
      if (Array.isArray(d.items) && d.items.length > 0) setItems(d.items);
    } catch {}
  }, []);

  // ----- Draft save -----
  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        projectId, projectName, projectCode,
        clientName, clientPhone, siteLocation, contact, reference,
        vendorName, vendorAddress, vendorPhone, vendorTRN,
        paymentPreset, customPaymentDays,
        deliveryNumber, deliveryPreset, customDeliveryTime,
        requestedBy, preparedBy, items,
      }),
    );
  });

  // ----- Computed -----
  const paymentTerms = useMemo(
    () =>
      paymentPreset === "custom"
        ? customPaymentDays.trim() ? `${customPaymentDays.trim()} days Credit` : ""
        : `${paymentPreset} days Credit`,
    [paymentPreset, customPaymentDays],
  );

  const resolvedDelivery = useMemo(() => {
    if (deliveryPreset === "custom") {
      const ct = customDeliveryTime.trim();
      return { dp: "", dt: deliveryNumber.trim() && ct ? `${deliveryNumber.trim()} ${ct}` : ct };
    }
    return { dp: deliveryPreset, dt: deliveryPreset.toLowerCase() };
  }, [deliveryNumber, deliveryPreset, customDeliveryTime]);

  const calcItem = (item: LpoItem) => {
    const qty = Number(item.qty || 0);
    const up = Number(item.amount || 0);
    const dp = Math.max(0, Number(item.discount || 0));
    const g = qty * up;
    const da = g * (dp / 100);
    const st = g - da;
    const vt = st * 0.05;
    return { discountAmount: da, subtotal: st, vat: vt, total: st + vt };
  };

  const totals = useMemo(
    () => items.reduce(
      (a, i) => {
        const r = calcItem(i);
        a.discountAmount += r.discountAmount;
        a.subtotal += r.subtotal;
        a.vat += r.vat;
        a.total += r.total;
        return a;
      },
      { discountAmount: 0, subtotal: 0, vat: 0, total: 0 },
    ),
    [items],
  );

  const updateItem = (i: number, f: keyof LpoItem, v: string) =>
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));

  // ----- Validation -----
  const validate = () => {
    if (!projectId) return "Please select a valid project code.";
    if (!clientName.trim()) return "Please enter Client Name.";
    if (!siteLocation.trim()) return "Please enter Site Location.";
    if (!vendorName.trim()) return "Please enter Vendor Name.";
    if (!requestedBy.trim()) return "Please enter Requested By.";
    if (!preparedBy.trim()) return "Please enter Prepared By.";
    if (paymentPreset === "custom" && !customPaymentDays.trim()) return "Please enter custom payment days.";
    if (deliveryPreset === "custom" && !customDeliveryTime.trim()) return "Please enter custom delivery time.";
    if (!items.some(i => i.description.trim() && Number(i.qty) > 0)) return "Please add at least one valid item.";
    return "";
  };

  const buildPayload = () => ({
    projectId,
    project: projectName.trim(),
    projectCode: projectCode.trim(),
    clientName: clientName.trim(),
    clientPhone: clientPhone.trim(),
    siteLocation: siteLocation.trim(),
    contact: contact.trim(),
    reference: reference.trim(),
    vendorName: vendorName.trim(),
    vendorAddress: vendorAddress.trim(),
    vendorPhone: vendorPhone.trim(),
    vendorTRN: vendorTRN.trim(),
    items,
    totalDiscount: +totals.discountAmount.toFixed(2),
    subtotal: +totals.subtotal.toFixed(2),
    vat: +totals.vat.toFixed(2),
    total: +totals.total.toFixed(2),
    paymentTerms,
    deliveryterms: resolvedDelivery.dt,
    deliveryPreset: resolvedDelivery.dp,
    deliverynumber: deliveryNumber.trim(),
    requestedBy: requestedBy.trim(),
    preparedBy: preparedBy.trim(),
    attachmentNames: attachments.map(f => f.name),
  });

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setNxrNo(null);
    setProjectId(""); setProjectName(""); setProjectCode("");
    setClientName(""); setClientPhone(""); setSiteLocation("");
    setContact(""); setReference("");
    setVendorName(""); setVendorAddress(""); setVendorPhone(""); setVendorTRN("");
    setPaymentPreset("30"); setCustomPaymentDays("");
    setDeliveryNumber(""); setDeliveryPreset("Days"); setCustomDeliveryTime("");
    setRequestedBy(""); setPreparedBy("");
    setItems([makeEmpty()]); setAttachments([]);
  };

  const generatePdfBlob = async (data: LpoPdfData) => {
    const [{ pdf }, { default: LpoDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./LpoDocument"),
    ]);
    return await pdf(<LpoDocument lpoData={data} />).toBlob();
  };

  const handlePreview = async () => {
    const err = validate();
    if (err) { setMessage({ text: err, type: "error" }); return; }
    try {
      setIsWorking(true);
      setMessage(null);
      const payload = buildPayload();
      const tempLpo: LpoPdfData = { ...payload, nxrNo: 0, approved: false, approvedBy: "", approvedAt: undefined, shareLink: undefined } as any;
      const blob = await generatePdfBlob(tempLpo);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setMessage({ text: e.message || "Failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsWorking(true);
      setMessage(null);
      const res = await apiCall<{ lpo: LpoPdfData }>("/api/lpo", { method: "POST", body: buildPayload() });
      setNxrNo(res.lpo.nxrNo);
      const blob = await generatePdfBlob(res.lpo);
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: `LPO-${res.lpo.nxrNo}.pdf` }).click();
      URL.revokeObjectURL(url);
      setMessage({ text: `LPO #${res.lpo.nxrNo} saved and downloaded.`, type: "success" });
      setPreviewUrl(null);
      clearDraft();
    } catch (e: any) {
      setMessage({ text: e.message || "Download failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsWorking(true);
      setMessage(null);
      const res = await apiCall<{ lpo: LpoPdfData }>("/api/lpo", { method: "POST", body: buildPayload() });
      setNxrNo(res.lpo.nxrNo);
      const blob = await generatePdfBlob(res.lpo);
      const pdfFile = new File([blob], `LPO-${res.lpo.nxrNo}.pdf`, { type: "application/pdf" });
      const text = [`LPO #${res.lpo.nxrNo}`, `Client: ${res.lpo.clientName}`, `Total: AED ${res.lpo.total.toFixed(2)}`].join("\n");
      if (navigator.share) {
        const files = [pdfFile, ...attachments];
        if (navigator.canShare?.({ files })) await navigator.share({ title: `LPO #${res.lpo.nxrNo}`, text, files });
        else await navigator.share({ title: `LPO #${res.lpo.nxrNo}`, text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setMessage({ text: `LPO #${res.lpo.nxrNo} saved and shared.`, type: "success" });
      setPreviewUrl(null);
      clearDraft();
    } catch (e: any) {
      setMessage({ text: e.message || "Share failed.", type: "error" });
    } finally {
      setIsWorking(false);
    }
  };

  // ----- Styles -----
  const inp = "w-full px-4 py-3 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white placeholder-navy-300 text-sm transition-all duration-200 hover:border-navy-300";
  const lbl = "block text-navy-500 dark:text-navy-300 text-xs font-bold uppercase tracking-wider mb-1.5";
  const sec = "text-navy dark:text-white font-display text-lg font-bold mt-8 mb-4 pb-2 border-b border-navy-100 dark:border-navy-700";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      <PreviewModal
        pdfUrl={previewUrl}
        title={`LPO #${nxrNo || "Draft"}`}
        onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
        onDownload={handleDownload}
        onShare={handleShare}
        isWorking={isWorking}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy dark:text-white">{nxrNo ? `LPO #${nxrNo}` : "Create LPO"}</h1>
          <p className="mt-1 text-navy-400 text-sm">{nxrNo ? "Nexayra Arc General Contracting L.L.C." : "Number assigned on generation."}</p>
        </div>
      </div>

      {message && (
        <div className={`mb-5 p-3.5 rounded-xl text-sm font-medium animate-scale-in ${
          message.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-6 sm:p-8 shadow-sm hover-lift">

        {/* ----- PROJECT CODE — full-width, dropdown floats over the rest ----- */}
        <h3 className={`${sec} mt-0`}>Project</h3>
        <div className="relative z-30 mb-4 animate-fade-in-up delay-1">
          <ProjectCodeInput
            label="Project Code"
            required
            value={projectCode}
            onChange={setProjectCode}
            onProjectFound={(p: ProjectLookup) => {
              setProjectId(p.id);
              setProjectName(p.name);
              setProjectCode(p.code);
              if (!clientName.trim() && p.client) setClientName(p.client);
              if (!siteLocation.trim() && p.location) setSiteLocation(p.location);
              if (!contact.trim() && p.projectManager) setContact(p.projectManager);
              if (!clientPhone.trim() && p.clientPhone) setClientPhone(p.clientPhone);
            }}
            onProjectCleared={() => {
              setProjectId("");
              setProjectName("");
            }}
          />
        </div>

        {/* ----- CLIENT / SITE DETAILS — separate grid, lower z-index so dropdown floats over ----- */}
        <div className="relative z-0 grid sm:grid-cols-2 gap-4">
          <div className="animate-fade-in-up delay-2">
            <label className={lbl}>Client Name</label>
            <SuggestInput
              field="clientName"
              value={clientName}
              onChange={setClientName}
              placeholder="Client / Company"
              className={inp}
            />
          </div>
          <div className="animate-fade-in-up delay-3">
            <label className={lbl}>Contact Person</label>
            <input
              placeholder="Contact Person"
              value={contact}
              onChange={e => setContact(e.target.value)}
              className={inp}
            />
          </div>
          <div className="animate-fade-in-up delay-4">
            <label className={lbl}>Contact Number</label>
            <input
              placeholder="Contact Number"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              className={inp}
            />
          </div>
          <div className="animate-fade-in-up delay-5">
            <label className={lbl}>Site Location</label>
            <input
              placeholder="Site Location"
              value={siteLocation}
              onChange={e => setSiteLocation(e.target.value)}
              className={inp}
            />
          </div>
          <div className="animate-fade-in-up delay-5 sm:col-span-2">
            <label className={lbl}>Quotation Reference (optional)</label>
            <input
              placeholder="Reference Number"
              value={reference}
              onChange={e => setReference(e.target.value)}
              className={inp}
            />
          </div>
        </div>

        {/* ----- VENDOR DETAILS ----- */}
        <h3 className={sec}>Vendor Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Vendor Name</label>
            <SuggestInput
              field="vendorName"
              value={vendorName}
              onChange={setVendorName}
              onPick={async (name) => {
                try {
                  const r = await apiCall<{ details: any }>(`/api/suggestions?lookup=vendor&name=${encodeURIComponent(name)}`);
                  if (r.details) {
                    if (r.details.vendorAddress) setVendorAddress(r.details.vendorAddress);
                    if (r.details.vendorPhone) setVendorPhone(r.details.vendorPhone);
                    if (r.details.vendorTRN) setVendorTRN(r.details.vendorTRN);
                  }
                } catch {}
              }}
              placeholder="Vendor Name"
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Vendor Address</label>
            <input
              placeholder="Vendor Address"
              value={vendorAddress}
              onChange={e => setVendorAddress(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Vendor Phone</label>
            <SuggestInput
              field="vendorPhone"
              value={vendorPhone}
              onChange={setVendorPhone}
              onPick={async (phone) => {
                try {
                  const r = await apiCall<{ details: any }>(`/api/suggestions?lookup=vendor&phone=${encodeURIComponent(phone)}`);
                  if (r.details) {
                    if (r.details.vendorAddress) setVendorAddress(r.details.vendorAddress);
                    if (r.details.vendorName) setVendorName(r.details.vendorName);
                    if (r.details.vendorTRN) setVendorTRN(r.details.vendorTRN);
                  }
                } catch {}
              }}
              placeholder="Vendor Phone"
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Vendor TRN</label>
            <SuggestInput
              field="vendorTRN"
              value={vendorTRN}
              onChange={setVendorTRN}
              onPick={async (trn) => {
                try {
                  const r = await apiCall<{ details: any }>(`/api/suggestions?lookup=vendor&TRN=${encodeURIComponent(trn)}`);
                  if (r.details) {
                    if (r.details.vendorAddress) setVendorAddress(r.details.vendorAddress);
                    if (r.details.vendorName) setVendorName(r.details.vendorName);
                    if (r.details.vendorPhone) setVendorPhone(r.details.vendorPhone);
                  }
                } catch {}
              }}
              placeholder="Vendor TRN"
              className={inp}
            />
          </div>
        </div>

        {/* ----- PAYMENT TERMS ----- */}
        <h3 className={sec}>Payment Terms</h3>
        <div className="flex flex-wrap gap-3">
          <select
            value={paymentPreset}
            onChange={e => setPaymentPreset(e.target.value as PaymentPreset)}
            className={`${inp} w-auto min-w-[200px]`}
          >
            <option value="15">15 days Credit</option>
            <option value="30">30 days Credit</option>
            <option value="60">60 days Credit</option>
            <option value="90">90 days Credit</option>
            <option value="custom">Custom</option>
          </select>
          {paymentPreset === "custom" && (
            <input
              type="number"
              min="1"
              placeholder="Custom days"
              value={customPaymentDays}
              onChange={e => setCustomPaymentDays(e.target.value)}
              className={`${inp} w-auto min-w-[180px]`}
            />
          )}
        </div>

        {/* ----- ITEM DETAILS ----- */}
        <h3 className={sec}>Item Details</h3>
        <div className="hidden md:grid grid-cols-[1fr_5rem_6rem_7rem_7rem_5rem] gap-2 mb-2 text-navy-400 text-xs font-bold uppercase tracking-wider px-1">
          <div>Description</div>
          <div>Qty</div>
          <div>Unit</div>
          <div>Amount</div>
          <div>Discount %</div>
          <div />
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_5rem_6rem_7rem_7rem_5rem] gap-2 mb-3 items-start animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <textarea placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className={`${inp} min-h-[56px] resize-y`} rows={2} />
            <input type="number" min="0" placeholder="Qty" value={item.qty} onChange={e => updateItem(i, "qty", e.target.value)} className={inp} />
            <input placeholder="UOM" value={item.uom} onChange={e => updateItem(i, "uom", e.target.value)} className={inp} />
            <input type="number" min="0" step="0.01" placeholder="Amount" value={item.amount} onChange={e => updateItem(i, "amount", e.target.value)} className={inp} />
            <input type="number" min="0" max="100" step="0.01" placeholder="Disc %" value={item.discount} onChange={e => updateItem(i, "discount", e.target.value)} className={inp} />
            <button onClick={() => setItems(p => p.length === 1 ? p : p.filter((_, j) => j !== i))} disabled={items.length === 1} className="w-full md:w-20 h-[42px] bg-red-50 hover:bg-red-100 text-red-500 font-semibold rounded-xl text-xs disabled:opacity-30 transition-all border border-red-200 btn-press">
              Remove
            </button>
          </div>
        ))}
        <button onClick={() => setItems(p => [...p, makeEmpty()])} className="mt-2 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-200 dark:border-navy-600 rounded-xl text-navy dark:text-white text-sm font-semibold hover:bg-navy-100 transition-all btn-press">
          + Add Item
        </button>

        {/* ----- DELIVERY TERMS ----- */}
        <h3 className={sec}>Delivery Terms</h3>
        <div className="flex flex-wrap gap-3">
          <input placeholder="Delivery Time" value={deliveryNumber} onChange={e => setDeliveryNumber(e.target.value)} className={`${inp} w-auto min-w-[160px]`} />
          <select value={deliveryPreset} onChange={e => setDeliveryPreset(e.target.value as DeliveryPreset)} className={`${inp} w-auto min-w-[160px]`}>
            <option value="Days">Days</option>
            <option value="Weeks">Weeks</option>
            <option value="Months">Months</option>
            <option value="custom">Custom</option>
          </select>
          {deliveryPreset === "custom" && (
            <input placeholder="Custom term" value={customDeliveryTime} onChange={e => setCustomDeliveryTime(e.target.value)} className={`${inp} w-auto min-w-[200px]`} />
          )}
        </div>

        {/* ----- APPROVAL DETAILS ----- */}
        <h3 className={sec}>Approval Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Requested By</label>
            <input placeholder="Requested By" value={requestedBy} onChange={e => setRequestedBy(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Prepared By</label>
            <input placeholder="Prepared By" value={preparedBy} onChange={e => setPreparedBy(e.target.value)} className={inp} />
          </div>
        </div>

        {/* ----- ATTACHMENTS ----- */}
        <h3 className={sec}>Attachments</h3>
        <input
          type="file"
          multiple
          onChange={e => { if (e.target.files) setAttachments(p => [...p, ...Array.from(e.target.files!)]); }}
          className="text-navy-500 text-sm"
        />
        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl animate-scale-in">
                <span className="text-navy dark:text-white text-sm truncate">{f.name}</span>
                <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="text-red-500 text-xs font-semibold">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ----- TOTALS ----- */}
        <div className="mt-8 p-5 rounded-xl bg-navy-50 dark:bg-navy-800 border border-navy-100 dark:border-navy-700">
          <div className="flex justify-between text-navy-500 dark:text-navy-300 text-sm mb-2"><span>Total Discount:</span><strong className="text-navy dark:text-white">AED {totals.discountAmount.toFixed(2)}</strong></div>
          <div className="flex justify-between text-navy-500 dark:text-navy-300 text-sm mb-2"><span>Subtotal:</span><strong className="text-navy dark:text-white">AED {totals.subtotal.toFixed(2)}</strong></div>
          <div className="flex justify-between text-navy-500 dark:text-navy-300 text-sm mb-3"><span>VAT (5%):</span><strong className="text-navy dark:text-white">AED {totals.vat.toFixed(2)}</strong></div>
          <div className="flex justify-between text-navy dark:text-white text-xl font-bold pt-3 border-t border-navy-200 dark:border-navy-600"><span>Total:</span><span className="text-gold">AED {totals.total.toFixed(2)}</span></div>
        </div>

        {/* ----- PREVIEW BUTTON ----- */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handlePreview}
            disabled={isWorking}
            className="flex items-center gap-2 px-6 py-3 bg-navy hover:bg-navy-700 text-white dark:bg-gold-400 dark:text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-all shadow-lg shadow-navy/20 hover:shadow-xl hover:-translate-y-0.5 btn-press"
          >
            <Eye size={18} /> {isWorking ? "Working…" : "Preview & Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}