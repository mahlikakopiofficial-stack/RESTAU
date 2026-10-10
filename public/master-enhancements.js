/* AUTHORITATIVE PUBLIC NAV v2 — public navigation behavior is centralized here. */
/* Tested responsive breakpoint: @media(max-width:1180px) */
(function(){
'use strict';

const escm=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=(s,r=document)=>r.querySelector(s), $=(s,r=document)=>[...r.querySelectorAll(s)];
const kuwaitDateTime=window.kuwaitDateTime||((value)=>{
  const raw=String(value??'').trim(); if(!raw)return '';
  const isSqlDateTime=raw.length===19&&raw[4]==='-'&&raw[7]==='-'&&raw[10]===' '&&raw[13]===':'&&raw[16]===':';
  const iso=isSqlDateTime?raw.replace(' ','T')+'Z':raw;
  const d=new Date(iso); if(Number.isNaN(d.valueOf()))return raw;
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
});

function masterCss(){
  if(document.getElementById('master-enh-css'))return;
  const style=document.createElement('style');
  style.id='master-enh-css';
  style.textContent=[
    ':root{--pa-maroon:#7b2d26;--pa-gold:#f2c94c;--pa-cream:#fffaf0;--pa-deep:#24352f;--pa-sand:#ead8b7}',
    'body{background:var(--pa-cream);color:var(--pa-deep)}',
    '.banig{background-image:repeating-linear-gradient(45deg,rgba(123,45,38,.06) 0 8px,transparent 8px 16px),repeating-linear-gradient(-45deg,rgba(242,201,76,.08) 0 8px,transparent 8px 16px);height:10px}',
    '.site-nav{background:rgba(255,250,240,.96);border-bottom:1px solid rgba(123,45,38,.16);backdrop-filter:blur(10px)}',
    '.site-nav ul{gap:8px}',
    '.site-nav ul li>a,nav ul li>button:not(.master-nav-tool){min-height:38px;min-width:0;padding:8px 6px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:.76rem;line-height:1.1;text-decoration:none;box-sizing:border-box}',
    '.site-nav ul li>button:not(.master-nav-tool){border:1px solid rgba(123,45,38,.18);background:transparent;color:inherit;cursor:pointer}',
    '.site-nav ul li>.master-nav-tool{min-width:38px}',
    '@media(max-width:700px){.site-nav ul li>a,nav ul li>button:not(.master-nav-tool){width:100%;min-width:0}}',
    '.logo{color:var(--pa-maroon);font-weight:800}',
    '.hero{background-color:#123b37;border-bottom:5px solid var(--pa-gold)}',
    '.card{border:1px solid rgba(123,45,38,.12);box-shadow:0 8px 26px rgba(72,42,22,.08)}',
    '.btn{border-color:var(--pa-maroon);background:var(--pa-maroon)}',
    '.btn.y{background:var(--pa-gold);border-color:var(--pa-gold);color:#3c2b00}',
    '.btn.o{background:transparent;color:var(--pa-maroon)}',
    '.tabs button.on{background:var(--pa-maroon);color:#fff}',
    '.master-promo{background:var(--pa-maroon);color:#fff;padding:7px 0;border-bottom:2px solid var(--pa-gold);position:relative;z-index:30;overflow:hidden}',
    '.master-promo-inner{overflow:hidden;min-height:42px;display:block}',
    '.master-promo-track{display:flex;width:max-content;align-items:center;gap:48px;animation:pa-marquee 28s linear infinite}',
    '.master-promo-item{display:flex;align-items:center;gap:10px;white-space:nowrap}',
    '@keyframes pa-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
    '.master-promo:hover .master-promo-track{animation-play-state:paused}',
    '.master-promo img{width:34px;height:34px;object-fit:cover;border-radius:8px}',
    '.master-promo .promo-text{min-width:0}.master-promo strong{display:block}.master-promo span{font-size:.9rem;opacity:.92}',
    '.master-nav-tool{width:38px;height:38px;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#fff;border:1px solid rgba(123,45,38,.2);color:var(--pa-maroon);cursor:pointer}',
    '.master-fly{position:relative}.master-tooltip{position:absolute;right:0;top:44px;background:#fff;color:var(--pa-deep);border:1px solid #dccfb9;border-radius:12px;padding:10px 12px;width:220px;box-shadow:0 10px 28px #0002;display:none;z-index:80;font-size:.82rem;text-align:left}.master-fly.open .master-tooltip{display:block}',
    '.master-section{padding:56px 0}.master-section.alt{background:#f7eedf}',
    '.master-section .t h2{color:var(--pa-maroon)}',
    '.master-carousel{position:relative;overflow:hidden;border-radius:18px;background:#2b302f}',
    '.master-carousel-track{display:flex;transition:transform .45s ease;will-change:transform}',
    '.master-slide{flex:0 0 100%;position:relative;min-height:260px;background:#1f2423;color:#fff}',
    '.master-slide img,.master-slide iframe{display:block;width:100%;height:320px;object-fit:cover;border:0;pointer-events:none}',
    '.master-slide-hit{position:absolute;inset:0;background:transparent;border:0;cursor:pointer;z-index:1}',
    '.master-slide .caption{position:absolute;left:0;right:0;bottom:0;padding:30px 18px 16px;background:linear-gradient(transparent,rgba(0,0,0,.78))}',
    '.master-carousel-btn{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border:0;border-radius:50%;background:#fff;color:var(--pa-maroon);font-size:1.3rem;cursor:pointer;z-index:3}',
    '.master-carousel-btn.prev{left:10px}.master-carousel-btn.next{right:10px}',
    '.master-dots{display:flex;justify-content:center;gap:6px;margin:10px 0}.master-dot{width:9px;height:9px;border:0;border-radius:50%;background:#c7b99f}.master-dot.on{background:var(--pa-maroon)}',
    '.master-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:16px}',
    '.master-plan-card{height:100%;display:flex;flex-direction:column;overflow:hidden}',
    '.master-plan-card .p{display:flex;flex:1;flex-direction:column}',
    '.master-plan-image-public{display:block;width:100%;height:190px;object-fit:cover;background:var(--pa-sand)}',
    '.master-plan-image-empty{display:grid;place-items:center;font-size:3rem}',
    '.master-plan-includes{margin:8px 0 14px;padding-left:20px;line-height:1.5}',
    '.master-plan-card .btn{margin-top:auto}',
    '@media(min-width:900px){#plan-list{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}}',
    '@media(max-width:899px){#plan-list{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}}',
    '.master-item-media{height:190px;width:100%;object-fit:cover;border-radius:12px 12px 0 0;background:var(--pa-sand)}',
    '.master-lightbox{width:min(900px,94vw);max-width:900px;border:0;border-radius:16px;padding:14px;background:#121716;color:#fff}.master-lightbox::backdrop{background:rgba(0,0,0,.72)}',
    '.master-lightbox img,.master-lightbox iframe{display:block;width:100%;max-height:72vh;min-height:280px;object-fit:contain;border:0;border-radius:10px;background:#0b0d0c}',
    '.master-lightbox{margin:auto}',
    '.master-menu-photo{display:block;width:100%;padding:0;border:0;background:#ead8b7;cursor:pointer;min-height:190px;overflow:hidden;border-radius:12px 12px 0 0}.master-menu-photo img{display:block;width:100%;height:190px;object-fit:cover}.master-menu-card{cursor:pointer}.master-menu-card .menu-card-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.master-menu-card h3{cursor:pointer}.master-menu-card .menu-card-category{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 6px;font-size:.72rem;line-height:1.2;text-transform:uppercase;letter-spacing:.04em;color:#53655b;font-weight:700}.master-menu-card .menu-card-category span{opacity:.65;font-weight:600}.master-menu-card .menu-card-category b{display:inline-block;padding:4px 9px;border-radius:999px;background:#f3ead8;color:#7b2d26;font-weight:800}',
    '.master-lightbox .close-row{display:flex;justify-content:flex-end}.master-lightbox .close-row button{background:#fff;color:#222;border:0}',
    '.master-optin{display:flex!important;gap:8px;align-items:flex-start;margin:5px 0 9px;padding:3px 0;border:0;border-radius:0;background:transparent;font-size:.78rem;line-height:1.35;color:#53655b}.master-optin input{width:auto!important;flex:0 0 auto;margin:2px 0 0}',
    '.master-pos-preview{width:80mm!important;max-width:80mm!important}',
    '.master-admin-card{padding:16px;border:1px solid #e5dccb;border-radius:14px;background:#fff;margin-bottom:16px}',
    '#main .master-admin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}',
    '.master-status-ok{color:#1c6b41;font-weight:700}.master-status-off{color:#8a2b24;font-weight:700}',
    '.announcement-manager{display:flex;flex-direction:column;gap:10px}',
    '.announcement-manager h3{margin:0}',
    '.announcement-manager-head{display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '.announcement-manager-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.announcement-manager-list{display:grid;gap:16px}',
    '.announcement-image-wrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.announcement-image-wrap img{width:180px;height:100px;object-fit:cover;border-radius:10px;border:1px solid #ddd8cc}',
    '@media (prefers-reduced-motion: reduce){.master-carousel-track{transition:none!important}}',
  ].join('');
  document.head.appendChild(style);
}

function openMediaPreview(media){
  let d=document.getElementById('masterLightbox');
  if(!d){
    d=document.createElement('dialog');
    d.id='masterLightbox';
    d.className='master-lightbox';
    d.innerHTML='<div class="close-row"><button type="button" class="btn s o" aria-label="Close preview">✕</button></div><div id="masterLightboxBody"></div><p id="masterLightboxCaption"></p>';
    d.querySelector('button').addEventListener('click',()=>d.close());
    d.addEventListener('click',e=>{if(e.target===d)d.close()});
    document.body.appendChild(d);
  }
  const body=d.querySelector('#masterLightboxBody'),cap=d.querySelector('#masterLightboxCaption');
  if(media.media_type==='video'&&media.media_url)body.innerHTML='<iframe src="'+escm(media.media_url)+'" title="'+escm(media.title||media.caption||'Video preview')+'" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>';
  else body.innerHTML='<img src="'+escm(media.img||'/icons/pinoyambula.svg')+'" alt="'+escm(media.title||media.caption||'Preview')+'">';
  cap.textContent=media.title||media.caption||'';
  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
}

function addCartOptIn(){
  const cart=document.getElementById('cart');
  if(cart&&!cart.querySelector('[name="whatsapp_opt_in"]')){
    const phone=cart.querySelector('[name="phone"]');
    if(phone){
      const label=document.createElement('label');
      label.className='master-optin';
      label.innerHTML='<input type="checkbox" name="whatsapp_opt_in" value="1"><span>Send order updates on WhatsApp to this number. I confirm I use WhatsApp and want these notifications.</span>';
      phone.parentElement&&phone.parentElement.insertAdjacentElement('afterend',label);
    }
  }
}

function cartOutside(){
  if(window.__masterCartOutside)return;
  window.__masterCartOutside=true;
  document.addEventListener('pointerdown',e=>{
    const cart=document.getElementById('cart');
    if(!cart||!cart.classList.contains('open'))return;
    if(cart.contains(e.target))return;
    if(e.target.closest && e.target.closest('#cart-fab,[onclick*="cartT"]'))return;
    cart.classList.remove('open');document.documentElement.classList.remove('cart-open');document.body.classList.remove('cart-open');
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const cart=document.getElementById('cart');
      if(cart)cart.classList.remove('open');
    }
  });
}

async function addPromos(){
  const nav=document.querySelector('.site-nav');
  if(!nav)return;
  let rows=[];
  try{rows=await api('/announcements')}catch{return}
  let bar=document.getElementById('master-promos');
  if(!rows.length){bar?.remove();return}
  if(!bar){
    bar=document.createElement('div');
    bar.id='master-promos';bar.className='master-promo';
    bar.innerHTML='<div class="wrap master-promo-inner"><div id="masterPromoContent"></div></div>';
    nav.insertAdjacentElement('afterend',bar);
  }
  const renderItem=x=>'<div class="master-promo-item">'+(x.image?'<img src="'+escm(x.image)+'" alt="">':'')+
    '<div class="promo-text"><strong>'+escm(x.title)+'</strong><span>'+escm(x.message)+'</span></div>'+
    (x.cta_label&&x.cta_url?'<a class="btn s y" href="'+escm(x.cta_url)+'">'+escm(x.cta_label)+'</a>':'')+'</div>';
  const content=document.getElementById('masterPromoContent');
  content.className='master-promo-track';
  content.innerHTML=(rows.length>1?rows.concat(rows):rows).map(renderItem).join('');
  if(rows.length===1)content.style.animation='none';
}

async function refreshSubscriptionPlans(){
  const section=document.querySelector('#plans')?.closest('section');
  const list=document.getElementById('plan-list');
  if(!section||!list)return;
  try{
    const cfg=await api('/config');
    const rows=cfg.subscriptions_enabled?await api('/plans'):[];
    list.innerHTML=rows.map(p=>'<article class="card master-plan-card">'+
      (p.img?'<img class="master-plan-image-public" src="'+escm(p.img)+'" alt="'+escm(p.name)+'" loading="lazy">':'<div class="master-plan-image-public master-plan-image-empty" aria-hidden="true">🍽️</div>')+
      '<div class="p"><h3>'+escm(p.name)+'</h3><p>'+escm(p.desc||'')+'</p>'+
      '<p><b>'+escm(String(p.duration_days||26))+' days</b></p>'+
      (Array.isArray(p.includes)&&p.includes.length?'<ul class="master-plan-includes">'+p.includes.map(x=>'<li>'+escm(x)+'</li>').join('')+'</ul>':'')+
      '<p class="pr" style="font-size:1.4rem">'+money(p.price)+'</p><button class="btn" onclick="subOpen(\''+escm(p.id)+'\')">Subscribe</button></div></article>').join('');
  }catch{list.innerHTML='';}
  section.hidden=!rows.length;
}

async function addRegional(){
  if(document.getElementById('regional-favorites'))return;
  let rows=[];try{rows=await api('/regional-dishes')}catch{return}
  if(!rows.length)return;
  const plans=document.getElementById('plans');
  if(!plans)return;
  const s=document.createElement('section');s.id='regional-favorites';s.className='master-section alt';
  s.innerHTML='<div class="wrap"><div class="t"><h2>Regional Filipino Favorites</h2><p>Famous dishes from different regions of the Philippines.</p></div><div class="master-grid" id="regional-grid"></div></div>';
  plans.insertAdjacentElement('beforebegin',s);
  q('#regional-grid').innerHTML=rows.map(x=>{const stock=Math.max(0,Number(x.stock_available??3)),soldOut=stock<=0;return '<article class="card"><img class="master-item-media" src="'+escm(x.img||'/icons/pinoyambula.svg')+'" alt="'+escm(x.name)+'" loading="lazy"><div class="p"><div class="pill">'+escm(x.region)+'</div><h3>'+escm(x.name)+'</h3><p>'+escm(x.descr)+'</p>'+(+x.price>0?'<p class="pr">'+money(x.price)+'</p>':'')+'<p class="menu-stock-status" data-regional-stock-id="'+escm(x.id)+'" style="margin:.25rem 0;font-size:.85rem;color:'+(soldOut?'#b91c1c':'#667085')+'">'+(soldOut?'Sold Out':'')+'</p><button type="button" class="btn s" data-regional-id="'+escm(x.id)+'" '+(soldOut?'disabled':'')+'>'+(soldOut?'Sold Out':'Add to cart')+'</button></div></article>'}).join('');
  if(typeof window.setRegionalDishes==='function')window.setRegionalDishes(rows);
  q('#regional-grid').querySelectorAll('[data-regional-id]').forEach(btn=>btn.addEventListener('click',()=>{const dish=rows.find(x=>String(x.id)===String(btn.dataset.regionalId));if(dish&&typeof window.addRegionalToCart==='function')window.addRegionalToCart(dish);}));
}

async function addHeritage(){
  if(document.getElementById('heritage-section'))return;
  let rows=[];try{rows=await api('/heritage')}catch{return}
  if(!rows.length)return;
  const gallery=document.getElementById('gallery');
  if(!gallery)return;
  const s=document.createElement('section');s.id='heritage-section';s.className='master-section';
  s.innerHTML='<div class="wrap"><div class="t"><h2>Ancient Script &amp; Filipino Heritage</h2><p>Baybayin, heritage crafts, food traditions, bayanihan and Filipino cultural memory.</p></div><div class="master-carousel" id="heritage-carousel"><button class="master-carousel-btn prev" type="button" aria-label="Previous heritage item">‹</button><div class="master-carousel-track"></div><button class="master-carousel-btn next" type="button" aria-label="Next heritage item">›</button></div><div class="master-dots"></div></div>';
  gallery.insertAdjacentElement('beforebegin',s);
  buildCarousel(s.querySelector('.master-carousel'),s.querySelector('.master-dots'),rows);
}

async function addGalleryCarousel(){
  const root=document.getElementById('gal'),section=document.getElementById('gallery');
  if(!root||!section||root.dataset.carouselBound)return;
  root.dataset.carouselBound='1';
  let rows=[];try{rows=await api('/gallery')}catch{return}
  if(!rows.length){root.innerHTML='<p>No gallery items yet.</p>';return}
  const wrap=root.parentElement;
  root.innerHTML='<div class="master-carousel" id="gallery-carousel"><button class="master-carousel-btn prev" type="button" aria-label="Previous gallery item">‹</button><div class="master-carousel-track"></div><button class="master-carousel-btn next" type="button" aria-label="Next gallery item">›</button></div><div class="master-dots"></div>';
  buildCarousel(q('#gallery-carousel',root),q('.master-dots',wrap),rows);
}

function buildCarousel(carousel,dots,rows){
  const track=carousel.querySelector('.master-carousel-track');
  const slides=[rows[rows.length-1]].concat(rows,rows[0]);
  track.innerHTML=slides.map((x,i)=>{
    const media=x.media_type==='video'&&x.media_url
  ?'<iframe src="'+escm(x.media_url)+'" title="'+escm(x.caption||x.title||'Video')+'" loading="lazy" allow="encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>'
  :'<img src="'+escm(x.img||x.media_url||'/icons/pinoyambula.svg')+'" alt="'+escm(x.title||x.caption||'Heritage image')+'" loading="lazy" onerror="this.onerror=null;this.src=\'/icons/pinoyambula.svg\'">';
    return '<article class="master-slide" data-slide-index="'+i+'">'+media+'<button class="master-slide-hit" type="button" aria-label="Preview '+escm(x.title||x.caption||'gallery item')+'"></button><div class="caption"><strong>'+escm(x.title||x.caption||'PinoyAmbula')+'</strong><span> · Tap to preview</span></div></article>';
  }).join('');
  dots.innerHTML='';
  let index=1;
  const render=animate=>{
    track.style.transition=animate?'transform .45s ease':'none';
    track.style.transform='translateX(-'+(index*100)+'%)';
    [...dots.children].forEach((b,i)=>b.classList.toggle('on',i===((index-1+rows.length)%rows.length)));
  };
  rows.forEach((x,i)=>{const b=document.createElement('button');b.type='button';b.className='master-dot';b.setAttribute('aria-label','Go to item '+(i+1));b.addEventListener('click',()=>{index=i+1;render(true)});dots.appendChild(b)});
  carousel.querySelector('.prev').addEventListener('click',()=>{index--;render(true)});
  carousel.querySelector('.next').addEventListener('click',()=>{index++;render(true)});
  carousel.querySelectorAll('.master-slide-hit').forEach((b,logical)=>{
    b.addEventListener('click',()=>openMediaPreview(rows[logical===0?rows.length-1:logical-1>=rows.length?0:logical-1]));
  });
  track.addEventListener('transitionend',()=>{
    if(index===0){index=rows.length;render(false)}
    if(index===rows.length+1){index=1;render(false)}
  });
  render(false);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&rows.length>1){
    let timer=setInterval(()=>{index++;render(true)},6500);
    carousel.addEventListener('mouseenter',()=>clearInterval(timer));
    carousel.addEventListener('mouseleave',()=>{clearInterval(timer);timer=setInterval(()=>{index++;render(true)},6500)});
  }
}
function patchMenu(){
  if(typeof items==='undefined'||typeof itemPrice!=='function')return;
  const menuFallback=()=>((typeof config!=='undefined'&&config.menu_default_icon)||'/icons/pinoyambula.svg');
  const drinkFallback=()=>((typeof config!=='undefined'&&config.drink_default_icon)||'/icons/pinoyambula.svg');
  window.openMenuPreview=function(id){
    const i=items.find(x=>x.id==id);if(!i)return;
    const price=itemPrice(i),sale=price<i.price,src=i.img||((i.cat||'').toLowerCase()==='drinks'?drinkFallback():menuFallback());
    const stock=Math.max(0,Number(i.stock_available??3)),soldOut=stock<=0;
    let d=document.getElementById('menuPreview');
    if(!d){
      d=document.createElement('dialog');d.id='menuPreview';d.className='master-lightbox';
      d.innerHTML='<div class="close-row"><button type="button" class="btn s o" aria-label="Close menu preview">✕</button></div><div id="menuPreviewBody"></div>';
      d.querySelector('button').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d)d.close()});document.body.appendChild(d);
    }
    const ingredients=String(i.ingredients||'').trim();
    d.querySelector('#menuPreviewBody').innerHTML='<img src="'+escm(src)+'" alt="'+escm(i.name)+'"><h2>'+escm(i.name)+'</h2><div class="preview-meta"><span class="pill">'+escm(i.cat)+'</span><span class="pill">'+escm(i.region||'Filipino')+'</span></div><p>'+escm(i.descr)+'</p>'+(ingredients?'<section class="preview-ingredients"><h3>Ingredients</h3><p>'+escm(ingredients)+'</p></section>':'')+'<p class="pr">'+(sale?'<del>'+money(i.price)+'</del> ':'')+money(price)+'</p><p class="menu-stock-status" style="margin:.25rem 0;font-size:.85rem;color:'+(soldOut?'#b91c1c':'#667085')+'">'+(soldOut?'Sold Out':'')+'</p><button class="btn" type="button" '+(soldOut?'disabled':'')+'>'+(soldOut?'Sold Out':'Add to cart')+'</button>';
    d.querySelector('#menuPreviewBody button.btn').onclick=()=>{window.addMenuToCart(i.id);d.close()};
    if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
  };
  window.card=function(i){
    const price=itemPrice(i),sale=price<i.price,src=i.img||((i.cat||'').toLowerCase()==='drinks'?drinkFallback():menuFallback());
    const stock=Math.max(0,Number(i.stock_available??3)),soldOut=stock<=0;
    return '<article class="card master-menu-card" onclick="if(!event.target.closest(\'.btn\'))openMenuPreview('+i.id+')"><button type="button" class="master-menu-photo" aria-label="Preview '+escm(i.name)+'"><img src="'+escm(src)+'" alt="'+escm(i.name)+'"></button><div class="p"><div class="menu-card-category"><span>Category</span><b>'+escm(i.cat||'Menu')+'</b>'+(i.region&&i.cat==='Other Asian'?'<em> · '+escm(i.region)+'</em>':'')+'</div><h3>'+escm(i.name)+'</h3><p class="menu-description">'+escm(i.descr)+'</p><p class="menu-stock-status" style="margin:.25rem 0;font-size:.85rem;color:'+(soldOut?'#b91c1c':'#667085')+'">'+(soldOut?'Sold Out':'')+'</p><div class="menu-card-actions"><span class="menu-price">'+(sale?'<del>'+money(i.price)+'</del> <b>'+money(price)+'</b>':'<b>'+money(price)+'</b>')+'</span><button class="btn s menu-add" type="button" '+(soldOut?'disabled':'')+' onclick="window.addMenuToCart('+i.id+')" aria-label="Add '+escm(i.name)+' to cart">'+(soldOut?'Sold Out':'Add to cart')+'</button></div></div></article>';
  };
  try{renderMenu()}catch{}
  if(!window.__paInventoryRefreshStarted){
    window.__paInventoryRefreshStarted=true;
    let refreshingInventory=false;
    const refreshInventoryStatus=async()=>{
      if(refreshingInventory||document.hidden)return;
      refreshingInventory=true;
      try{
        const latestMenu=await api('/menu');
        if(Array.isArray(latestMenu)){
          latestMenu.forEach(row=>{const current=items.find(x=>Number(x.id)===Number(row.id));if(current)Object.assign(current,row)});
          try{renderMenu()}catch{}
        }
        const latestRegional=await api('/regional-dishes');
        if(Array.isArray(latestRegional)){
          if(typeof window.setRegionalDishes==='function')window.setRegionalDishes(latestRegional);
          const grid=document.getElementById('regional-grid');
          if(grid)latestRegional.forEach(row=>{
            const stock=Math.max(0,Number(row.stock_available??3)),soldOut=stock<=0;
            const button=grid.querySelector('[data-regional-id="'+Number(row.id)+'"]');
            if(button){button.disabled=soldOut;button.textContent=soldOut?'Sold Out':'Add to cart';}
            const label=grid.querySelector('[data-regional-stock-id="'+Number(row.id)+'"]');
            if(label){label.textContent=soldOut?'Sold Out':'';label.hidden=!soldOut;label.style.color='#b91c1c';}
          });
        }
      }catch{}
      finally{refreshingInventory=false}
    };
    window.addEventListener('focus',refreshInventoryStatus);
    window.setInterval(refreshInventoryStatus,20000);
  }
}
function addTheme(){
  document.documentElement.dataset.pinoyambulaTheme='heritage';
}

