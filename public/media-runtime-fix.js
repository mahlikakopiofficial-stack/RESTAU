(function(){
  'use strict';
  const R=window.PINOY_RUNTIME||{};
  const ORIGIN=String(R.mediaOrigin||R.apiOrigin||location.origin).replace(/\/$/,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mediaUrl(v){
    const s=String(v||'').trim();
    if(!s)return '';
    if(/^(data:|blob:|https?:|capacitor:|ionic:|file:)/i.test(s))return s;
    if(s.startsWith('//'))return location.protocol+s;
    return ORIGIN+(s.startsWith('/')?s:'/'.concat(s));
  }
  window.PINOY_MEDIA_URL=mediaUrl;

  function normalize(root=document){
    root.querySelectorAll?.('img[src],iframe[src]').forEach(el=>{
      const src=el.getAttribute('src');
      if(src)el.setAttribute('src',mediaUrl(src));
    });
    root.querySelectorAll?.('[style*="background-image"]').forEach(el=>{
      const raw=el.getAttribute('style')||'';
      el.setAttribute('style',raw.replace(/url\\((['"]?)([^'")]+)\\1\\)/gi,(m,q,u)=>'url("'+mediaUrl(u)+'")'));
    });
  }

  function dialog(){
    let d=document.getElementById('paMediaPreview');
    if(d)return d;
    d=document.createElement('dialog');
    d.id='paMediaPreview';
    d.style.cssText='width:min(900px,94vw);max-width:900px;border:0;border-radius:16px;padding:14px;background:#121716;color:#fff;margin:auto;';
    d.innerHTML='<div style="display:flex;justify-content:flex-end"><button type="button" class="btn s o">✕</button></div><div id="paMediaBody"></div><p id="paMediaCaption"></p>';
    d.querySelector('button').addEventListener('click',()=>d.close());
    d.addEventListener('click',e=>{if(e.target===d)d.close()});
    document.body.appendChild(d);
    return d;
  }
  function preview({src,title,description,ingredients,meta}){
    const d=dialog(),body=d.querySelector('#paMediaBody');
    const safeSrc=mediaUrl(src);
    body.innerHTML=(safeSrc?'<img src="'+esc(safeSrc)+'" alt="'+esc(title)+'" style="display:block;width:100%;max-height:70vh;object-fit:contain;border-radius:10px;background:#0b0d0c">':'<div style="padding:50px;text-align:center">No image available</div>')+
      '<h2>'+esc(title||'Preview')+'</h2>'+
      (meta?'<p>'+esc(meta)+'</p>':'')+
      (description?'<p>'+esc(description)+'</p>':'')+
      (ingredients?'<section><h3>Ingredients</h3><p>'+esc(ingredients)+'</p></section>':'');
    if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
  }

  function menuDataFromCard(card){
    const name=card?.querySelector('h3')?.textContent?.trim()||'';
    const item=(window.items||[]).find(x=>String(x.name).trim()===name);
    if(item)return item;
    return {name,img:card?.querySelector('img')?.getAttribute('src')||'',descr:card?.querySelector('.menu-description')?.textContent||'',ingredients:''};
  }

  document.addEventListener('click',function(e){
    const hit=e.target.closest?.('.master-slide-hit');
    if(hit){
      e.preventDefault();e.stopImmediatePropagation();
      const slide=hit.closest('.master-slide');
      const media=slide?.querySelector('img,iframe');
      preview({src:media?.getAttribute('src'),title:slide?.querySelector('.caption strong')?.textContent||'Gallery preview',description:slide?.querySelector('.caption')?.textContent?.replace(/· Tap to preview/i,'').trim()});
      return;
    }
    const menuPhoto=e.target.closest?.('.master-menu-photo');
    if(menuPhoto){
      e.preventDefault();e.stopImmediatePropagation();
      const item=menuDataFromCard(menuPhoto.closest('.master-menu-card'));
      preview({src:item.img,title:item.name,description:item.descr,ingredients:item.ingredients,meta:[item.cat,item.region].filter(Boolean).join(' · ')});
      return;
    }
    const regionalImg=e.target.closest?.('#regional-favorites .master-item-media');
    if(regionalImg){
      e.preventDefault();e.stopImmediatePropagation();
      const card=regionalImg.closest('.card');
      preview({src:regionalImg.getAttribute('src'),title:card?.querySelector('h3')?.textContent||regionalImg.alt,description:card?.querySelector('p:not(.pill)')?.textContent||'',meta:card?.querySelector('.pill')?.textContent||''});
    }
  },true);

  function observe(){
    normalize(document);
    new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1)normalize(n)}))).observe(document.documentElement,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();
