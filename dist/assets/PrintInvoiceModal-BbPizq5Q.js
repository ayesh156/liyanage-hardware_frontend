const y={steel:"වානේ",iron:"යකඩ",copper:"තඹ",aluminum:"ඇලුමිනියම්",brass:"පිත්තල",metal:"ලෝහ",wire:"වයිරු",rod:"දණ්ඩ",pipe:"පයිපය",tube:"නලිකා",sheet:"තහඩු",plate:"ප්ලේට්",bar:"බාර්",bolt:"බෝල්ට්",nut:"නට්",screw:"ඉස්කුරුවी",nail:"ගස්",cable:"කේබල්",breaker:"බ්‍රේකර්",switch:"ස්විච්",socket:"සොකට්",bulb:"බල්බ්",light:"ආලෝකය",electric:"විදුලි",panel:"පැනලය",tap:"ටැප්",fitting:"සවිකිරීම",valve:"කපාటය",pump:"පම්පය",tank:"ටැංකිය",sink:"සින්ක්",paint:"පින්තුරු",wood:"දැව",timber:"කර දැව",brick:"ඉඩඩ",cement:"සිමෙන්",sand:"වැලි",stone:"ගල්",tile:"ටයිල්",glass:"වීදුරු",plastic:"ප්ලාස්ටික්",hammer:"මhammer",saw:"කර",drill:"කෝටුව",wrench:"එක්සත්",spanner:"స්පැනර්",plier:"ප්ලයර්",level:"නිම්නය",ruler:"පටිමාණ",tape:"ටේප්",knife:"පිත්තල",shovel:"බෙල්ල",pickaxe:"පිකස්",axe:"කිරුණ",broom:"ඉවුණ",mm:"මි.මී",cm:"සෙ.මී",inch:"අඟල්",foot:"පාදය",meter:"මීටර්",kg:"කි.ග්‍ර",liter:"ලීටර්",box:"බොක්ස්",impact:"ඉම්පැක්ට්",stanley:"ස්ටැන්ලි",fatmax:"ෆැට්මැක්ස්",black:"කළු",decker:"ඩෙකර්",makita:"මකිටා",bosch:"බොෂ්",dewalt:"ඩිවෝල්ට්",ingco:"ඉන්කෝ",total:"ටෝටල්"};function b(t){if(!t)return"";const a=t.toLowerCase().split(/\s+/),d=[];for(const s of a){const r=s.replace(/[^a-z0-9]/gi,"");if(y[r]){d.push(y[r]);continue}let o=!1;for(const[l,e]of Object.entries(y))if(r.includes(l)){const p=s.replace(new RegExp(l,"i"),e);d.push(p),o=!0;break}o||d.push(s)}return d.join(" ")}const S=(t,a,d="si")=>{const s=t.status==="paid",r=t.discount||0,o=t.receivedAmount||0,l=t.changeAmount||(o>0?Math.max(0,o-t.total):0),e=t.items.reduce((i,n)=>{const c=n,x=Number(c.displayPrice??c.originalPrice??n.unitPrice??0),f=Number(c.salesPrice??c.ourPrice??c.lastPrice??n.unitPrice??0),u=(x-f)*n.quantity;return i+(u>0?u:0)},0),p=!a||a.id==="walk-in",g=a?.name?a.nameSi||b(a.name):"සාමාන්‍ය පාරිභෝගිකයා",m=p?"":a?.phone??"",w=t.items.map(i=>{const n=i,c=i.productNameSi||b(i.productName),x=Number(n.displayPrice??n.originalPrice??i.unitPrice??0),f=Number(n.salesPrice??n.ourPrice??n.lastPrice??i.unitPrice??0),u=f*i.quantity,v=f<x,k=Number(i.quantity)%1===0?Number(i.quantity).toString():Number(i.quantity).toFixed(3).replace(/\.?0+$/,"");return`
      <div style="border-bottom:1px dashed #000;padding:4px 0;">
        <div style="font-weight:800;font-size:12px;color:#000;margin-bottom:2px;word-break:break-word;">${c}</div>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;font-family:'Courier New',monospace;color:#000;width:100%;">
          <span style="width:15%;text-align:left;flex-shrink:0;">${k}</span>
          <span style="width:25%;text-align:right;${v?"text-decoration:line-through;":""}color:#000;opacity:0.6;flex-shrink:0;">${x.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
          <span style="width:25%;text-align:right;font-weight:800;color:#000;flex-shrink:0;">${f.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
          <span style="width:35%;text-align:right;font-weight:900;color:#000;flex-shrink:0;">${u.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
        </div>
      </div>`}).join(""),h=e+r;return`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;700;900&display=swap');
  /* ════════════════════════════════════════════════════════
     THERMAL RECEIPT PRINT MASTER RESET — receiptGenerator
     Gradient fallback strategy: background-image:linear-gradient
     is NEVER stripped by any browser print engine.
     * color override REMOVED — it silently kills white text.
     ════════════════════════════════════════════════════════ */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  }
  /* ── Grand Total black box — gradient cannot be stripped ── */
  .wb {
    background-color: #000000 !important;
    background-image: linear-gradient(#000000, #000000) !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    border: 2px solid #000000 !important;
  }
  .wb, .wb *, .wb span, .wb div { color: #ffffff !important; }
  /* ── Paid badge — gradient black bg ── */
  .status-paid-text {
    background-color: #000000 !important;
    background-image: linear-gradient(#000000, #000000) !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    border: 2px solid #000000 !important;
    color: #ffffff !important;
  }
  .status-paid-text * { color: #ffffff !important; }
  hr { border: none !important; border-top: 1px dashed #000000 !important; }
  body {
    font-family: 'Segoe UI', 'Noto Sans Sinhala', Arial, sans-serif;
    background: #ffffff;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.4;
    width: 76mm;
    color: #000000;
  }
</style>
</head>
<body>
<div style="width:76mm;padding:2px;margin:0 auto;background:#fff;font-family:'Segoe UI','Noto Sans Sinhala',Arial,sans-serif;font-size:12px;font-weight:700;color:#000;">

  <!-- HEADER -->
  <div style="text-align:center;padding-bottom:4px;border-bottom:2px double #000;">
    <img src="/inv_logo.png" alt="" style="width:90px;height:auto;display:block;margin:0 auto;"/>
    <div style="margin:5px 0 3px;border-bottom:1px solid #000;padding-bottom:3px;">
      <div style="font-size:22px;font-weight:900;color:#000;line-height:1.1;">ලියනගේ හාඩ්වෙයාර්</div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#000;line-height:1.5;">
      හක්මන පාර, දෙයියන්දර<br/>
      දුරකථන: 0773751805 / 0412268217<br/>
      Email: liyanagehardware1986@gmail.com
    </div>
  </div>

  <!-- INVOICE META -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:2px dashed #000;">
    <div>
      <div style="font-size:10px;font-weight:700;">බිල්පත</div>
      <div style="font-size:13px;font-weight:800;font-family:'Courier New',monospace;">${t.invoiceNumber}</div>
    </div>
    <div style="text-align:center;">
      <div style="display:inline-block;padding:2px 6px;border:2px solid #000000;border-radius:3px;font-size:10px;font-weight:800;background-color:${s?"#000000":"#ffffff"} !important;background-image:${s?"linear-gradient(#000000,#000000)":"none"} !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;">
        <span style="color:${s?"#ffffff":"#000000"} !important;font-weight:800;">${s?"✓ ගෙවා ඇත":"○ ගෙවිය යුතු"}</span>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;font-weight:700;">දිනය</div>
      <div style="font-size:11px;font-weight:800;">${new Date(t.issueDate).toLocaleDateString("si-LK",{day:"2-digit",month:"short",year:"2-digit"})}</div>
    </div>
  </div>

  ${p?"":`
  <!-- CUSTOMER -->
  <div style="padding:3px 0;border-bottom:2px dashed #000;">
    <span style="font-size:10px;font-weight:700;">පාරිභෝගිකයා: </span>
    <span style="font-size:12px;font-weight:800;">${g}</span>
    ${m?`<span style="float:right;font-size:11px;font-weight:700;">${m}</span>`:""}
  </div>`}

  <!-- ITEMS HEADER -->
  <div style="padding:3px 0 2px;border-bottom:2px solid #000;">
    <div style="font-size:11px;font-weight:800;margin-bottom:3px;">භාණ්ඩය</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;font-family:'Courier New',monospace;width:100%;">
      <span style="width:15%;text-align:left;flex-shrink:0;">ප්‍රමාණය</span>
      <span style="width:25%;text-align:right;flex-shrink:0;">සඳහන් මිල</span>
      <span style="width:25%;text-align:right;flex-shrink:0;">අපේ මිල</span>
      <span style="width:35%;text-align:right;flex-shrink:0;">එකතුව</span>
    </div>
  </div>

  <!-- ITEMS -->
  <div style="padding:2px 0;">${w}</div>

  <!-- TOTALS -->
  <div style="border-top:2px solid #000;padding-top:4px;margin-top:2px;">
    ${r>0?`
    <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;font-weight:700;">
      <span>වට්ටම්</span>
      <span style="font-family:'Courier New',monospace;font-weight:800;">-${r.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
    </div>`:""}

    <!-- GRAND TOTAL -->
    <div class="wb" style="background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;color:#ffffff !important;padding:6px;margin-top:4px;border-radius:3px;border:2px solid #000000;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:15px;font-weight:800;color:#ffffff !important;">මුළු එකතුව</span>
        <span style="font-size:19px;font-weight:900;font-family:'Courier New',monospace;letter-spacing:1px;color:#ffffff !important;">${t.total.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
      </div>
    </div>

    <!-- ITEM COUNT -->
    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;font-weight:700;margin-top:2px;">
      <span>භාණ්ඩ සංඛ්‍යාව</span>
      <span style="font-weight:800;">[${t.items.reduce((i,n)=>i+n.quantity,0)}]</span>
    </div>

    ${h>0?`
    <!-- SAVINGS -->
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;font-weight:800;border-top:2px dashed #000;margin-top:4px;">
      <span>ඔබ ලැබූ ලාභය</span>
      <span style="font-family:'Courier New',monospace;font-weight:900;">${h.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
    </div>`:""}
  </div>

  ${o>0?`
  <!-- PAYMENT -->
  <div style="border-top:2px dashed #000;margin-top:4px;padding-top:4px;">
    <div style="border:1px solid #000;padding:4px 6px;border-radius:3px;">
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;font-weight:700;">
        <span>ගෙවූ මුදල</span>
        <span style="font-family:'Courier New',monospace;font-weight:800;">${o.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;font-weight:700;">
        <span>ඉතිරි මුදල</span>
        <span style="font-family:'Courier New',monospace;font-weight:800;">${l.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
      </div>
    </div>
  </div>`:""}

  <!-- CASHIER -->
  <div style="padding:3px 0;border-top:1px dashed #000;margin-top:3px;">
    <span style="font-size:11px;font-weight:700;">කැෂියර්: </span>
    <span style="font-size:11px;font-weight:800;">Admin</span>
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;padding-top:6px;border-top:2px dashed #000;">
    <div style="font-size:13px;font-weight:800;">ස්තූතියි නැවත එන්න !</div>
    <div style="margin:4px 0;border-top:1px solid #000;"></div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.3px;">Software by nebulainfinite - 078 3233 760</div>
  </div>

</div>
</body>
</html>`},j=(t,a,d="en")=>new Promise((s,r)=>{try{const o=S(t,a,d),l=document.getElementById("pos-print-iframe");l&&l.remove();const e=document.createElement("iframe");e.id="pos-print-iframe",e.style.cssText=["position:fixed","top:0","left:0","width:0","height:0","border:none","opacity:0","pointer-events:none","z-index:-9999"].join(";"),document.body.appendChild(e);const p=e.contentWindow?.document??e.contentDocument;if(!p){e.remove(),r(new Error("Cannot access iframe document"));return}p.open(),p.write(o),p.close();const g=()=>{try{e.contentWindow?.focus(),e.contentWindow?.print()}catch{}setTimeout(()=>{try{e.remove()}catch{}s()},1500)};e.contentDocument?.readyState==="complete"||e.contentWindow?.document?.readyState==="complete"?setTimeout(g,300):e.onload=()=>setTimeout(g,300)}catch(o){r(o)}});export{S as g,j as p};