function setupPublicNavigation(){
  const nav=document.querySelector('.site-nav');
  const burger=document.getElementById('burger');
  const list=document.getElementById('nl');
  if(!nav||!burger||!list)return;
  if(window.__paNavReady)return;
  window.__paNavReady=true;
  window.togglePublicNav=function(button){
    const open=!list.classList.contains('open');
    list.classList.toggle('open',open);
    burger.setAttribute('aria-expanded',String(open));
    burger.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');
    burger.textContent=open?'✕':'☰';
    if(open)list.focus?.();
  };
  list.setAttribute('aria-label','Main navigation');
  list.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(!link)return;
    list.classList.remove('open');
    burger.setAttribute('aria-expanded','false');
    burger.setAttribute('aria-label','Open navigation menu');
    burger.textContent='☰';
  });
  document.addEventListener('click',event=>{
    if(!list.classList.contains('open'))return;
    if(nav.contains(event.target))return;
    list.classList.remove('open');
    burger.setAttribute('aria-expanded','false');
    burger.setAttribute('aria-label','Open navigation menu');
    burger.textContent='☰';
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&list.classList.contains('open')){
      list.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      burger.setAttribute('aria-label','Open navigation menu');
      burger.textContent='☰';
      burger.focus();
    }
  });
  const sync=()=>{
    if(window.innerWidth>1180){
      list.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      burger.setAttribute('aria-label','Open navigation menu');
      burger.textContent='☰';
    }
  };
  window.addEventListener('resize',sync,{passive:true});
  sync();
}

