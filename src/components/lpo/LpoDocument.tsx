"use client";

import {
  Document, Page, Text, View, StyleSheet, Image, Link,
} from "@react-pdf/renderer";

export interface LpoItem {
  description: string;
  amount: string;
  qty: string;
  uom: string;
  discount: string;
}

export interface LpoPdfData {
  nxrNo: number;
  clientName: string;
  clientPhone: string;
  project: string;
  siteLocation: string;
  contact: string;
  reference: string;
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string;
  vendorTRN: string;
  items: LpoItem[];
  totalDiscount: number;
  subtotal: number;
  vat: number;
  total: number;
  paymentTerms: string;
  deliveryterms: string;
  deliveryPreset: string;
  deliverynumber: string;
  requestedBy: string;
  preparedBy: string;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  attachmentNames?: string[];
  shareLink?: string;
}

const A4W = 595.28;
const A4H = 841.89;

function convertNumberToWords(num: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];
  const teens = ["Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const scales = ["","Thousand","Million","Billion"];
  if (num === 0) return "Zero";
  const ch = (n: number) => { let r = ""; const h = Math.floor(n/100); const rem = n%100; if(h>0) r+=`${ones[h]} Hundred`; if(rem>=20){if(r)r+=" ";r+=tens[Math.floor(rem/10)];if(rem%10>0)r+=` ${ones[rem%10]}`;}else if(rem>=10){if(r)r+=" ";r+=teens[rem-10];}else if(rem>0){if(r)r+=" ";r+=ones[rem];}return r;};
  const parts:string[]=[]; let si=0; let v=num;
  while(v>0){const c=v%1000;if(c!==0)parts.unshift(`${ch(c)}${si>0?` ${scales[si]}`:""}`);v=Math.floor(v/1000);si++;}
  return parts.join(" ").trim();
}

function amountToWords(amount: number): string {
  const d=Math.floor(amount);const f=Math.round((amount-d)*100);
  let o=`${convertNumberToWords(d)} Dirhams`;if(f>0)o+=` and ${convertNumberToWords(f)} Fils`;return`${o} Only`;
}

