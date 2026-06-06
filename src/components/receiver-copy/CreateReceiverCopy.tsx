"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api-client";
import type { ReceiverCopyData } from "./ReceiverCopyDocument";
import PreviewModal from "@/components/PreviewModal";
import { Eye } from "lucide-react";

const DRAFT_KEY="createReceiverCopyV4";
function formatToday():string{const n=new Date();return`${String(n.getDate()).padStart(2,"0")}-${n.toLocaleString("en-US",{month:"long"})}-${n.getFullYear()}`;}
function toNumber(v:string):number{const p=Number(String(v).replace(/,/g,"").trim());return Number.isFinite(p)?p:0;}
function convertNumberToWords(num:number):string{const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];const teens=["Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];const scales=["","Thousand","Million","Billion"];if(num===0)return"Zero";const ch=(n:number)=>{let r="";const h=Math.floor(n/100);const rem=n%100;if(h>0)r+=`${ones[h]} Hundred`;if(rem>=20){if(r)r+=" ";r+=tens[Math.floor(rem/10)];if(rem%10>0)r+=` ${ones[rem%10]}`;}else if(rem>=10){if(r)r+=" ";r+=teens[rem-10];}else if(rem>0){if(r)r+=" ";r+=ones[rem];}return r;};const parts:string[]=[];let si=0;let v=num;while(v>0){const c=v%1000;if(c!==0)parts.unshift(`${ch(c)}${si>0?` ${scales[si]}`:""}`);v=Math.floor(v/1000);si++;}return parts.join(" ").trim();}
function amountToWords(a:number):string{const s=Number.isFinite(a)?a:0;const d=Math.floor(s);const f=Math.round((s-d)*100);let r=`${convertNumberToWords(d)} Dirhams`;if(f>0)r+=` and ${convertNumberToWords(f)} Fils`;return r;}

export default function CreateReceiverCopy(){
  const [documentNo,setDocumentNo]=useState("(auto)");
  const [date,setDate]=useState(""); const [receivedFrom,setReceivedFrom]=useState(""); const [amount,setAmount]=useState("");
  const [chequeNumber,setChequeNumber]=useState(""); const [bankName,setBankName]=useState(""); const [chequeDate,setChequeDate]=useState("");
  const [purposeDescription,setPurposeDescription]=useState(""); const [receivedBy,setReceivedBy]=useState(""); const [companyName,setCompanyName]=useState("");
  const [contactNumber,setContactNumber]=useState(""); const [email,setEmail]=useState("");
  const [isWorking,setIsWorking]=useState(false); const [message,setMessage]=useState<{text:string;type:"success"|"error"}|null>(null);
  const [previewUrl,setPreviewUrl]=useState<string|null>(null);

  useEffect(()=>{setDate(formatToday());try{const s=localStorage.getItem(DRAFT_KEY);if(!s)return;const d=JSON.parse(s);setReceivedFrom(d.receivedFrom??"");setAmount(d.amount??"");setChequeNumber(d.chequeNumber??"");setBankName(d.bankName??"");setChequeDate(d.chequeDate??"");setPurposeDescription(d.purposeDescription??"");setReceivedBy(d.receivedBy??"");setCompanyName(d.companyName??"");setContactNumber(d.contactNumber??"");setEmail(d.email??"");}catch{}},[]);
  useEffect(()=>{localStorage.setItem(DRAFT_KEY,JSON.stringify({receivedFrom,amount,chequeNumber,bankName,chequeDate,purposeDescription,receivedBy,companyName,contactNumber,email}));});

  const amountInWords=useMemo(()=>amountToWords(toNumber(amount)),[amount]);

  const validate=()=>{if(!receivedFrom.trim())return"Enter Received From.";if(!amount.trim())return"Enter Amount.";if(!chequeNumber.trim())return"Enter Cheque Number.";if(!bankName.trim())return"Enter Bank Name.";if(!chequeDate.trim())return"Enter Cheque Date.";if(!purposeDescription.trim())return"Enter Purpose.";if(!receivedBy.trim())return"Enter Received By.";if(!companyName.trim())return"Enter Company Name.";return"";};
  const buildPayload=()=>({date:date.trim(),receivedFrom:receivedFrom.trim(),amount:amount.trim(),chequeNumber:chequeNumber.trim(),bankName:bankName.trim(),chequeDate:chequeDate.trim(),purposeDescription:purposeDescription.trim(),receivedBy:receivedBy.trim(),companyName:companyName.trim(),contactNumber:contactNumber.trim(),email:email.trim()});
  const reset=()=>{localStorage.removeItem(DRAFT_KEY);setDocumentNo("(auto)");setDate(formatToday());setReceivedFrom("");setAmount("");setChequeNumber("");setBankName("");setChequeDate("");setPurposeDescription("");setReceivedBy("");setCompanyName("");setContactNumber("");setEmail("");};

  const generatePdfBlob=async(data:ReceiverCopyData)=>{const[{pdf},{default:RCDoc}]=await Promise.all([import("@react-pdf/renderer"),import("./ReceiverCopyDocument")]);return await pdf(<RCDoc data={data}/>).toBlob();};

  const handlePreview=async()=>{
    const err=validate();if(err){setMessage({text:err,type:"error"});return;}
    try{setIsWorking(true);setMessage(null);
      const payload=buildPayload();
      const tempData:ReceiverCopyData={...payload,documentNo:"PREVIEW"};
      const blob=await generatePdfBlob(tempData);setPreviewUrl(URL.createObjectURL(blob));
    }catch(e:any){setMessage({text:e.message||"Failed.",type:"error"});}finally{setIsWorking(false);}
  };

  const handleDownload=async()=>{
    try{
      setIsWorking(true);setMessage(null);
      const res=await apiCall<{receiverCopy:ReceiverCopyData}>("/api/receiver-copy",{method:"POST",body:buildPayload()});
      setDocumentNo(res.receiverCopy.documentNo);
      const blob=await generatePdfBlob(res.receiverCopy);
      const url=URL.createObjectURL(blob);
      Object.assign(document.createElement("a"),{href:url,download:`${res.receiverCopy.documentNo}.pdf`}).click();
      URL.revokeObjectURL(url);
      setMessage({text:`${res.receiverCopy.documentNo} saved and downloaded.`,type:"success"});
      setPreviewUrl(null);reset();
    }catch(e:any){setMessage({text:e.message||"Download failed.",type:"error"});}
    finally{setIsWorking(false);}
  };

  const handleShare=async()=>{
    try{
      setIsWorking(true);setMessage(null);
      const res=await apiCall<{receiverCopy:ReceiverCopyData}>("/api/receiver-copy",{method:"POST",body:buildPayload()});
      setDocumentNo(res.receiverCopy.documentNo);
      const blob=await generatePdfBlob(res.receiverCopy);
      const pdfFile=new File([blob],`${res.receiverCopy.documentNo}.pdf`,{type:"application/pdf"});
      const text=[`Receipt: ${res.receiverCopy.documentNo}`,`From: ${res.receiverCopy.receivedFrom}`,`Amount: AED ${res.receiverCopy.amount}`].join("\n");
      if(navigator.share){
        if(navigator.canShare?.({files:[pdfFile]})) await navigator.share({title:res.receiverCopy.documentNo,text,files:[pdfFile]});
        else await navigator.share({title:res.receiverCopy.documentNo,text});
      } else {
        await navigator.clipboard.writeText(text);
      }
      setMessage({text:`${res.receiverCopy.documentNo} saved and shared.`,type:"success"});
      setPreviewUrl(null);reset();
    }catch(e:any){setMessage({text:e.message||"Share failed.",type:"error"});}
    finally{setIsWorking(false);}
  };

  const inp="w-full px-4 py-3 bg-white border border-navy-200 rounded-xl text-navy placeholder-navy-300 text-sm transition-all duration-200 hover:border-navy-300";
  const lbl="block text-navy-500 text-xs font-bold uppercase tracking-wider mb-1.5";

  return(
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <PreviewModal pdfUrl={previewUrl} title={documentNo} onClose={()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);setPreviewUrl(null);}} onDownload={handleDownload} onShare={handleShare} isWorking={isWorking}/>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div><h1 className="font-display text-3xl font-bold text-navy">Receiver Copy</h1><p className="mt-1 text-navy-400 text-sm">{documentNo} — {date}</p></div>
        <button onClick={handlePreview} disabled={isWorking} className="flex items-center gap-2 px-6 py-3 bg-navy hover:bg-navy-700 text-white dark:bg-gold-400 dark:text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-all shadow-lg shadow-navy/20 hover:-translate-y-0.5 btn-press animate-pulse-glow"><Eye size={18}/>{isWorking?"Working…":"Preview & Generate"}</button>
      </div>

      {message&&<div className={`mb-5 p-3.5 rounded-xl text-sm font-medium animate-scale-in ${message.type==="success"?"bg-green-50 border border-green-200 text-green-700":"bg-red-50 border border-red-200 text-red-600"}`}>{message.text}</div>}

      <div className="bg-white border border-navy-100 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 hover-lift">
        <div className="animate-fade-in-up delay-1"><label className={lbl}>Received From</label><input value={receivedFrom} onChange={e=>setReceivedFrom(e.target.value)} className={inp} placeholder="Person / Company"/></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="animate-fade-in-up delay-2"><label className={lbl}>Amount (AED)</label><input value={amount} onChange={e=>setAmount(e.target.value)} className={inp} placeholder="0.00"/></div>
          <div className="animate-fade-in-up delay-3"><label className={lbl}>Amount in Words</label><div className="px-4 py-3 bg-navy-50 dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-xl text-navy-400 dark:text-white/85 text-sm min-h-[48px]">{amountInWords||"-"}</div></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div><label className={lbl}>Cheque Number</label><input value={chequeNumber} onChange={e=>setChequeNumber(e.target.value)} className={inp}/></div>
          <div><label className={lbl}>Bank Name</label><input value={bankName} onChange={e=>setBankName(e.target.value)} className={inp}/></div>
          <div><label className={lbl}>Cheque Date</label><input value={chequeDate} onChange={e=>setChequeDate(e.target.value)} className={inp} placeholder="DD-Month-YYYY"/></div>
        </div>
        <div><label className={lbl}>Purpose / Description</label><textarea value={purposeDescription} onChange={e=>setPurposeDescription(e.target.value)} className={`${inp} min-h-[80px] resize-y`}/></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Received By</label><input value={receivedBy} onChange={e=>setReceivedBy(e.target.value)} className={inp}/></div>
          <div><label className={lbl}>Company Name</label><input value={companyName} onChange={e=>setCompanyName(e.target.value)} className={inp}/></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Contact Number (Optional)</label><input value={contactNumber} onChange={e=>setContactNumber(e.target.value)} className={inp}/></div>
          <div><label className={lbl}>Email (Optional)</label><input value={email} onChange={e=>setEmail(e.target.value)} className={inp}/></div>
        </div>
      </div>
    </div>
  );
}