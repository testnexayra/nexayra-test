"use client";

import { Document, Page, Text, View, StyleSheet, Image, Link } from "@react-pdf/renderer";

export interface ReceiverCopyData {
  documentNo: string; date: string; receivedFrom: string; amount: string;
  chequeNumber: string; bankName: string; chequeDate: string; purposeDescription: string;
  receivedBy: string; companyName: string; contactNumber?: string; email?: string;
}

const A4W=595.28,A4H=841.89;
function toNum(v:string):number{const p=Number(String(v).replace(/,/g,"").trim());return Number.isFinite(p)?p:0;}
function convertNumberToWords(num:number):string{const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];const teens=["Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];const scales=["","Thousand","Million","Billion"];if(num===0)return"Zero";const ch=(n:number)=>{let r="";const h=Math.floor(n/100);const rem=n%100;if(h>0)r+=`${ones[h]} Hundred`;if(rem>=20){if(r)r+=" ";r+=tens[Math.floor(rem/10)];if(rem%10>0)r+=` ${ones[rem%10]}`;}else if(rem>=10){if(r)r+=" ";r+=teens[rem-10];}else if(rem>0){if(r)r+=" ";r+=ones[rem];}return r;};const parts:string[]=[];let si=0;let v=num;while(v>0){const c=v%1000;if(c!==0)parts.unshift(`${ch(c)}${si>0?` ${scales[si]}`:""}`);v=Math.floor(v/1000);si++;}return parts.join(" ").trim();}
function amountToWords(a:number):string{const s=Number.isFinite(a)?a:0;const d=Math.floor(s);const f=Math.round((s-d)*100);let r=`${convertNumberToWords(d)} Dirhams`;if(f>0)r+=` and ${convertNumberToWords(f)} Fils`;return r;}

export default function ReceiverCopyDocument({data}:{data:ReceiverCopyData}){
  const o=typeof window!=="undefined"?window.location.origin:"";
  const bg=`${o}/letterhead-bg.png`,stamp=`${o}/approved-stamp.png`,sig=`${o}/quotation-signature.png`;
  const words=amountToWords(toNum(data.amount));

  return(<Document><Page size="A4" style={st.page}>
    <Image fixed src={bg} style={st.bg}/>
    <View fixed style={st.fll}><Link src="tel:+971551256488" style={st.pl}><Text style={st.ht}>p</Text></Link><Link src="mailto:info@nexayraarc.com" style={st.el}><Text style={st.ht}>e</Text></Link><Link src="https://nexayraarc.com/" style={st.wl}><Text style={st.ht}>w</Text></Link><Link src="https://instagram.com/nexayraarc" style={st.il}><Text style={st.ht}>i</Text></Link><Link src="https://www.linkedin.com/in/nexayra" style={st.ll}><Text style={st.ht}>l</Text></Link></View>
    <View style={st.ct}>
      <Text style={st.title}>CHEQUE RECEIPT</Text><View style={st.td}/>
      <View style={st.row}><Text style={st.label}>Date:</Text><View style={st.vl}><Text style={st.vt}>{data.date}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Received From:</Text><View style={st.vl}><Text style={st.vt}>{data.receivedFrom}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Amount:</Text><View style={st.vl}><Text style={st.vt}>AED {data.amount}</Text></View></View>
      <View style={st.row}><Text style={st.label}>In Words:</Text><View style={st.vl}><Text style={st.vt}>{words}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Cheque Number:</Text><View style={st.vl}><Text style={st.vt}>{data.chequeNumber}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Bank Name:</Text><View style={st.vl}><Text style={st.vt}>{data.bankName}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Cheque Date:</Text><View style={st.vl}><Text style={st.vt}>{data.chequeDate}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Purpose / Description:</Text><View style={st.vl}><Text style={st.vt}>{data.purposeDescription}</Text></View></View>
      <View style={st.sd}/>
      <View style={st.row}><Text style={st.label}>Received By:</Text><View style={st.vl}><Text style={st.vt}>{data.receivedBy}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Company Name:</Text><View style={st.vl}><Text style={st.vt}>{data.companyName}</Text></View></View>
      <View style={st.row}><Text style={st.label}>Signature & Stamp:</Text><View style={[st.sl,st.row,{alignItems:"flex-start"}]}><Image src={sig} style={st.si}/><Image src={stamp} style={st.sti}/></View></View>
      {(data.contactNumber||data.email)&&<><View style={st.sd}/>{data.contactNumber&&<View style={st.row}><Text style={st.label}>Contact:</Text><View style={st.vl}><Text style={st.vt}>{data.contactNumber}</Text></View></View>}{data.email&&<View style={st.row}><Text style={st.label}>Email:</Text><View style={st.vl}><Text style={st.vt}>{data.email}</Text></View></View>}</>}
    </View>
  </Page></Document>);
}

const st=StyleSheet.create({
  page:{fontSize:11,fontFamily:"Helvetica",color:"#1c2143",position:"relative",backgroundColor:"#fff"},
  bg:{position:"absolute",top:0,left:0,width:A4W,height:A4H,objectFit:"fill"},
  ct:{height:A4H,maxHeight:A4H,overflow:"hidden",display:"flex",flexDirection:"column",paddingTop:110,paddingLeft:54,paddingRight:54,paddingBottom:92,fontFamily:"Times-Roman"},
  title:{fontSize:21,fontWeight:"bold",fontFamily:"Times-Bold",color:"#1c2143",textAlign:"center",marginBottom:18},
  td:{borderBottomWidth:1.5,borderBottomColor:"#1c2143",marginBottom:18},
  sd:{borderBottomWidth:1,borderBottomColor:"#1c2143",marginTop:18,marginBottom:18},
  row:{flexDirection:"row",alignItems:"flex-start",marginBottom:14,gap:10},
  label:{width:140,fontWeight:"bold",color:"#1c2143",lineHeight:1.35,fontFamily:"Times-Bold"},
  vl:{flex:1,minHeight:22,borderBottomWidth:1,borderBottomColor:"#1c2143",justifyContent:"center",paddingBottom:4},
  sl:{flex:1,minHeight:40,borderBottomWidth:1,borderBottomColor:"#1c2143",justifyContent:"flex-start",paddingBottom:4},
  vt:{fontSize:11,color:"#1c2143",lineHeight:1.35},
  si:{width:90,height:34,objectFit:"contain",marginTop:8,marginBottom:4},
  sti:{width:60,height:60,objectFit:"contain",marginTop:8,marginBottom:4},
  fll:{position:"absolute",left:20,bottom:12,width:555,height:47},ht:{fontSize:1,color:"#fff",opacity:0},
  pl:{position:"absolute",left:8,top:18,width:80,height:12},el:{position:"absolute",left:86,top:18,width:120,height:12},
  wl:{position:"absolute",left:248,top:18,width:135,height:12},il:{position:"absolute",left:385,top:15,width:85,height:10},ll:{position:"absolute",left:385,top:27,width:145,height:10},
});