export default function LpoDocument({ lpoData }: { lpoData: LpoPdfData }) {
  const today = new Date().toLocaleDateString();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bg = `${origin}/letterhead-bg.png`;
  const stamp = `${origin}/approved-stamp.png`;

  const calc = (item: LpoItem) => {
    const qty=Number(item.qty||0);const up=Number(item.amount||0);const dp=Math.max(0,Number(item.discount||0));
    const g=qty*up;const da=g*(dp/100);const st=g-da;const vt=st*0.05;return{unitPrice:up,discountPercent:dp,subtotal:st,vat:vt,total:st+vt};
  };

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Image fixed src={bg} style={s.bg} />
        <View fixed style={s.hdr}><View style={s.poR}><Text style={s.poT}>PURCHASE ORDER</Text><Text>PO NUMBER: LPO-{lpoData.nxrNo}</Text><Text>PO DATE: {today}</Text><Text>REFERENCE #: {lpoData.reference||"-"}</Text></View></View>
        <View fixed style={s.fll}>
          <Link src="tel:+971569300820" style={s.pl}><Text style={s.ht}>p</Text></Link>
          <Link src="mailto:info@nexayraarc.com" style={s.el}><Text style={s.ht}>e</Text></Link>
          <Link src="https://nexayraarc.com/" style={s.wl}><Text style={s.ht}>w</Text></Link>
          <Link src="https://instagram.com/nexayraarc" style={s.il}><Text style={s.ht}>i</Text></Link>
          <Link src="https://www.linkedin.com/in/nexayra" style={s.ll}><Text style={s.ht}>l</Text></Link>
        </View>
        <View style={s.cc}>
          <View style={s.row}>
            <View style={s.box}><Text style={s.bh}>VENDOR DETAILS</Text><Text>{lpoData.vendorName||"-"}</Text><Text>{lpoData.vendorAddress||"-"}</Text><Text>Phone: {lpoData.vendorPhone||"-"}</Text><Text>TRN: {lpoData.vendorTRN||"-"}</Text></View>
            <View style={s.box}><Text style={s.bh}>BILL TO</Text><Text>Nexayra Arc General Contracting L.L.C.</Text><Text>Abu Dhabi, UAE</Text><Text>Phone: +971 56 930 0820</Text><Text>TRN: - 105373683900001</Text><Text>Attn: Accounts Department</Text></View>
            <View style={s.boxL}><Text style={s.bh}>SHIP TO</Text><Text>{lpoData.project||"-"}</Text><Text>Project Name: {lpoData.clientName||"-"}</Text><Text>Location: {lpoData.siteLocation||"-"}</Text><Text>Contact Person: {lpoData.contact||"-"}</Text><Text>Contact Number: {lpoData.clientPhone||"-"}</Text></View>
          </View>
          <View style={s.th}><Text style={[s.c1,s.b]}>S/N</Text><Text style={[s.c2,s.b]}>ITEM DETAILS</Text><Text style={[s.c3,s.b]}>QTY</Text><Text style={[s.c4,s.b]}>UNIT</Text><Text style={[s.c5,s.b]}>UNIT PRICE</Text><Text style={[s.c6,s.b]}>DISC %</Text><Text style={[s.c7,s.b]}>SUBTOTAL</Text><Text style={[s.c8,s.b]}>VAT</Text><Text style={[s.c9,s.b]}>TOTAL</Text></View>
          {lpoData.items.map((item,i)=>{const r=calc(item);return(
            <View key={i} style={s.tr} wrap={false}><Text style={s.c1}>{i+1}</Text><Text style={s.c2}>{item.description||"-"}</Text><Text style={s.c3}>{item.qty||"0"}</Text><Text style={s.c4}>{item.uom||"-"}</Text><Text style={[s.c5]}>{r.unitPrice.toFixed(2)}</Text><Text style={[s.c6]}>{r.discountPercent.toFixed(2)}</Text><Text style={[s.c7]}>{r.subtotal.toFixed(2)}</Text><Text style={[s.c8]}>{r.vat.toFixed(2)}</Text><Text style={[s.c9]}>{r.total.toFixed(2)}</Text></View>
          );})}
          <View wrap={false}>
            <View style={s.tots}>
              <View style={s.totT}><Text style={s.totTx}>TOTAL DISCOUNT</Text><Text style={s.totTx}>{lpoData.totalDiscount.toFixed(2)}</Text></View>
              <View style={s.totR}><Text style={s.totTx}>SUBTOTAL</Text><Text style={s.totTx}>{lpoData.subtotal.toFixed(2)}</Text></View>
              <View style={s.totR}><Text style={s.totTx}>TOTAL VAT</Text><Text style={s.totTx}>{lpoData.vat.toFixed(2)}</Text></View>
              <View style={s.totR}><Text style={s.totTx}>TOTAL AMOUNT (AED)</Text><Text style={s.totTx}>{lpoData.total.toFixed(2)}</Text></View>
            </View>
            <View style={s.awb}><Text><Text style={s.b}>Amount in Words: </Text>{amountToWords(lpoData.total)}</Text></View>
            <View style={s.sec}><Text style={s.bh}>PAYMENT TERMS</Text><Text>{lpoData.paymentTerms}</Text></View>
            <View style={s.sec}><Text style={s.bh}>DELIVERY TERMS</Text><Text>{lpoData.deliveryPreset&&`${lpoData.deliverynumber} `}{lpoData.deliveryPreset||lpoData.deliveryterms||"-"}</Text></View>
            {lpoData.attachmentNames&&lpoData.attachmentNames.length>0&&(<View style={s.sec}><Text style={s.bh}>ATTACHMENTS</Text>{lpoData.attachmentNames.map((n,i)=><Text key={i}>{i+1}. {n}</Text>)}</View>)}
            <View style={s.stR}><View style={s.stC}/><View style={s.stC}/><View style={s.stC}>{lpoData.approved&&<Image src={stamp} style={s.stI}/>}</View></View>
            <View style={s.sgR}>
              <View style={s.sgB}><Text style={s.ct}>Requested By</Text><Text style={{marginTop:3,textAlign:"center"}}>{lpoData.requestedBy||"-"}</Text></View>
              <View style={s.sgB}><Text style={s.ct}>Prepared By</Text><Text style={{marginTop:3,textAlign:"center"}}>{lpoData.preparedBy||"-"}</Text></View>
              <View style={s.sgB}><Text style={s.ct}>Approved By</Text>{lpoData.approved?<Text style={s.abN}>{lpoData.approvedBy||"-"}</Text>:<Text style={{marginTop:10,textAlign:"center"}}>Pending</Text>}</View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

const s = StyleSheet.create({
  page:{fontSize:8.5,fontFamily:"Helvetica",color:"#1c2143",position:"relative",backgroundColor:"#fff"},
  bg:{position:"absolute",top:0,left:0,width:A4W,height:A4H,objectFit:"fill"},
  cc:{paddingTop:88,paddingLeft:20,paddingRight:20,paddingBottom:90},
  hdr:{position:"absolute",top:20,left:20,right:20,flexDirection:"row",justifyContent:"flex-end",alignItems:"flex-start"},
  poR:{textAlign:"right"},poT:{fontSize:16,fontWeight:"bold",marginBottom:4},
  row:{flexDirection:"row",borderWidth:1,borderColor:"#c8d1e6",marginTop:8},
  box:{width:"33.33%",borderRightWidth:1,borderColor:"#c8d1e6",padding:6},
  boxL:{width:"33.34%",padding:6},
  bh:{backgroundColor:"#eef2f8",padding:4,fontWeight:"bold",marginBottom:4},
  th:{flexDirection:"row",borderWidth:1,borderColor:"#c8d1e6",backgroundColor:"#eef2f8",marginTop:10,paddingVertical:4},
  tr:{flexDirection:"row",borderLeftWidth:1,borderRightWidth:1,borderBottomWidth:1,borderColor:"#c8d1e6",paddingVertical:4},
 c1:{width:"5%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c2:{width:"29%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c3:{width:"7%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c4:{width:"8%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c5:{width:"12%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c6:{width:"10%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c7:{width:"11%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c8:{width:"8%",borderRightWidth:1,borderColor:"#c8d1e6",paddingHorizontal:3,textAlign:"center"},
  c9:{width:"10%",paddingHorizontal:3,textAlign:"center"},
  rt:{textAlign:"right"},b:{fontWeight:"bold"},ct:{textAlign:"center"},
  tots:{width:"46%",alignSelf:"flex-end",marginTop:8},
  totT:{borderWidth:1,borderColor:"#c8d1e6",padding:5,flexDirection:"row",justifyContent:"space-between"},
  totR:{flexDirection:"row",justifyContent:"space-between",borderWidth:1,borderColor:"#c8d1e6",borderTopWidth:0,padding:5},
  totTx:{fontWeight:"bold"},
  sec:{marginTop:10},awb:{borderWidth:1,borderColor:"#c8d1e6",padding:6,marginTop:10},
  stR:{flexDirection:"row",justifyContent:"space-between",gap:14,marginTop:18,minHeight:78,alignItems:"center"},
  stC:{width:"31%",height:78,justifyContent:"center",alignItems:"center"},
  stI:{width:70,height:70,objectFit:"contain",alignSelf:"center"},
  sgR:{flexDirection:"row",justifyContent:"space-between",gap:14,alignItems:"flex-start"},
  sgB:{width:"31%",borderTopWidth:1,borderColor:"#1c2143",paddingTop:5,minHeight:95},
  abN:{marginTop:4,textAlign:"center",fontWeight:"bold"},
  fll:{position:"absolute",left:20,bottom:12,width:555,height:47},
  ht:{fontSize:1,color:"#fff",opacity:0},
  pl:{position:"absolute",left:8,top:18,width:80,height:12},
  el:{position:"absolute",left:86,top:18,width:120,height:12},
  wl:{position:"absolute",left:248,top:18,width:135,height:12},
  il:{position:"absolute",left:385,top:15,width:85,height:10},
  ll:{position:"absolute",left:385,top:27,width:145,height:10},
});
