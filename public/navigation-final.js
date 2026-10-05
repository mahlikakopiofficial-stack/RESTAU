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
.admin-final-nav #side{position:sticky!important;top:0!important;z-index:300!important;width:100%!important;min-height:64px!important;height:auto!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important;padding:8px 14px!important;overflow:visible!important;background:linear-gradient(180deg,#173f35,#12302a)!important;box-shadow:0 3px 14px #0003!important}
.admin-final-nav #side .admin-brand{position:static!important;display:flex!important;align-items:center!important;gap:9px!important;flex:0 0 auto!important;padding:0 8px!important;margin:0!important;border:0!important;background:transparent!important;color:#fff!important}
.admin-final-nav #side .admin-nav-toggle{display:none!important;margin-left:auto!important;flex:0 0 42px!important;width:42px!important;height:42px!important}
.admin-final-nav #side .admin-nav-menu{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:3px!important;margin-left:auto!important;min-width:0!important;flex:1 1 auto!important}
.admin-final-nav #side .admin-nav-menu button{width:auto!important;min-width:0!important;min-height:40px!important;padding:8px 10px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#fff!important;white-space:nowrap!important;font:600 .8rem/1.2 system-ui,sans-serif!important;text-align:center!important}
.admin-final-nav #side .admin-nav-menu button.on{background:#fff!important;color:#173f35!important}
.admin-final-nav #side .admin-nav-separator{width:1px!important;height:24px!important;margin:0 3px!important;background:#ffffff33!important}
@media(max-width:1180px){
 .admin-final-nav #side{min-height:58px!important;padding:7px 10px!important}
 .admin-final-nav #side .admin-nav-toggle{display:inline-flex!important;align-items:center!important;justify-content:center!important}
 .admin-final-nav #side .admin-nav-menu{position:absolute!important;top:58px!important;left:10px!important;right:10px!important;display:none!important;flex-direction:column!important;align-items:stretch!important;gap:3px!important;margin:0!important;padding:10px!important;background:#fff!important;border:1px solid #e5dccb!important;border-radius:13px!important;box-shadow:0 14px 35px #0003!important;max-height:calc(100vh - 72px)!important;overflow:auto!important;z-index:400!important}
 .admin-final-nav #side .admin-nav-menu.open{display:flex!important}
 .admin-final-nav #side .admin-nav-menu button{width:100%!important;min-height:42px!important;color:#173f35!important;text-align:left!important;padding:9px 12px!important}
 .admin-final-nav #side .admin-nav-menu button.on{background:#173f35!important;color:#fff!important}
 .admin-final-nav #side .admin-nav-separator{width:100%!important;height:1px!important;margin:5px 0!important;background:#e5dccb!important}
}
@media(max-width:600px){
 .admin-final-nav #side .admin-brand span{display:none!important}
 .admin-final-nav #side .admin-brand img{width:34px!important;height:34px!important}
 .admin-final-nav #side .admin-nav-menu{top:55px!important;left:8px!important;right:8px!important}
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
 window.toggleAdminNav=function(btn){
  const menu=document.getElementById('adminNavMenu');if(!menu)return;
  const open=!menu.classList.contains('open');menu.classList.toggle('open',open);
  if(btn){btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'×':'☰';btn.setAttribute('aria-label',open?'Close admin navigation':'Open admin navigation')}
 };
 const sync=()=>{
  const menu=document.getElementById('adminNavMenu'),toggle=document.querySelector('.admin-nav-toggle');if(!menu)return;
  if(innerWidth>1180){menu.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open admin navigation');if(toggle)toggle.textContent='☰'}
 };
 document.addEventListener('click',e=>{
  const side=document.getElementById('side'),menu=document.getElementById('adminNavMenu'),toggle=document.querySelector('.admin-nav-toggle');
  if(menu?.classList.contains('open')&&!side?.contains(e.target)){menu.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open admin navigation');if(toggle)toggle.textContent='☰'}
 });
 window.addEventListener('resize',sync,{passive:true});
 new MutationObserver(()=>sync()).observe(document.body,{childList:true,subtree:true});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();