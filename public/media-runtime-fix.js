(function(){
  'use strict';

  const R=window.PINOY_RUNTIME||{};
  const ORIGIN=String(R.mediaOrigin||R.apiOrigin||location.origin).replace(/\/$/,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mediaUrl(value){
    const raw=String(value??'').trim();
    if(!raw)return '';
    if(/^(data:|blob:|https?:|capacitor:|ionic:|file:)/i.test(raw))return raw;
    if(raw.startsWith('//'))return location.protocol+raw;
    try{return new URL(raw,ORIGIN+(ORIGIN.endsWith('/')?'':'/')).href}catch{return raw}
  }

  window.PINOY_MEDIA_URL=mediaUrl;

  function rewriteSrc(el,attribute){
    const value=el.getAttribute(attribute);
    if(value)el.setAttribute(attribute,mediaUrl(value));
  }

  function rewriteSrcset(el,attribute){
    const value=el.getAttribute(attribute);
    if(!value)return;
    el.setAttribute(attribute,value.split(',').map(part=>{
      const bits=part.trim().split(/\s+/);
      if(!bits[0])return part;
      bits[0]=mediaUrl(bits[0]);
      return bits.join(' ');
    }).join(', '));
  }

  function rewriteBackground(el){
    const raw=el.getAttribute('style')||'';
    if(!raw||!/(^|-)background(?:-image)?\s*:/.test(raw))return;
    el.style.cssText=raw.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(match,quote,url)=>'url("'+mediaUrl(url)+'")');
  }

  function normalize(root=document){
    if(!root||!root.querySelectorAll)return;
    if(root.matches?.('img[src]'))rewriteSrc(root,'src');
    if(root.matches?.('iframe[src]'))rewriteSrc(root,'src');
    if(root.matches?.('[data-src]'))rewriteSrc(root,'data-src');
    if(root.matches?.('[srcset]'))rewriteSrcset(root,'srcset');
    if(root.matches?.('[data-srcset]'))rewriteSrcset(root,'data-srcset');
    if(root.matches?.('[style*="background"]'))rewriteBackground(root);

    root.querySelectorAll('img[src],iframe[src],[data-src],[srcset],[data-srcset],[style*="background"]').forEach(el=>{
      if(el.matches('img[src],iframe[src]'))rewriteSrc(el,'src');
      if(el.hasAttribute('data-src'))rewriteSrc(el,'data-src');
      if(el.hasAttribute('srcset'))rewriteSrcset(el,'srcset');
      if(el.hasAttribute('data-srcset'))rewriteSrcset(el,'data-srcset');
      if(el.hasAttribute('style')&&el.getAttribute('style').includes('background'))rewriteBackground(el);
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
    if(!document.documentElement)return;
    new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)normalize(n)}))).observe(document.documentElement,{subtree:true,childList:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();
