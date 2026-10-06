(()=>{'use strict';
const isAdmin=location.pathname.endsWith('/admin.html')||location.pathname==='/admin.html'||location.hostname==='admin-pinoy-ambula.duckdns.org';
const css=`
/* FINAL NAV SYSTEM — one responsive layout, no competing legacy rules */
nav .wrap{width:min(1320px,100%);margin:0 auto;min-height:72px;display:flex!important;align-items:center!important;gap:10px!important;padding:0 18px!important}
nav .brand-logo{min-width:0;flex:0 1 auto!important;margin:0!important}
nav .home-nav-link{display:inline-flex!important;flex:0 0 auto!important}
nav #nl{display:flex!important;position:static!important;flex:1 1 auto!important;min-width:0!important;align-items:center!important;justify-content:flex-end!important;gap:3px!important;margin:0 0 0 auto!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important;max-height:none!important;flex-direction:row!important}
nav #nl li{flex:0 0 auto!important;margin:0!important}
nav #nl a,nav #nl .btn{min-height:40px!important;padding:8px 9px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;font-size:.8rem!important;border-radius:9px!important}
nav #burger{display:none!important;flex:0 0 40px!important;margin-left:0!important}
@media(max-width:1180px){
 nav .wrap{min-height:62px!important;padding:0 12px!important}
 nav .home-nav-link{display:none!important}
 nav #burger{display:inline-flex!important;align-items:center!important;justify-content:center!important}
 nav #nl{display:none!important;position:absolute!important;top:62px!important;left:12px!important;right:12px!important;width:auto!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:4px!important;margin:0!important;padding:10px!important;background:#fff!important;border:1px solid #e5dccb!important;border-radius:14px!important;box-shadow:0 16px 38px #0003!important;max-height:calc(100vh - 76px)!important;overflow:auto!important;z-index:200!important}
 nav #nl.open{display:flex!important}
 nav #nl li,nav #nl a,nav #nl .btn{width:100%!important}
 nav #nl a,nav #nl .btn{min-height:44px!important;text-align:center!important}
}
@media(max-width:600px){
 nav .wrap{padding:0 10px!important;gap:7px!important}
 nav .brand-logo{flex:1 1 auto!important;min-width:0!important}
 nav .brand-logo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 nav #burger{flex-basis:38px!important;width:38px!important;height:38px!important;min-width:38px!important}
 nav #nl{top:60px!important;left:8px!important;right:8px!important}
}
`;

function install(){
 if(document.getElementById('pa-final-nav-style'))return;
 const s=document.createElement('style');s.id='pa-final-nav-style';s.textContent=css;document.head.appendChild(s);
 document.documentElement.classList.toggle('admin-final-nav',isAdmin);
 if(isAdmin)setupAdmin();else setupPublic();
}
function setupPublic(){
 const nav=document.querySelector('nav'),list=document.getElementById('nl'),burger=document.getElementById('burger');
 if(!nav||!list||!burger)return;
 window.togglePublicNav=function(){
  const open=!list.classList.contains('open');list.classList.toggle('open',open);
  burger.setAttribute('aria-expanded',String(open));burger.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');burger.textContent=open?'×':'☰';
 };
 list.setAttribute('aria-label','Main navigation');
 list.addEventListener('click',e=>{if(e.target.closest('a'))close()});
 document.addEventListener('click',e=>{if(list.classList.contains('open')&&!nav.contains(e.target))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&list.classList.contains('open')){close();burger.focus()}});
 window.addEventListener('resize',()=>{if(innerWidth>1180)close()},{passive:true});
 function close(){list.classList.remove('open');burger.setAttribute('aria-expanded','false');burger.setAttribute('aria-label','Open navigation menu');burger.textContent='☰'}
}
function setupAdmin(){
 /* Admin navigation is owned by admin.html + admin-nav.css. Keep this file public-nav only. */
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();