function siteBoot(){
  masterCss();setupPublicNavigation();addTheme();cartOutside();addCartOptIn();patchMenu();addPromos();refreshSubscriptionPlans();addRegional();addHeritage();addGalleryCarousel();
  if(!window.__masterPromoRefresh){
    window.__masterPromoRefresh=setInterval(()=>{if(!document.hidden)addPromos()},5000);
    window.addEventListener('focus',addPromos);
  }
  if(!window.__masterAnnouncementStorage){
    window.__masterAnnouncementStorage=true;
    window.addEventListener('storage',event=>{
      if(event.key==='pa-announcement-refresh')addPromos();
    });
  }
}

function masterSettingsFields(base,s){
  const extra='<h3 style="margin-top:22px">Customer experience</h3>'+
    '<label>Menu default image URL<input name="menu_default_icon" value="'+escm(s.menu_default_icon||'/icons/pinoyambula.svg')+'"></label>'+
    '<label>Drinks default image URL<input name="drink_default_icon" value="'+escm(s.drink_default_icon||'/icons/pinoyambula.svg')+'"></label>'+
    '<h3 style="margin-top:22px">Homepage banner adjustment</h3>'+
    '<label>Horizontal image position<input name="banner_position_x" type="range" min="0" max="100" value="'+escm(s.banner_position_x||50)+'" oninput="document.getElementById(\'banner-pos-x\').value=this.value+\'%\';document.getElementById(\'hdz\').style.backgroundPosition=this.value+\'% \'+document.querySelector(\'[name=banner_position_y]\').value+\'%\'"><output id="banner-pos-x">'+escm(s.banner_position_x||50)+'%</output></label>'+
    '<label>Vertical image position<input name="banner_position_y" type="range" min="0" max="100" value="'+escm(s.banner_position_y||50)+'" oninput="document.getElementById(\'banner-pos-y\').value=this.value+\'%\';document.getElementById(\'hdz\').style.backgroundPosition=document.querySelector(\'[name=banner_position_x]\').value+\'% \'+this.value+\'%\'"><output id="banner-pos-y">'+escm(s.banner_position_y||50)+'%</output></label>'+
    '<h3 style="margin-top:22px">Subscription service</h3>'+
    '<label><input type="checkbox" name="subscriptions_enabled" value="1" style="width:auto" '+(s.subscriptions_enabled!=='0'?'checked':'')+'> Enable subscriptions on the customer website</label>'+
    '<h3 style="margin-top:22px">POS customer receipt</h3>'+
    '<label>Receipt logo URL<input name="receipt_logo_url" value="'+escm(s.receipt_logo_url||'/icons/pinoyambula.svg')+'"></label>'+
    '<label>No refund policy<textarea name="receipt_no_refund" rows="2">'+escm(s.receipt_no_refund||'No refund after order confirmation.')+'</textarea></label>'+
    '<label>Exchange policy<textarea name="receipt_exchange_policy" rows="2">'+escm(s.receipt_exchange_policy||'Exchange only for verified order issues reported promptly.')+'</textarea></label>'+
    '<h3 style="margin-top:22px">Email notifications</h3><p id="masterEmailStatus">Checking Gmail delivery status…</p>'+
    '<p>Customer emails, admin order alerts, inquiry replies and newsletter broadcasts use Gmail OAuth credentials on the server.</p>'+
    '<h3 style="margin-top:22px">WhatsApp notifications</h3><p id="masterWaStatus">Checking provider status…</p>'+
    '<h3 style="margin-top:22px">Theme</h3>'+
    '<select name="theme_style"><option value="filipino-heritage" '+(s.theme_style!=='plain'?'selected':'')+'>Filipino heritage</option><option value="plain" '+(s.theme_style==='plain'?'selected':'')+'>Classic</option></select>';
  const pos=base.lastIndexOf('</form>');
  return pos>=0?base.slice(0,pos)+extra+base.slice(pos):base;
}

