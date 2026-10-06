const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let CUR='KWD';const tk=k=>localStorage.getItem(k);
const API_ORIGIN=String(window.PINOY_RUNTIME?.apiOrigin||'').replace(/\/$/,'');
async function api(u,m='GET',b,key='ct'){const h={},fd=b instanceof FormData;if(b&&!fd)h['Content-Type']='application/json';if(tk(key))h.Authorization='Bearer '+tk(key);
const r=await fetch(API_ORIGIN+'/api'+u,{method:m,headers:h,body:b?(fd?b:JSON.stringify(b)):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Error '+r.status);return d}
window.api=api;
const money=n=>Number(n).toFixed(3)+' '+CUR;
const kuwaitDateTime=value=>{
  const raw=String(value??'').trim();
  if(!raw)return '';
  const isSqlDateTime=raw.length===19&&raw[4]==='-'&&raw[7]==='-'&&raw[10]===' '&&raw[13]===':'&&raw[16]===':';
  const iso=isSqlDateTime?raw.replace(' ','T')+'Z':raw;
  const d=new Date(iso);
  if(Number.isNaN(d.valueOf()))return raw;
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
};
window.kuwaitDateTime=kuwaitDateTime;
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),2800)}
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);

if(document.title.includes('Admin')){
  window.addEventListener('load',()=>{
    if(!document.getElementById('admin-fixes-style')){
      const css=document.createElement('link');css.rel='stylesheet';css.id='admin-fixes-style';css.href='/admin-fixes.css?v=20261003-1';document.head.appendChild(css);
    }
    if(!document.getElementById('admin-fixes-script')){
      const s=document.createElement('script');s.id='admin-fixes-script';s.src='/admin-fixes.js?v=20261003-1';document.head.appendChild(s);
    }
    if(!document.getElementById('admin-notify-script')){
      const n=document.createElement('script');n.id='admin-notify-script';n.src='/admin-notify.js?v=20261006-order1';document.head.appendChild(n);
    }
  },{once:true});
}

async function applyUniversalBranding(){
  const nodes=document.querySelectorAll("[data-brand-logo]");
  if(!nodes.length)return;
  try{
    const c=await api("/config","GET",null,"none");
    const src=c.logo_url||"/icons/pinoyambula.svg";
    nodes.forEach(node=>{
      const img=node.querySelector("img"), text=node.querySelector("span");
      if(img){
        img.src=src;
        img.alt=c.name||"PinoyAmbula";
        img.decoding="async";
        img.loading="eager";
        img.onerror=()=>{ if(img.src!==location.origin+"/icons/pinoyambula.svg") img.src="/icons/pinoyambula.svg"; };
      }
      if(text)text.textContent=c.name||"PinoyAmbula";
      node.setAttribute("aria-label",(c.name||"PinoyAmbula")+" home");
    });
  }catch(e){
    console.warn("UNIVERSAL_BRANDING_LOAD_FAILED",e.message);
  }
}
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",applyUniversalBranding,{once:true});
}else{
  applyUniversalBranding();
}
