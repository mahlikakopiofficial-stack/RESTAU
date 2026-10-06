const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let CUR='KWD';const tk=k=>localStorage.getItem(k);
const API_ORIGIN=String(window.PINOY_RUNTIME?.apiOrigin||'').replace(/\/$/,'');
const MEDIA_ORIGIN=String(window.PINOY_RUNTIME?.mediaOrigin||API_ORIGIN||'').replace(/\/$/,'');
const resolveMediaUrl=value=>{const raw=String(value??'').trim();if(!raw)return '';if(/^https?:\/\//i.test(raw))return raw;if(raw.startsWith('//'))return location.protocol+raw;return (MEDIA_ORIGIN||location.origin)+('/'+raw.replace(/^\/+/,''));};
async function api(u,m='GET',b,key='ct'){const h={},fd=b instanceof FormData;if(b&&!fd)h['Content-Type']='application/json';if(tk(key))h.Authorization='Bearer '+tk(key);const r=await fetch(API_ORIGIN+'/api'+u,{method:m,headers:h,body:b?(fd?b:JSON.stringify(b)):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Error '+r.status);return d}
window.api=api;
const money=n=>Number(n).toFixed(3)+' '+CUR;
const kuwaitParts=value=>{const raw=String(value??'').trim();if(!raw)return null;const isSqlDateTime=raw.length===19&&raw[4]==='-'&&raw[7]==='-'&&raw[10]===' '&&raw[13]===':'&&raw[16]===':';const iso=isSqlDateTime?raw.replace(' ','T')+'Z':raw;const d=new Date(iso);return Number.isNaN(d.valueOf())?null:d;};
const kuwaitDateTime=value=>{const raw=String(value??'').trim();if(!raw)return '';const d=kuwaitParts(raw);if(!d)return raw;return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);};
const kuwaitToday=()=>{const d=new Date();return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
window.kuwaitDateTime=kuwaitDateTime;window.kuwaitToday=kuwaitToday;window.kuwaitDateTime=kuwaitDateTime;
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),2800)}
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);

if(document.title.includes('Admin')){window.addEventListener('load',()=>{if(!document.getElementById('admin-fixes-style')){const css=document.createElement('link');css.rel='stylesheet';css.id='admin-fixes-style';css.href='/admin-fixes.css?v=20261003-1';document.head.appendChild(css);}if(!document.getElementById('admin-fixes-script')){const s=document.createElement('script');s.id='admin-fixes-script';s.src='/admin-fixes.js?v=20261006-chat6';document.head.appendChild(s);}if(!document.getElementById('admin-notify-script')){const n=document.createElement('script');n.id='admin-notify-script';n.src='/admin-notify.js?v=20261006-order1';document.head.appendChild(n);}if(!document.getElementById('admin-report-fix-script')){const r=document.createElement('script');r.id='admin-report-fix-script';r.src='/admin-report-fix.js?v=20261006-report3';document.head.appendChild(r);}}, {once:true});}

function installMenuPreviewUx(){if(window.__menuPreviewUxInstalled)return;window.__menuPreviewUxInstalled=true;const style=document.createElement('style');style.id='menu-preview-responsive-fix';style.textContent='dialog.master-lightbox{box-sizing:border-box;width:min(900px,94vw);max-width:94vw;max-height:92vh;margin:auto;overflow:auto}dialog.master-lightbox #menuPreviewBody,dialog.master-lightbox #masterLightboxBody{min-width:0}dialog.master-lightbox img,dialog.master-lightbox iframe{width:100%;max-width:100%;height:auto;max-height:70vh;min-height:0;object-fit:contain}dialog.master-lightbox #menuPreviewBody img{display:block;border-radius:10px}@media(max-width:600px){dialog.master-lightbox{width:calc(100vw - 20px);max-width:calc(100vw - 20px);max-height:94vh;padding:10px;border-radius:12px}dialog.master-lightbox img,dialog.master-lightbox iframe{max-height:58vh}dialog.master-lightbox .close-row{position:sticky;top:0;z-index:4;padding-bottom:6px}.close-row button{min-width:42px;min-height:42px}}';document.head.appendChild(style);document.addEventListener('click',event=>{const menu=document.getElementById('menuPreview');if(menu?.open)menu.close();},true);document.addEventListener('click',event=>{const media=document.getElementById('masterLightbox');if(media?.open&&event.target===media)media.close();});document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.getElementById('menuPreview')?.open&&document.getElementById('menuPreview').close();document.getElementById('masterLightbox')?.open&&document.getElementById('masterLightbox').close();}});}
if(document.title.includes('Admin'))window.addEventListener('DOMContentLoaded',installMenuPreviewUx,{once:true});else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installMenuPreviewUx,{once:true});else installMenuPreviewUx();

