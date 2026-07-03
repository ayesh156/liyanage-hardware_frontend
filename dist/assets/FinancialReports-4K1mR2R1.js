import{j as e}from"./radix-overlays-mgFlszew.js";import{a as o}from"./react-vendor-DZaizHy0.js";import{h as i,u as de,a as ce,j as P}from"./index-8DyguaE5.js";import{S as _}from"./searchable-select-ITpYPFI_.js";import{F as V,a0 as xe,l as pe,k as me,a1 as be,a8 as X,T as Q,a9 as ee,aa as he,ab as se,ac as ge,ad as ue,ae as fe,af as ve,S as we,C as ye,Y as je,ag as Ne,ah as ke,ai as $e,aj as Se,ak as re,al as Ce,am as te,h as Me,Z as le,g as Te,P as ne,an as De,ao as Fe}from"./ui-utils-DxHd8b9r.js";import{u as oe}from"./i18n-gCPBxaZM.js";import"./3d-DpNSVx5f.js";import"./radix-misc-B3jtMKJe.js";import"./inventory-data-DzSRidsq.js";import"./dialog-DqWyL4ue.js";function Le({currentPage:t,totalPages:a,onPageChange:b,totalItems:w,pageSize:M,theme:d="light",className:T,showPageNumbers:g=!0,maxVisiblePages:N=5}){const{t:l}=oe(),W=w>0?(t-1)*M+1:0,U=Math.min(t*M,w),L=()=>{if(a<=N)return Array.from({length:a},(j,k)=>k+1);const x=[],y=Math.floor(N/2);let S=Math.max(t-y,1),h=Math.min(S+N-1,a);h-S+1<N&&(S=Math.max(h-N+1,1)),S>1&&(x.push(1),S>2&&x.push("ellipsis"));for(let j=S;j<=h;j++)j!==1&&j!==a&&x.push(j);return h<a&&(h<a-1&&x.push("ellipsis"),x.push(a)),x};return a<=1?null:e.jsxs("div",{className:i("px-4 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl",d==="dark"?"border-slate-700/50 bg-slate-900/50":"border-slate-200 bg-slate-50",T),children:[e.jsxs("div",{className:i("text-sm",d==="dark"?"text-slate-400":"text-slate-500"),children:[l("pagination.showing")," ",e.jsx("span",{className:i("font-semibold",d==="dark"?"text-orange-400":"text-orange-600"),children:W})," ",l("pagination.to")," ",e.jsx("span",{className:i("font-semibold",d==="dark"?"text-orange-400":"text-orange-600"),children:U})," ",l("pagination.of")," ",e.jsx("span",{className:i("font-semibold",d==="dark"?"text-white":"text-slate-900"),children:w})," ",l("pagination.results")]}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx("button",{onClick:()=>b(1),disabled:t===1,className:i("p-2 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed",d==="dark"?"hover:bg-slate-700/80 text-slate-400 hover:text-orange-400 disabled:hover:bg-transparent disabled:hover:text-slate-500":"hover:bg-slate-200 text-slate-500 hover:text-orange-600 disabled:hover:bg-transparent disabled:hover:text-slate-400"),title:l("pagination.firstPage"),"aria-label":l("pagination.firstPage"),children:e.jsx(xe,{className:"w-4 h-4"})}),e.jsx("button",{onClick:()=>b(t-1),disabled:t===1,className:i("p-2 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed",d==="dark"?"hover:bg-slate-700/80 text-slate-400 hover:text-orange-400 disabled:hover:bg-transparent disabled:hover:text-slate-500":"hover:bg-slate-200 text-slate-500 hover:text-orange-600 disabled:hover:bg-transparent disabled:hover:text-slate-400"),title:l("pagination.previousPage"),"aria-label":l("pagination.previousPage"),children:e.jsx(pe,{className:"w-4 h-4"})}),g&&e.jsx("div",{className:"flex items-center gap-1.5 mx-2",children:L().map((x,y)=>x==="ellipsis"?e.jsx("span",{className:i("px-2 py-1 text-sm",d==="dark"?"text-slate-600":"text-slate-400"),children:"•••"},`ellipsis-${y}`):e.jsx("button",{onClick:()=>b(x),className:i("min-w-[38px] h-9 px-3 rounded-xl font-semibold text-sm transition-all duration-200",t===x?"bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/30":d==="dark"?"bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50":"bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"),"aria-label":`Go to page ${x}`,"aria-current":t===x?"page":void 0,children:x},x))}),e.jsx("button",{onClick:()=>b(t+1),disabled:t===a,className:i("p-2 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed",d==="dark"?"hover:bg-slate-700/80 text-slate-400 hover:text-orange-400 disabled:hover:bg-transparent disabled:hover:text-slate-500":"hover:bg-slate-200 text-slate-500 hover:text-orange-600 disabled:hover:bg-transparent disabled:hover:text-slate-400"),title:l("pagination.nextPage"),"aria-label":l("pagination.nextPage"),children:e.jsx(me,{className:"w-4 h-4"})}),e.jsx("button",{onClick:()=>b(a),disabled:t===a,className:i("p-2 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed",d==="dark"?"hover:bg-slate-700/80 text-slate-400 hover:text-orange-400 disabled:hover:bg-transparent disabled:hover:text-slate-500":"hover:bg-slate-200 text-slate-500 hover:text-orange-600 disabled:hover:bg-transparent disabled:hover:text-slate-400"),title:l("pagination.lastPage"),"aria-label":l("pagination.lastPage"),children:e.jsx(be,{className:"w-4 h-4"})})]})]})}function Re({data:t,columns:a,pageSize:b=10,currentPage:w=1,onPageChange:M,totalItems:d,title:T,icon:g,emptyState:N,theme:l="light",className:W,showHeader:U=!0,stickyHeader:L=!1,striped:x=!0,hoverable:y=!0,bordered:S=!0,compact:h=!1,loading:j=!1,getRowKey:k,onRowClick:R,rowClassName:z}){const[Z,A]=o.useState(1),C=M?w:Z,D=M||A,u=d??t.length,H=Math.ceil(u/b),E=o.useMemo(()=>{if(d!==void 0)return t;const f=(C-1)*b;return t.slice(f,f+b)},[t,C,b,d]);o.useEffect(()=>{!M&&C>1&&E.length===0&&t.length>0&&A(1)},[t.length,C,E.length,M]);const p=u>0?(C-1)*b+1:0,G=Math.min(C*b,u);return e.jsxs("div",{className:i("rounded-2xl border overflow-hidden",l==="dark"?"bg-slate-800 border-slate-700":"bg-white border-slate-200",W),children:[U&&(T||g)&&e.jsxs("div",{className:i("px-4 py-3 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2",l==="dark"?"border-slate-700 bg-slate-800/50":"border-slate-200 bg-slate-50"),children:[e.jsxs("div",{className:"flex items-center gap-2",children:[g||e.jsx(V,{className:i("w-5 h-5",l==="dark"?"text-slate-400":"text-slate-500")}),T&&e.jsx("span",{className:i("font-semibold",l==="dark"?"text-white":"text-slate-900"),children:T}),e.jsxs("span",{className:i("text-sm px-2 py-0.5 rounded-full",l==="dark"?"bg-slate-700 text-slate-300":"bg-slate-200 text-slate-600"),children:[u," records"]})]}),e.jsxs("div",{className:i("text-sm",l==="dark"?"text-slate-400":"text-slate-500"),children:["Showing ",p," - ",G," of ",u]})]}),j&&e.jsx("div",{className:i("flex items-center justify-center py-12",l==="dark"?"text-slate-400":"text-slate-500"),children:e.jsxs("div",{className:"flex flex-col items-center gap-3",children:[e.jsx("div",{className:"w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin"}),e.jsx("p",{className:"text-sm",children:"Loading data..."})]})}),!j&&e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full min-w-max",children:[e.jsx("thead",{className:i(L&&"sticky top-0 z-10",l==="dark"?"bg-slate-900/50":"bg-slate-50"),children:e.jsx("tr",{className:i("border-b",l==="dark"?"border-slate-700":"border-slate-200"),children:a.map(f=>e.jsx("th",{className:i("text-left font-semibold text-sm tracking-wide whitespace-nowrap",h?"py-2 px-3":"py-3 px-4",l==="dark"?"text-slate-300":"text-slate-700",f.headerClassName),children:f.header},f.id))})}),e.jsx("tbody",{children:E.length===0?e.jsx("tr",{children:e.jsx("td",{colSpan:a.length,className:i("py-12 text-center",l==="dark"?"text-slate-400":"text-slate-500"),children:e.jsxs("div",{className:"flex flex-col items-center gap-2",children:[N?.icon||e.jsx(V,{className:"w-12 h-12 opacity-30"}),e.jsx("p",{className:"font-medium",children:N?.title||"No data found"}),N?.description&&e.jsx("p",{className:"text-sm",children:N.description})]})})}):E.map((f,I)=>{const q=k?k(f,I):I,O=(C-1)*b+I;return e.jsx("tr",{onClick:R?()=>R(f,O):void 0,className:i("border-b transition-colors",l==="dark"?"border-slate-700/50":"border-slate-100",x&&I%2!==0&&(l==="dark"?"bg-slate-800/30":"bg-slate-50/50"),y&&(l==="dark"?"hover:bg-slate-700/30":"hover:bg-slate-50"),R&&"cursor-pointer",z?.(f,O)),children:a.map(B=>e.jsx("td",{className:i("whitespace-nowrap",h?"py-2 px-3":"py-3 px-4",B.className),children:B.cell(f,O)},B.id))},q)})})]})}),!j&&H>1&&e.jsx(Le,{currentPage:C,totalPages:H,onPageChange:D,totalItems:u,pageSize:b,theme:l})]})}const We=()=>{const{theme:t}=de(),{t:a}=oe(),b=ce();o.useRef(null);const[w,M]=o.useState("monthly"),[d,T]=o.useState(11),[g,N]=o.useState(2024),[l,W]=o.useState(null),[U,L]=o.useState(1),[x]=o.useState(12),[y,S]=o.useState(""),[h,j]=o.useState("all"),[k,R]=o.useState("all"),[z,Z]=o.useState("desc"),[A,C]=o.useState(!1),D=o.useMemo(()=>{const s=new Date(g,d,16);let n,r;switch(w){case"daily":n=new Date(s),n.setHours(0,0,0,0),r=new Date(s),r.setHours(23,59,59,999);break;case"weekly":n=new Date(s),n.setDate(s.getDate()-6),n.setHours(0,0,0,0),r=new Date(s),r.setHours(23,59,59,999);break;case"monthly":n=new Date(g,d,1),r=new Date(g,d+1,0);break;case"yearly":n=new Date(g,0,1),r=new Date(g,11,31);break}return{start:n,end:r}},[w,d,g]),u=o.useMemo(()=>P.filter(n=>{const r=new Date(n.date),$=r>=D.start&&r<=D.end,v=y===""||n.description.toLowerCase().includes(y.toLowerCase())||n.category.toLowerCase().includes(y.toLowerCase()),F=h==="all"||n.type===h,J=k==="all"||n.category===k;return $&&v&&F&&J}).sort((n,r)=>{const $=new Date(n.date).getTime(),v=new Date(r.date).getTime();return z==="asc"?$-v:v-$}),[D,y,h,k,z]),H=y!==""||h!=="all"||k!=="all",E=()=>{S(""),j("all"),R("all")},p=o.useMemo(()=>{const s=u.filter(v=>v.type==="revenue").reduce((v,F)=>v+F.amount,0),n=u.filter(v=>v.type==="expense").reduce((v,F)=>v+F.amount,0),r=s-n,$=s>0?r/s*100:0;return{revenue:s,expenses:n,profit:r,profitMargin:$}},[u]),G=o.useMemo(()=>{const s=new Set(P.map(n=>n.category));return Array.from(s)},[]),f=s=>({"Paint Sales":e.jsx(Fe,{className:"w-4 h-4 text-orange-500"}),"Cement Sales":e.jsx(ne,{className:"w-4 h-4 text-slate-500"}),Tools:e.jsx(te,{className:"w-4 h-4 text-blue-500"}),Electrical:e.jsx(le,{className:"w-4 h-4 text-yellow-500"}),Plumbing:e.jsx(De,{className:"w-4 h-4 text-cyan-500"}),Hardware:e.jsx(te,{className:"w-4 h-4 text-purple-500"}),"Safety Equipment":e.jsx(re,{className:"w-4 h-4 text-green-500"}),"Inventory Purchase":e.jsx(ne,{className:"w-4 h-4 text-indigo-500"}),Salaries:e.jsx(Te,{className:"w-4 h-4 text-pink-500"}),Utilities:e.jsx(le,{className:"w-4 h-4 text-amber-500"}),Transportation:e.jsx(Me,{className:"w-4 h-4 text-teal-500"}),Maintenance:e.jsx(te,{className:"w-4 h-4 text-red-500"}),Marketing:e.jsx(Ce,{className:"w-4 h-4 text-violet-500"}),Insurance:e.jsx(re,{className:"w-4 h-4 text-emerald-500"}),"Professional Fees":e.jsx(Se,{className:"w-4 h-4 text-sky-500"})})[s]||e.jsx($e,{className:"w-4 h-4 text-slate-400"}),I=o.useMemo(()=>{const s=P.reduce((r,$)=>(r[$.category]=(r[$.category]||0)+1,r),{}),n=[{value:"all",label:"All Categories",icon:e.jsx(X,{className:"w-4 h-4 text-slate-400"})}];return G.forEach(r=>{n.push({value:r,label:r,icon:f(r),count:s[r]})}),n},[G]),q=o.useMemo(()=>{const s=P.filter(r=>r.type==="revenue").length,n=P.filter(r=>r.type==="expense").length;return[{value:"all",label:a("financial.allTypes"),icon:e.jsx(X,{className:"w-4 h-4 text-slate-400"}),count:P.length},{value:"revenue",label:a("financial.revenueType"),icon:e.jsx(Q,{className:"w-4 h-4 text-emerald-500"}),count:s},{value:"expense",label:a("financial.expenseType"),icon:e.jsx(ee,{className:"w-4 h-4 text-red-500"}),count:n}]},[a]),O=o.useMemo(()=>{const s=["january","february","march","april","may","june","july","august","september","october","november","december"];return Array.from({length:12},(n,r)=>({value:r.toString(),label:a(`financial.${s[r]}`),icon:e.jsx(he,{className:"w-4 h-4 text-blue-500"})}))},[a]),B=o.useMemo(()=>[2022,2023,2024,2025].map(s=>({value:s.toString(),label:s.toString(),icon:e.jsx(se,{className:"w-4 h-4 text-purple-500"})})),[]);o.useEffect(()=>{L(1)},[y,h,k,w,d,g]);const ie=()=>{const s=ae[w],r=a(`financial.${["january","february","march","april","may","june","july","august","september","october","november","december"][d]}`)+` ${g}`,$=w==="yearly"?`${a("financial.annualReport")} - ${g}`:w==="monthly"?`${r} ${a("financial.report")}`:`${s} ${a("financial.report")}`,v=u.map((c,m)=>`
      <tr class="${m%2===0?"row-even":"row-odd"}">
        <td class="cell-index">${m+1}</td>
        <td class="cell-date">${new Date(c.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td>
        <td class="cell-type">
          <span class="type-badge ${c.type==="revenue"?"revenue-badge":"expense-badge"}">
            ${c.type==="revenue"?"↑ Revenue":"↓ Expense"}
          </span>
        </td>
        <td class="cell-category">${c.category}</td>
        <td class="cell-description">${c.description}</td>
        <td class="cell-payment">${c.paymentMethod?c.paymentMethod.replace("_"," ").replace(/\b\w/g,K=>K.toUpperCase()):"N/A"}</td>
        <td class="cell-amount ${c.type==="revenue"?"amount-revenue":"amount-expense"}">
          ${c.type==="revenue"?"+":"-"}Rs. ${c.amount.toLocaleString()}
        </td>
      </tr>
    `).join(""),F=u.reduce((c,m)=>(c[m.category]||(c[m.category]={revenue:0,expense:0,count:0}),m.type==="revenue"?c[m.category].revenue+=m.amount:c[m.category].expense+=m.amount,c[m.category].count++,c),{}),J=Object.entries(F).sort((c,m)=>m[1].revenue+m[1].expense-(c[1].revenue+c[1].expense)).slice(0,8).map(([c,m],K)=>`
        <tr class="${K%2===0?"row-even":"row-odd"}">
          <td>${c}</td>
          <td class="amount-revenue">Rs. ${m.revenue.toLocaleString()}</td>
          <td class="amount-expense">Rs. ${m.expense.toLocaleString()}</td>
          <td style="text-align: center; font-weight: 600;">${m.count}</td>
        </tr>
      `).join(""),Y=window.open("","","width=1200,height=800");Y&&(Y.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${$}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
              background: #f8fafc;
              min-height: 100vh;
              padding: 40px;
              color: #1e293b;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .container {
              max-width: 1000px;
              margin: 0 auto;
              background: white;
              border-radius: 16px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
              overflow: hidden;
            }
            
            /* Header */
            .header {
              padding: 32px 40px;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .logo-section {
              display: flex;
              align-items: center;
              gap: 14px;
              margin-bottom: 28px;
            }
            
            .logo {
              width: 52px;
              height: 52px;
              background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
              border-radius: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 26px;
            }
            
            .company-info {
              display: flex;
              flex-direction: column;
            }
            
            .company-name {
              font-size: 24px;
              font-weight: 700;
              color: #1e293b;
              letter-spacing: -0.3px;
            }
            
            .company-tagline {
              font-size: 14px;
              color: #94a3b8;
              font-weight: 500;
            }
            
            .report-title {
              font-size: 32px;
              font-weight: 700;
              color: #64748b;
              margin-bottom: 12px;
              letter-spacing: -0.5px;
            }
            
            .report-meta {
              display: flex;
              align-items: center;
              gap: 24px;
              color: #94a3b8;
              font-size: 14px;
              font-weight: 500;
            }
            
            .report-meta span {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            
            /* Metrics Grid */
            .metrics-section {
              padding: 32px 40px;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
            }
            
            .metric-card {
              padding: 20px 24px;
              border-radius: 12px;
              border: 1px solid #e5e7eb;
              background: white;
            }
            
            .metric-icon {
              font-size: 28px;
              margin-bottom: 16px;
              line-height: 1;
            }
            
            .metric-label {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #94a3b8;
              margin-bottom: 8px;
            }
            
            .metric-value {
              font-size: 26px;
              font-weight: 700;
              letter-spacing: -0.5px;
            }
            
            .metric-value.revenue-text { color: #10b981; }
            .metric-value.expense-text { color: #ef4444; }
            .metric-value.profit-text { color: #10b981; }
            .metric-value.margin-text { color: #10b981; }
            
            /* Category Breakdown */
            .breakdown-section {
              padding: 32px 40px;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .section-title {
              font-size: 16px;
              font-weight: 700;
              color: #1e293b;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            
            .section-icon {
              font-size: 18px;
            }
            
            /* Tables */
            .table-container {
              padding: 32px 40px;
            }
            
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              overflow: hidden;
            }
            
            .summary-table thead {
              background: #f8fafc;
            }
            
            .summary-table th {
              padding: 14px 20px;
              text-align: left;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #64748b;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .summary-table td {
              padding: 14px 20px;
              border-bottom: 1px solid #f1f5f9;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            
            thead {
              background: #f8fafc;
            }
            
            th {
              padding: 14px 16px;
              text-align: left;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #64748b;
              border-bottom: 1px solid #e5e7eb;
            }
            
            td {
              padding: 14px 16px;
              border-bottom: 1px solid #f1f5f9;
              vertical-align: middle;
            }
            
            .row-even { background: white; }
            .row-odd { background: #fafafa; }
            
            .cell-index {
              font-weight: 600;
              color: #94a3b8;
              width: 50px;
            }
            
            .cell-date {
              color: #64748b;
              font-weight: 500;
              white-space: nowrap;
            }
            
            .cell-category {
              font-weight: 600;
              color: #1e293b;
            }
            
            .cell-description {
              color: #64748b;
              max-width: 200px;
            }
            
            .cell-payment {
              color: #64748b;
              font-size: 12px;
            }
            
            .type-badge {
              display: inline-block;
              padding: 5px 12px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
            }
            
            .revenue-badge {
              background: #dcfce7;
              color: #15803d;
            }
            
            .expense-badge {
              background: #fee2e2;
              color: #dc2626;
            }
            
            .amount-revenue {
              color: #10b981;
              font-weight: 700;
              text-align: right;
            }
            
            .amount-expense {
              color: #ef4444;
              font-weight: 700;
              text-align: right;
            }
            
            .cell-amount {
              white-space: nowrap;
              text-align: right;
            }
            
            .table-header-bar {
              background: #f8fafc;
              padding: 16px 20px;
              border: 1px solid #e5e7eb;
              border-bottom: none;
              border-radius: 8px 8px 0 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .table-title {
              font-size: 16px;
              font-weight: 700;
              color: #1e293b;
            }
            
            .table-count {
              color: #64748b;
              font-size: 14px;
              font-weight: 500;
            }
            
            .transactions-table {
              border: 1px solid #e5e7eb;
              border-top: none;
              border-radius: 0 0 8px 8px;
              overflow: hidden;
            }
            
            /* Footer */
            .footer {
              padding: 20px 40px;
              background: #f8fafc;
              border-top: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .footer-left {
              font-size: 12px;
              color: #94a3b8;
            }
            
            .footer-right {
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
            }
            
            /* Print Styles */
            @media print {
              body { 
                background: white; 
                padding: 20px;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .container {
                box-shadow: none;
                border-radius: 0;
              }
              .metric-value.revenue-text { color: #10b981 !important; }
              .metric-value.expense-text { color: #ef4444 !important; }
              .metric-value.profit-text { color: #10b981 !important; }
              .metric-value.margin-text { color: #10b981 !important; }
              .amount-revenue { color: #10b981 !important; }
              .amount-expense { color: #ef4444 !important; }
              .revenue-badge { background: #dcfce7 !important; color: #15803d !important; }
              .expense-badge { background: #fee2e2 !important; color: #dc2626 !important; }
              @page {
                margin: 0.5cm;
                size: A4;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <div class="logo-section">
                <div class="logo">🔧</div>
                <div class="company-info">
                  <div class="company-name">Liyanage Hardware</div>
                  <div class="company-tagline">Hardware & Construction Materials</div>
                </div>
              </div>
              <div class="report-title">${$}</div>
              <div class="report-meta">
                <span>📅 ${D.start.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} - ${D.end.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span>
                <span>${u.length} Transactions</span>
              </div>
            </div>
            
            <!-- Metrics -->
            <div class="metrics-section">
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-icon">📈</div>
                  <div class="metric-label">Total Revenue</div>
                  <div class="metric-value revenue-text">Rs. ${p.revenue.toLocaleString()}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-icon">📉</div>
                  <div class="metric-label">Total Expenses</div>
                  <div class="metric-value expense-text">Rs. ${p.expenses.toLocaleString()}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-icon">💰</div>
                  <div class="metric-label">Net ${p.profit>=0?"Profit":"Loss"}</div>
                  <div class="metric-value profit-text">Rs. ${Math.abs(p.profit).toLocaleString()}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-icon">📊</div>
                  <div class="metric-label">Profit Margin</div>
                  <div class="metric-value margin-text">${p.profitMargin.toFixed(1)}%</div>
                </div>
              </div>
            </div>
            
            <!-- Category Breakdown -->
            <div class="breakdown-section">
              <div class="section-title">
                <span class="section-icon">📁</span>
                Category Breakdown (Top 8)
              </div>
              <table class="summary-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style="text-align: right;">Revenue</th>
                    <th style="text-align: right;">Expenses</th>
                    <th style="text-align: center;">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  ${J}
                </tbody>
              </table>
            </div>
            
            <!-- Transactions Table -->
            <div class="table-container">
              <div class="table-header-bar">
                <span class="table-title">📋 All Transactions</span>
                <span class="table-count">${u.length} records</span>
              </div>
              <table class="transactions-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Payment</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${v}
                </tbody>
              </table>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <div class="footer-left">
                Generated on ${new Date().toLocaleString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}
              </div>
              <div class="footer-right">
                Liyanage Hardware Financial Management System
              </div>
            </div>
          </div>
        </body>
        </html>
      `),Y.document.close(),Y.focus(),setTimeout(()=>{Y.print()},500))},ae={daily:a("financial.daily"),weekly:a("financial.weekly"),monthly:a("financial.monthly"),yearly:a("financial.yearly")};return e.jsx("div",{className:`min-h-screen p-6 ${b?"pb-24":""} ${t==="dark"?"bg-slate-900":"bg-slate-50"}`,children:e.jsxs("div",{className:"max-w-7xl mx-auto space-y-6",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("h1",{className:`text-2xl font-bold ${t==="dark"?"text-white":"text-slate-900"}`,children:a("financial.title")}),e.jsx("p",{className:`text-sm mt-1 ${t==="dark"?"text-slate-400":"text-slate-600"}`,children:a("financial.subtitle")})]}),e.jsxs("button",{onClick:ie,className:"no-print flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20",children:[e.jsx(ge,{className:"w-4 h-4"}),a("financial.exportPdf")]})]}),e.jsx("div",{className:`p-4 rounded-xl border ${t==="dark"?"bg-slate-800/50 border-slate-700/50":"bg-white border-slate-200 shadow-sm"}`,children:e.jsxs("div",{className:"no-print flex flex-wrap items-center gap-3",children:[e.jsx("div",{className:"flex gap-2",children:["daily","weekly","monthly","yearly"].map(s=>e.jsx("button",{onClick:()=>M(s),className:`px-4 py-2 rounded-lg font-medium transition-all ${w===s?"bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg":t==="dark"?"bg-slate-700 text-slate-300 hover:bg-slate-600":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`,children:ae[s]},s))}),e.jsx("div",{className:"w-40",children:e.jsx(_,{options:O,value:d.toString(),onValueChange:s=>T(parseInt(s)),placeholder:a("financial.selectMonth"),searchPlaceholder:a("financial.searchMonth"),emptyMessage:a("financial.noMonthFound"),theme:t})}),e.jsx("div",{className:"w-28",children:e.jsx(_,{options:B,value:g.toString(),onValueChange:s=>N(parseInt(s)),placeholder:a("financial.selectYear"),searchPlaceholder:a("financial.searchYear"),emptyMessage:a("financial.noYearFound"),theme:t})})]})}),e.jsxs("div",{id:"print-area",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8",children:[e.jsxs("div",{className:`p-6 rounded-2xl border ${t==="dark"?"bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20":"bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200"}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("div",{className:`w-12 h-12 rounded-xl flex items-center justify-center ${t==="dark"?"bg-emerald-500/20":"bg-emerald-100"}`,children:e.jsx(Q,{className:"w-6 h-6 text-emerald-500"})}),e.jsx("span",{className:`text-xs font-medium px-2 py-1 rounded-full ${t==="dark"?"bg-emerald-500/20 text-emerald-400":"bg-emerald-100 text-emerald-700"}`,children:"+12.5%"})]}),e.jsx("p",{className:`text-sm font-medium mb-1 ${t==="dark"?"text-slate-400":"text-slate-600"}`,children:a("financial.revenue")}),e.jsxs("p",{className:`text-3xl font-bold ${t==="dark"?"text-white":"text-slate-900"}`,children:["Rs. ",p.revenue.toLocaleString()]})]}),e.jsxs("div",{className:`p-6 rounded-2xl border ${t==="dark"?"bg-gradient-to-br from-red-500/10 to-pink-500/10 border-red-500/20":"bg-gradient-to-br from-red-50 to-pink-50 border-red-200"}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("div",{className:`w-12 h-12 rounded-xl flex items-center justify-center ${t==="dark"?"bg-red-500/20":"bg-red-100"}`,children:e.jsx(ee,{className:"w-6 h-6 text-red-500"})}),e.jsx("span",{className:`text-xs font-medium px-2 py-1 rounded-full ${t==="dark"?"bg-red-500/20 text-red-400":"bg-red-100 text-red-700"}`,children:"-5.2%"})]}),e.jsx("p",{className:`text-sm font-medium mb-1 ${t==="dark"?"text-slate-400":"text-slate-600"}`,children:a("financial.expenses")}),e.jsxs("p",{className:`text-3xl font-bold ${t==="dark"?"text-white":"text-slate-900"}`,children:["Rs. ",p.expenses.toLocaleString()]})]}),e.jsxs("div",{className:`p-6 rounded-2xl border ${p.profit>=0?t==="dark"?"bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20":"bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200":t==="dark"?"bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20":"bg-gradient-to-br from-orange-50 to-red-50 border-orange-200"}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("div",{className:`w-12 h-12 rounded-xl flex items-center justify-center ${p.profit>=0?t==="dark"?"bg-blue-500/20":"bg-blue-100":t==="dark"?"bg-orange-500/20":"bg-orange-100"}`,children:e.jsx(ue,{className:`w-6 h-6 ${p.profit>=0?"text-blue-500":"text-orange-500"}`})}),e.jsxs("span",{className:`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${p.profit>=0?t==="dark"?"bg-blue-500/20 text-blue-400":"bg-blue-100 text-blue-700":t==="dark"?"bg-orange-500/20 text-orange-400":"bg-orange-100 text-orange-700"}`,children:[p.profit>=0?e.jsx(fe,{className:"w-3 h-3"}):e.jsx(ve,{className:"w-3 h-3"}),p.profitMargin.toFixed(1),"%"]})]}),e.jsx("p",{className:`text-sm font-medium mb-1 ${t==="dark"?"text-slate-400":"text-slate-600"}`,children:a("financial.profit")}),e.jsxs("p",{className:`text-3xl font-bold ${p.profit>=0?t==="dark"?"text-white":"text-slate-900":"text-orange-500"}`,children:["Rs. ",p.profit.toLocaleString()]})]}),e.jsxs("div",{className:`p-6 rounded-2xl border ${t==="dark"?"bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20":"bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200"}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("div",{className:`w-12 h-12 rounded-xl flex items-center justify-center ${t==="dark"?"bg-purple-500/20":"bg-purple-100"}`,children:e.jsx(Q,{className:"w-6 h-6 text-purple-500"})}),e.jsx("span",{className:`text-xs font-medium px-2 py-1 rounded-full ${t==="dark"?"bg-purple-500/20 text-purple-400":"bg-purple-100 text-purple-700"}`,children:"Target: 25%"})]}),e.jsx("p",{className:`text-sm font-medium mb-1 ${t==="dark"?"text-slate-400":"text-slate-600"}`,children:a("financial.profitMargin")}),e.jsxs("p",{className:`text-3xl font-bold ${t==="dark"?"text-white":"text-slate-900"}`,children:[p.profitMargin.toFixed(1),"%"]})]})]}),e.jsxs("div",{className:`p-4 rounded-xl border mb-6 ${t==="dark"?"bg-slate-800/50 border-slate-700/50":"bg-white border-slate-200 shadow-sm"}`,children:[e.jsxs("div",{className:"flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row gap-3 flex-1 w-full",children:[e.jsxs("div",{className:"relative flex-1 sm:max-w-xs",children:[e.jsx(we,{className:`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t==="dark"?"text-slate-400":"text-slate-500"}`}),e.jsx("input",{type:"text",placeholder:a("financial.searchTransactions"),value:y,onChange:s=>S(s.target.value),className:`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all ${t==="dark"?"bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500":"bg-slate-50 border-slate-200"}`})]}),e.jsxs("button",{onClick:()=>C(!A),className:`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border ${H?"bg-orange-500 text-white border-orange-500":t==="dark"?"border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`,children:[e.jsx(X,{className:"w-4 h-4"}),a("common.filter"),H&&e.jsx("span",{className:"w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center",children:[h!=="all",k!=="all"].filter(Boolean).length}),e.jsx(ye,{className:`w-4 h-4 transition-transform ${A?"rotate-180":""}`})]}),H&&e.jsxs("button",{onClick:E,className:`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${t==="dark"?"text-slate-400 hover:text-white hover:bg-slate-700":"text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`,children:[e.jsx(je,{className:"w-3.5 h-3.5"}),a("financial.clearFilters")]})]}),e.jsx("div",{className:"flex items-center gap-2",children:e.jsx("button",{onClick:()=>Z(z==="asc"?"desc":"asc"),className:`p-2 rounded-lg border transition-colors ${t==="dark"?"border-slate-700 hover:bg-slate-800":"border-slate-200 hover:bg-slate-50"}`,children:z==="asc"?e.jsx(Ne,{className:"w-4 h-4"}):e.jsx(ke,{className:"w-4 h-4"})})})]}),A&&e.jsxs("div",{className:`flex flex-wrap gap-4 pt-4 mt-4 border-t ${t==="dark"?"border-slate-700/50":"border-slate-200"}`,children:[e.jsxs("div",{className:"flex-1 min-w-[180px]",children:[e.jsx("label",{className:`block text-xs font-medium mb-1.5 ${t==="dark"?"text-slate-400":"text-slate-500"}`,children:"Transaction Type"}),e.jsx(_,{options:q,value:h,onValueChange:s=>j(s),placeholder:"All Types",searchPlaceholder:"Search type...",emptyMessage:"No type found.",theme:t})]}),e.jsxs("div",{className:"flex-1 min-w-[180px]",children:[e.jsx("label",{className:`block text-xs font-medium mb-1.5 ${t==="dark"?"text-slate-400":"text-slate-500"}`,children:"Category"}),e.jsx(_,{options:I,value:k,onValueChange:R,placeholder:"All Categories",searchPlaceholder:"Search categories...",emptyMessage:"No category found.",theme:t})]})]})]}),e.jsx(Re,{data:u,columns:[{id:"date",header:a("tableHeaders.date"),cell:s=>e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(se,{className:`w-4 h-4 ${t==="dark"?"text-slate-500":"text-slate-400"}`}),e.jsx("span",{className:t==="dark"?"text-slate-400":"text-slate-600",children:new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})})]})},{id:"type",header:a("tableHeaders.type"),cell:s=>e.jsx("span",{className:`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.type==="revenue"?t==="dark"?"bg-emerald-500/20 text-emerald-400":"bg-emerald-100 text-emerald-700":t==="dark"?"bg-red-500/20 text-red-400":"bg-red-100 text-red-700"}`,children:s.type==="revenue"?e.jsxs(e.Fragment,{children:[e.jsx(Q,{className:"w-3 h-3"})," ",a("financial.revenueType")]}):e.jsxs(e.Fragment,{children:[e.jsx(ee,{className:"w-3 h-3"})," ",a("financial.expenseType")]})})},{id:"category",header:a("tableHeaders.category"),cell:s=>e.jsxs("div",{className:"flex items-center gap-2",children:[f(s.category),e.jsx("span",{className:`font-medium ${t==="dark"?"text-slate-300":"text-slate-700"}`,children:s.category})]})},{id:"description",header:a("tableHeaders.description"),cell:s=>e.jsx("span",{className:`max-w-xs truncate block ${t==="dark"?"text-slate-400":"text-slate-600"}`,children:s.description})},{id:"amount",header:a("tableHeaders.amount"),headerClassName:"text-right",className:"text-right",cell:s=>e.jsxs("span",{className:`font-bold ${s.type==="revenue"?"text-emerald-500":"text-red-500"}`,children:[s.type==="revenue"?"+":"-","Rs. ",s.amount.toLocaleString()]})}],pageSize:x,currentPage:U,onPageChange:L,title:a("financial.transactionHistory"),icon:e.jsx(V,{className:`w-5 h-5 ${t==="dark"?"text-slate-400":"text-slate-500"}`}),emptyState:{icon:e.jsx(V,{className:"w-12 h-12 opacity-30"}),title:a("financial.noTransactions"),description:a("financial.adjustFilters")},theme:t,getRowKey:s=>s.id})]})]})})};export{We as FinancialReports};