function adminBoot(){
  if(typeof R==='undefined'||typeof A==='undefined')return;
  // Notifications are delivered by the single persistent Admin SSE stream in admin-notify.js.
  const baseSettings=R.Settings;
  const announcementToApiDateTime=value=>{
    const raw=String(value||'').trim();
    if(!raw)return '';
    const isLocal=raw.length>=16&&raw[4]==='-'&&raw[7]==='-'&&raw[10]==='T';
    const date=new Date(isLocal?raw.slice(0,16)+':00+03:00':raw);
    if(Number.isNaN(date.valueOf()))throw new Error('Invalid announcement date/time');
    return date.toISOString().slice(0,19).replace('T',' ');
  };
  const announcementFromApiDateTime=value=>{
    const raw=String(value||'').trim();
    if(!raw)return '';
    const iso=raw.length===19&&raw[10]===' '?raw.replace(' ','T')+'Z':raw;
    const date=new Date(iso);
    if(Number.isNaN(date.valueOf()))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
    const get=k=>parts.find(p=>p.type===k)?.value||'';
    return get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute');
  };
  const announcementInputEsc=value=>escm(value||'');
  window.saveAnnouncement=async function(id,form){
    const data=Object.fromEntries(new FormData(form));
    data.active=form.elements.active?.checked?1:0;
    data.priority=Math.trunc(+data.priority||0);
    try{
      data.starts_at=announcementToApiDateTime(data.starts_at);
      data.ends_at=announcementToApiDateTime(data.ends_at);
      await A('/announcements/'+id,'PUT',data);
      toast('Announcement saved');
      go('Announcements');
      localStorage.setItem('pa-announcement-refresh',String(Date.now()));
    }catch(error){toast('Announcement save failed: '+error.message)}
  };
  window.createAnnouncement=async function(form){
    const data=Object.fromEntries(new FormData(form));
    data.active=form.elements.active?.checked?1:0;
    data.priority=Math.trunc(+data.priority||0);
    try{
      data.starts_at=announcementToApiDateTime(data.starts_at);
      data.ends_at=announcementToApiDateTime(data.ends_at);
      await A('/announcements','POST',data);
      toast('Announcement created');
      form.reset();
      form.elements.priority.value=0;
      form.elements.active.checked=true;
      go('Announcements');
      localStorage.setItem('pa-announcement-refresh',String(Date.now()));
    }catch(error){toast('Announcement create failed: '+error.message)}
  };
  window.toggleAnnouncement=async function(id,active){
    try{
      await A('/announcements/'+id,'PUT',{active:active?1:0});
      toast(active?'Announcement activated':'Announcement deactivated');
      go('Announcements');
      localStorage.setItem('pa-announcement-refresh',String(Date.now()));
    }catch(error){toast('Announcement status failed: '+error.message)}
  };
  window.deleteAnnouncement=async function(id){
    if(!confirm('Delete this announcement permanently?'))return;
    try{
      await A('/announcements/'+id,'DELETE');
      toast('Announcement deleted');
      go('Announcements');
      localStorage.setItem('pa-announcement-refresh',String(Date.now()));
    }catch(error){toast('Announcement delete failed: '+error.message)}
  };
  window.addAnnouncementImage=async function(id){
    const input=document.createElement('input');
    input.type='file'; input.accept='image/jpeg,image/png,image/webp,image/gif';
    input.onchange=async()=>{
      if(!input.files[0])return;
      try{
        const fd=new FormData(); fd.append('file',input.files[0]);
        await A('/upload?target=announcement&id='+encodeURIComponent(id),'POST',fd);
        toast('Announcement image saved');
        go('Announcements');
      }catch(error){toast('Announcement image failed: '+error.message)}
    };
    input.click();
  };
  window.removeAnnouncementImage=async function(id){
    try{
      await A('/image','DELETE',{target:'announcement',id});
      toast('Announcement image removed');
      go('Announcements');
    }catch(error){toast('Announcement image removal failed: '+error.message)}
  };
  R['Announcements']=async function(){
    const rows=await A('/announcements');
    const createForm='<form class="master-admin-card announcement-manager" onsubmit="event.preventDefault();createAnnouncement(this)">'+
      '<h3>Create announcement</h3>'+
      '<p class="small">Create one announcement, then manage it from its own card. Save changes only when you press Save.</p>'+
      '<div class="master-admin-grid">'+
      '<label>Title<input name="title" required maxlength="160" placeholder="Announcement title"></label>'+
      '<label>Priority<input name="priority" type="number" step="1" value="0"></label>'+
      '<label>Start<input name="starts_at" type="datetime-local"></label>'+
      '<label>End<input name="ends_at" type="datetime-local"></label></div>'+
      '<label>Message<textarea name="message" rows="4" required maxlength="1000" placeholder="Announcement message"></textarea></label>'+
      '<div class="master-admin-grid"><label>CTA label<input name="cta_label" maxlength="80" placeholder="Order now"></label>'+
      '<label>CTA URL<input name="cta_url" maxlength="500" placeholder="/#menu or https://..."></label></div>'+
      '<label><input type="checkbox" name="active" value="1" checked style="width:auto"> Active</label>'+
      '<button class="btn" type="submit">Create announcement</button></form>';
    const cards=rows.map(a=>{
      const image=a.image?'<div class="announcement-image-wrap"><img src="'+announcementInputEsc(a.image)+'" alt="Announcement image"><button class="btn s o" type="button" onclick="removeAnnouncementImage('+a.id+')">Remove image</button></div>':'<button class="btn s o" type="button" onclick="addAnnouncementImage('+a.id+')">Add image</button>';
      return '<form class="master-admin-card announcement-manager" onsubmit="event.preventDefault();saveAnnouncement('+a.id+',this)">'+
        '<div class="announcement-manager-head"><h3>Announcement #'+a.id+'</h3><span class="'+(a.active?'master-status-ok':'master-status-off')+'">'+(a.active?'ACTIVE':'INACTIVE')+'</span></div>'+
        '<div class="master-admin-grid">'+
        '<label>Title<input name="title" required maxlength="160" value="'+announcementInputEsc(a.title)+'"></label>'+
        '<label>Priority<input name="priority" type="number" step="1" value="'+(Number(a.priority)||0)+'"></label>'+
        '<label>Start<input name="starts_at" type="datetime-local" value="'+announcementFromApiDateTime(a.starts_at)+'"></label>'+
        '<label>End<input name="ends_at" type="datetime-local" value="'+announcementFromApiDateTime(a.ends_at)+'"></label></div>'+
        '<label>Message<textarea name="message" rows="4" required maxlength="1000">'+announcementInputEsc(a.message)+'</textarea></label>'+
        '<div class="master-admin-grid"><label>CTA label<input name="cta_label" maxlength="80" value="'+announcementInputEsc(a.cta_label)+'"></label>'+
        '<label>CTA URL<input name="cta_url" maxlength="500" value="'+announcementInputEsc(a.cta_url)+'"></label></div>'+
        '<label><input type="checkbox" name="active" value="1" '+(a.active?'checked':'')+' style="width:auto"> Active</label>'+
        '<div class="announcement-manager-actions">'+
        '<button class="btn" type="submit">Save changes</button>'+
        '<button class="btn s o" type="button" onclick="toggleAnnouncement('+a.id+','+(a.active?0:1)+')">'+(a.active?'Deactivate':'Activate')+'</button>'+
        image+
        '<button class="btn s o" type="button" onclick="deleteAnnouncement('+a.id+')">Delete</button>'+
        '</div></form>';
    }).join('');
    return createForm+'<h3>Saved announcements</h3><div class="announcement-manager-list">'+(cards||'<p class="small">No announcements yet.</p>')+'</div>';
  };
  R['Regional Dishes']=async function(){
    const rows=await A('/regional-dishes');
    return '<form class="master-admin-card" onsubmit="event.preventDefault();masterAddRegional(this)"><h3>Add regional Filipino dish</h3><div class="master-admin-grid"><label>Name<input name="name" required></label><label>Region<input name="region" required></label><label>Price<input name="price" type="number" step="0.001" min="0" value="0"></label><label>Available today<input name="stock_available" type="number" min="0" step="1" value="3"></label><label>Daily restock quantity<input name="daily_restock_quantity" type="number" min="0" step="1" value="3"></label><label>Sort order<input name="sort_order" type="number" value="0"></label></div><label>Description<textarea name="descr" rows="2"></textarea></label><button class="btn">Add dish</button></form>'+
      tbl(rows,[['Name',x=>'<input value="'+escm(x.name)+'" onchange="A(&#39;/regional-dishes/'+x.id+'&#39;,&#39;PUT&#39;,{name:this.value}).then(()=>toast(&#39;Saved&#39;))">'],['Region',x=>'<input value="'+escm(x.region)+'" onchange="A(&#39;/regional-dishes/'+x.id+'&#39;,&#39;PUT&#39;,{region:this.value}).then(()=>toast(&#39;Saved&#39;))">'],['Description',x=>'<textarea rows="2" onchange="A(&#39;/regional-dishes/'+x.id+'&#39;,&#39;PUT&#39;,{descr:this.value})">'+escm(x.descr)+'</textarea>'],['Price',x=>'<input type="number" step="0.001" value="'+x.price+'" onchange="A(&#39;/regional-dishes/'+x.id+'&#39;,&#39;PUT&#39;,{price:+this.value}).then(()=>toast(&#39;Saved&#39;))">'],['Available today',x=>'<input type="number" min="0" step="1" value="'+Number(x.stock_available??3)+'" onchange="A(&#39;/regional-dishes/'+x.id+'&#39;,&#39;PUT&#39;,{stock_available:+this.value}).then(()=>toast(&#39;Saved&#39;))">'],['Daily restock quantity',x=>'<input type="number" min="0" step="1" value="'+Number(x.daily_restock_quantity??3)+'" onchange="A(&#39;/regional-dishes/'+x.id+'&#39;,&#39;PUT&#39;,{daily_restock_quantity:+this.value}).then(()=>toast(&#39;Saved&#39;))">'],['Available',x=>'<input type="checkbox" style="width:auto" '+(x.active?'checked':'')+' onchange="A(&#39;/regional-dishes/'+x.id+'&#39;,&#39;PUT&#39;,{active:this.checked?1:0}).then(()=>toast(&#39;Saved&#39;))">'],['Image',x=>'<div class="drop master-reg-image" data-id="'+x.id+'" style="height:80px;'+(x.img?'background:url(&#39;'+escm(x.img)+'&#39;) center/cover;color:#fff':'')+'">'+(x.img?'Replace image':'⬆ Add image')+'</div>'],['',x=>'<button class="btn s o" type="button" onclick="masterDelete(&#39;/regional-dishes/'+x.id+'&#39;,&#39;Regional Dishes&#39;)">Delete</button>']]);
  };
  R['Heritage']=async function(){
    const rows=await A('/heritage');
    return '<form class="master-admin-card" onsubmit="event.preventDefault();masterAddHeritage(this)"><h3>Ancient Script & Filipino Heritage</h3><div class="master-admin-grid"><label>Title<input name="title" required></label><label>Media type<select name="media_type"><option value="image">Image</option><option value="video">Video</option></select></label><label>Video/media URL<input name="media_url" placeholder="https://..."></label><label>Sort order<input name="sort_order" type="number" value="0"></label></div><label>Caption<textarea name="caption" rows="2"></textarea></label><button class="btn">Add heritage item</button></form>'+
      tbl(rows,[['Title',x=>'<input value="'+escm(x.title)+'" onchange="A(&#39;/heritage/'+x.id+'&#39;,&#39;PUT&#39;,{title:this.value}).then(()=>toast(&#39;Saved&#39;))">'],['Type',x=>'<select onchange="A(&#39;/heritage/'+x.id+'&#39;,&#39;PUT&#39;,{media_type:this.value}).then(()=>toast(&#39;Saved&#39;))"><option '+(x.media_type==='image'?'selected':'')+'>image</option><option '+(x.media_type==='video'?'selected':'')+'>video</option></select>'],['Caption',x=>'<textarea rows="2" onchange="A(&#39;/heritage/'+x.id+'&#39;,&#39;PUT&#39;,{caption:this.value})">'+escm(x.caption)+'</textarea>'],['Media URL',x=>'<input value="'+escm(x.media_url||'')+'" onchange="A(&#39;/heritage/'+x.id+'&#39;,&#39;PUT&#39;,{media_url:this.value})">'],['Image',x=>'<div class="drop master-her-image" data-id="'+x.id+'" style="height:80px;'+(x.img?'background:url(&#39;'+escm(x.img)+'&#39;) center/cover;color:#fff':'')+'">'+(x.img?'Replace image':'⬆ Add image')+'</div>'],['Active',x=>'<input type="checkbox" style="width:auto" '+(x.active?'checked':'')+' onchange="A(&#39;/heritage/'+x.id+'&#39;,&#39;PUT&#39;,{active:this.checked?1:0}).then(()=>toast(&#39;Saved&#39;))">'],['',x=>'<button class="btn s o" type="button" onclick="masterDelete(&#39;/heritage/'+x.id+'&#39;,&#39;Heritage&#39;)">Delete</button>']]);
  };
  R.Settings=async function(){
    const base=await baseSettings();
    const s=await A('/settings');
    const status=await A('/notification-status').catch(()=>({emailConfigured:false,adminEmailConfigured:false,whatsapp:{configured:false}}));
    const wa=status.whatsapp;
    const out=masterSettingsFields(base,s);
    const hook=A_after;
    A_after=()=>{
      if(hook)hook();
      const el=document.getElementById('masterWaStatus');
      if(el)el.innerHTML=wa.configured?'<span class="master-status-ok">WhatsApp provider configured'+(wa.templateConfigured?' with approved template '+escm(wa.templateName):'')+'</span>'+(wa.templateConfigured?'':'<p>For registration and order messages outside the 24-hour customer-service window, configure an approved WhatsApp template in the server environment.</p>'):'<span class="master-status-off">WhatsApp provider not configured — set the access token and phone-number ID on the server.</span>';
      const email=document.getElementById('masterEmailStatus');
      if(email)email.innerHTML=status.emailConfigured&&status.adminEmailConfigured?'<span class="master-status-ok">Gmail OAuth is configured for customer and admin email.</span>':'<span class="master-status-off">Email notifications are not fully configured. Set GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and GMAIL_ADMIN_NOTIFY_TO (or GMAIL_USER).</span>';
    };
    return out;
  };
  window.masterAddAnnouncement=async form=>{
    const d=Object.fromEntries(new FormData(form));
    d.active=form.elements.active.checked?1:0;
    try{
      d.starts_at=announcementToApiDateTime(d.starts_at);
      d.ends_at=announcementToApiDateTime(d.ends_at);
      await A('/announcements','POST',d);
      toast('Announcement added');
      form.reset();
      form.elements.priority.value=0;
      form.elements.active.checked=true;
      go('Announcements');
      localStorage.setItem('pa-announcement-refresh',String(Date.now()));
      if(typeof addPromos==='function')addPromos();
    }catch(e){toast('Announcement could not be saved: '+e.message)}
  };
  window.masterSetAnnouncementActive=async(id,checkbox)=>{
    const active=checkbox.checked?1:0;
    checkbox.disabled=true;
    try{
      await A('/announcements/'+id,'PUT',{active});
      toast(active?'Announcement activated':'Announcement paused');
      go('Announcements');
      localStorage.setItem('pa-announcement-refresh',String(Date.now()));
      if(typeof addPromos==='function')addPromos();
    }catch(error){
      checkbox.checked=!checkbox.checked;
      toast('Announcement update failed: '+error.message);
    }finally{checkbox.disabled=false}
  };
  window.masterSetSubscriptionsEnabled=async checkbox=>{
    const enabled=checkbox.checked;
    checkbox.disabled=true;
    try{
      await A('/settings','PUT',{subscriptions_enabled:enabled?1:0});
      toast(enabled?'Subscription service enabled':'Subscription service disabled');
    }catch(error){
      checkbox.checked=!enabled;
      toast('Subscription setting failed: '+error.message);
    }finally{checkbox.disabled=false}
  };
  window.addAdminPlan=async function(e){
    e.preventDefault();
    const f=e.target,b=Object.fromEntries(new FormData(f));
    b.active=f.elements.active.checked?1:0;
    b.price=+b.price;b.duration_days=+b.duration_days;
    try{await A('/plans','POST',b);f.reset();f.elements.duration_days.value=26;f.elements.active.checked=true;toast('Subscription plan added');go('Plans')}
    catch(x){toast(x.message)}
  };
  window.masterAddRegional=async form=>{try{await A('/regional-dishes','POST',Object.fromEntries(new FormData(form)));toast('Regional dish added');go('Regional Dishes')}catch(e){toast(e.message)}};
  window.masterAddHeritage=async form=>{try{await A('/heritage','POST',Object.fromEntries(new FormData(form)));toast('Heritage item added');go('Heritage')}catch(e){toast(e.message)}};
  window.masterDelete=async(path,label)=>{if(!confirm('Delete this '+label+' item?'))return;try{await A(path,'DELETE');toast('Deleted');go(cur)}catch(e){toast(e.message)}};
  const patchDrops=()=>{
    $$('.master-ann-image').forEach(el=>{if(!el.dataset.bound){el.dataset.bound='1';dz(el,'target=announcement&id='+el.dataset.id)}});
    $$('.master-reg-image').forEach(el=>{if(!el.dataset.bound){el.dataset.bound='1';dz(el,'target=regional&id='+el.dataset.id)}});
    $('.master-her-image').forEach(el=>{if(!el.dataset.bound){el.dataset.bound='1';dz(el,'target=heritage&id='+el.dataset.id)}}); 
    $('.master-plan-image').forEach(el=>{if(!el.dataset.bound){el.dataset.bound='1';dz(el,'target=plan&id='+el.dataset.id)}});
  };
  const originalGo=window.go;
  if(originalGo&&!window.__masterGoWrapped){
    window.__masterGoWrapped=true;
    window.go=async function(t){await originalGo(t);setTimeout(patchDrops,50)};
  }
  const originalSub=R.Subscriptions;
  R.Subscriptions=async function(){
    const rows=await A('/list/subs');
    return '<p class="small">New subscriptions use the selected plan duration automatically. Admin can adjust start date, duration, or the final end date for validity corrections.</p>'+
      tbl(rows,[['#',s=>s.id],['Customer',s=>escm(s.name)+'<br>'+escm(s.phone)],['Plan',s=>escm(s.plan)],
      ['Start',s=>'<input type="date" value="'+escm(s.start)+'" onchange="masterSaveSub('+s.id+',this.value,null,null)">'],
      ['Duration',s=>'<input type="number" min="1" max="366" value="'+(s.duration_days||26)+'" style="width:90px" onchange="masterSaveSub('+s.id+',null,+this.value,null)">'],
      ['End',s=>'<input type="date" value="'+escm(s.end)+'" onchange="masterSaveSub('+s.id+',null,null,this.value)">'],
      ['WhatsApp updates',s=>'<label><input type="checkbox" aria-label="Record customer consent for subscription WhatsApp updates" style="width:auto" '+(s.whatsapp_opt_in?'checked':'')+' onchange="masterSaveSub('+s.id+',null,null,null,this.checked?1:0)"> Customer consent recorded</label>'],
      ['Price',s=>money(s.price)],
      ['Status',s=>sel('subs',s.id,s.status,['Active','Paused','Completed','Cancelled'])]]);
  };
  window.masterSaveSub=async(id,start,duration,end,whatsapp)=>{
    const body={};if(start)body.start=start;if(duration)body.duration_days=duration;if(end)body.end=end;if(whatsapp!==undefined)body.whatsapp_opt_in=whatsapp;
    try{await A('/subs/'+id,'PUT',body);toast(whatsapp!==undefined?'WhatsApp consent updated':end?'Validity end date updated':'Subscription schedule updated');go('Subscriptions')}catch(e){toast(e.message)}
  };
  window.pr=async function(id){
    const order=(window._ol||[]).find(x=>x.id===id);if(!order)return;
    const st=await A('/settings');const items=JSON.parse(order.items||'[]');const w=open('','_blank','width=390,height=850');
    if(!w){toast('Please allow pop-ups to print receipts');return}
    const currency=String(st.currency||CUR||'KWD'),fmt=v=>Number(v||0).toFixed(3)+' '+currency;
    const subtotal=Number(order.subtotal||items.reduce((s,i)=>s+(+i.price||0)*(+i.qty||0),0)),discount=Number(order.discount||0),delivery=Math.max(0,Number(order.total)-subtotal+discount);
    const logo=st.receipt_logo_url||'/icons/pinoyambula.svg';
    const itemRows=items.map(i=>'<tr><td>'+escm(i.name)+'</td><td>'+i.qty+'</td><td class="num">'+fmt(i.price)+'</td><td class="num">'+fmt((+i.price||0)*(+i.qty||0))+'</td></tr>').join('');
    w.document.write('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt #'+order.id+'</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{width:80mm;margin:0 auto;padding:4mm;font:11px Arial,sans-serif;color:#111}.logo{width:20mm;height:20mm;object-fit:contain;display:block;margin:0 auto 2mm}.center{text-align:center}.line{border-top:1px dashed #111;margin:3mm 0}.row{display:flex;justify-content:space-between;gap:4mm}.customer{font-size:12px;font-weight:700}.small{font-size:10px}.num{text-align:right}table{width:100%;border-collapse:collapse;margin:3mm 0}th,td{padding:1.5mm 0;border-bottom:1px dotted #bbb;vertical-align:top}th{font-size:9px}.total{font-size:14px;font-weight:800}.policy{font-size:9px;margin-top:3mm}.no-print{margin-top:4mm;width:100%;padding:3mm}@media print{.no-print{display:none}}</style></head><body><div class="center"><img class="logo" src="'+escm(logo)+'"><b>'+escm(st.name||'PinoyAmbula')+'</b><div class="small">'+escm(st.phone||'')+'</div><div class="line"></div><b>RECEIPT #'+order.id+'</b><div class="small">'+escm(kuwaitDateTime(order.created))+'</div></div><div class="line"></div><div class="customer">'+escm(order.name||'Customer')+'</div><div>'+escm(order.phone||'')+'</div><div>'+escm(order.address||'')+'</div>'+(order.paci?'<div class="small">PACI: '+escm(order.paci)+'</div>':'')+'<div class="line"></div><table><thead><tr><th>ITEM</th><th>Q</th><th class="num">UNIT</th><th class="num">AMT</th></tr></thead><tbody>'+itemRows+'</tbody></table><div class="row"><span>Subtotal</span><span>'+fmt(subtotal)+'</span></div><div class="row"><span>Discount</span><span>-'+fmt(discount)+'</span></div><div class="row"><span>Delivery</span><span>'+fmt(delivery)+'</span></div><div class="line"></div><div class="row total"><span>TOTAL</span><span>'+fmt(order.total)+'</span></div><div class="small">Payment: '+escm(order.pay||'COD')+'</div><div class="line"></div><div class="policy"><b>'+escm(st.receipt_no_refund||'No refund after order confirmation.')+'</b><br>'+escm(st.receipt_exchange_policy||'Exchange only for verified order issues reported promptly.')+'</div><div class="center small" style="margin-top:4mm">Salamat po!</div><button class="no-print" onclick="print()">Print receipt</button><script>window.onload=function(){setTimeout(function(){window.print()},250)}<\\/script></body></html>');
    w.document.close();
  };
  patchDrops();
}

function boot(){
  masterCss();
  const isAdmin=location.pathname.endsWith('/admin.html')||location.pathname==='/admin.html'||location.hostname.startsWith('admin-');
  if(isAdmin){setTimeout(()=>{try{adminBoot()}catch(e){console.error('MASTER_ADMIN_BOOT_FAILED',e)}},180);return}
  setTimeout(()=>{
    try{siteBoot()}catch(e){console.error('MASTER_SITE_BOOT_FAILED',e)}
  },150);
}

boot();
})();