async function applyUniversalBranding(){
  const nodes=document.querySelectorAll('[data-brand-logo]');
  try{
    const c=await api('/config','GET',null,'none');
    const configured=String(c.logo_url||'').trim();
    const fallback='/icons/pinoyambula.svg';
    const configuredSrc=resolveMediaUrl(configured);
    const fallbackSrc=resolveMediaUrl(fallback);
    const src=configured?configuredSrc:fallbackSrc;
    const version=encodeURIComponent(configured||'fallback');
    nodes.forEach(node=>{
      const img=node.querySelector('img'),text=node.querySelector('span');
      if(img){
        img.src=src+(src.includes('?')?'&':'?')+'brand='+version;
        img.alt=c.name||'PinoyAmbula';
        img.decoding='async';
        img.loading='eager';
        img.onerror=()=>{if(img.src!==fallbackSrc)img.src=fallbackSrc;};
      }
      if(text)text.textContent=c.name||'PinoyAmbula';
      node.setAttribute('aria-label',(c.name||'PinoyAmbula')+' home');
    });
    document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(link=>{link.href=src+(src.includes('?')?'&':'?')+'brand='+version;});
    const manifest=document.querySelector('link[rel="manifest"]');
    if(manifest)manifest.href='/manifest.json?brand='+version;
    window.PINOY_BRANDING={logoUrl:src,name:c.name||'PinoyAmbula'};
    return window.PINOY_BRANDING;
  }catch(e){console.warn('UNIVERSAL_BRANDING_LOAD_FAILED',e.message);return null;}
}

window.saveUniversalLogo=async function(){
  const input=document.getElementById('logo-file');
  const file=input?.files?.[0];
  if(!file){toast('Choose a logo image first');return false;}
  if(!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)){toast('Logo must be PNG, JPG, WEBP or SVG');return false;}
  if(file.size>5*1024*1024){toast('Logo must be 5 MB or smaller');return false;}
  const button=document.querySelector('[onclick*="saveUniversalLogo"]');
  if(button)button.disabled=true;
  try{
    const fd=new FormData();fd.append('file',file,file.name);
    const result=await api('/admin/upload?target=logo','POST',fd,'at');
    if(!result?.url)throw new Error('Logo upload did not return a URL');
    const configured=result.url;
    const preview=document.getElementById('logo-preview');
    if(preview)preview.src=resolveMediaUrl(configured)+(configured.includes('?')?'&':'?')+'brand='+Date.now();
    const logoInput=document.querySelector('input[name="logo_url"]');
    if(logoInput)logoInput.value=configured;
    await applyUniversalBranding();
    if('serviceWorker' in navigator){try{const regs=await navigator.serviceWorker.getRegistrations();for(const reg of regs)await reg.update();}catch(_){} }
    toast('Universal logo uploaded and applied to customer + admin');
    input.value='';
    return true;
  }catch(e){toast('Logo upload failed: '+e.message);console.error('UNIVERSAL_LOGO_UPLOAD_FAILED',e);return false;}
  finally{if(button)button.disabled=false;}
}

// The customer page has an older inline applyCfg() which can overwrite the
// universal logo with a relative /uploads/... URL after app.js runs. Re-apply
// the canonical server media URL after config/render and whenever branding is
// changed, so website, PWA and native Capacitor surfaces stay identical.
function enforceUniversalBranding(){
  const branding=window.PINOY_BRANDING;
  if(!branding)return;
  document.querySelectorAll('[data-brand-logo] img').forEach(img=>{
    const current=String(img.getAttribute('src')||'');
    const target=branding.logoUrl+(branding.logoUrl.includes('?')?'&':'?')+'brand='+encodeURIComponent(branding.logoUrl);
    if(current!==target)img.src=target;
  });
  document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(link=>{
    const target=branding.logoUrl+(branding.logoUrl.includes('?')?'&':'?')+'brand='+encodeURIComponent(branding.logoUrl);
    if(link.href!==target)link.href=target;
  });
}
window.addEventListener('DOMContentLoaded',()=>{setTimeout(enforceUniversalBranding,0);setTimeout(enforceUniversalBranding,250);setTimeout(enforceUniversalBranding,1000);});
new MutationObserver(()=>enforceUniversalBranding()).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyUniversalBranding,{once:true});else applyUniversalBranding();