const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let CUR='KWD';const tk=k=>localStorage.getItem(k);
const API_ORIGIN=String(window.PINOY_RUNTIME?.apiOrigin||'').replace(/\/$/,'');
async function api(u,m='GET',b,key='ct'){const h={},fd=b instanceof FormData;if(b&&!fd)h['Content-Type']='application/json';if(tk(key))h.Authorization='Bearer '+tk(key);
const r=await fetch(API_ORIGIN+'/api'+u,{method:m,headers:h,body:b?(fd?b:JSON.stringify(b)):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Error '+r.status);return d}
const money=n=>Number(n).toFixed(3)+' '+CUR;
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),2800)}
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);

/* Admin-only runtime fixes are loaded after the existing admin inline UI has defined R/go/A. */
if(document.title.includes('Admin')){
  window.addEventListener('load',()=>{
    if(document.getElementById('admin-fixes-script'))return;
    const s=document.createElement('script');s.id='admin-fixes-script';s.src='/admin-fixes.js?v=20261003-1';document.head.appendChild(s);
  },{once:true});
}
