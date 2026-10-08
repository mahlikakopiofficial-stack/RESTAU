(() => {
  'use strict';

  // PinoyAmbula menu/header uses the exact same PNG asset as the Android launcher.
  const BRAND_ICON='/icons/pinoyambula.svg';
  const MENU_BRAND_ICON='/icons/pinoyambula.png';
  const BRAND_NAME='PinoyAmbula';
  const applyBrandMark=()=>{
    document.querySelectorAll('link[rel="icon"]').forEach(link=>link.href=BRAND_ICON);
    const logo=document.querySelector('nav .logo');
    if(logo){
      logo.innerHTML='<img src="'+MENU_BRAND_ICON+'" alt="" class="brand-mark"> <span>'+BRAND_NAME+'</span>';
      logo.setAttribute('aria-label',BRAND_NAME+' home');
      logo.style.display='inline-flex';
      logo.style.alignItems='center';
      logo.style.gap='8px';
    }
    if(!document.getElementById('pinoy-brand-style')){
      const style=document.createElement('style');style.id='pinoy-brand-style';
      style.textContent='.brand-mark{width:34px;height:34px;display:block;flex:0 0 34px}';
      document.head.appendChild(style);
    }
  };
  applyBrandMark();

  // Mobile pull-to-refresh: only when the page is already at the top.
  let startY=0, pulling=false;
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    startY=e.touches[0].clientY;
    pulling=window.scrollY<=2;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!pulling||e.changedTouches.length!==1)return;
    const dy=e.changedTouches[0].clientY-startY;
    if(dy>95&&window.scrollY<=2)window.location.reload();
    pulling=false;
  },{passive:true});

  // Keep navigation visible and sticky; responsive CSS controls its layout.\n  // Public pages must not expose an admin navigation link.
  if(!location.pathname.endsWith('/admin.html') && location.pathname!=='/admin.html'){
    document.querySelectorAll('a[href="admin.html"],a[href="/admin.html"]').forEach(a=>a.remove());
  }

  // Customer nationality: searchable native select.
  const nat=document.querySelector('#auth input[name="nationality"]');
  if(nat && nat.parentNode){
    const sel=document.createElement('select');
    sel.name='nationality'; sel.autocomplete='country-name';
    const list=['Kuwaiti','Filipino','Indian','Bangladeshi','Nepalese','Sri Lankan','Pakistani','Egyptian','Jordanian','Syrian','Lebanese','Palestinian','Saudi','Emirati','Qatari','Bahraini','Omani','American','British','Canadian','Australian','Other'];
    sel.innerHTML='<option value="">Select nationality</option>'+list.map(x=>'<option>'+x+'</option>').join('');
    sel.value=nat.value;
    nat.replaceWith(sel);
  }

  // Delivery map pin button and coordinates.
  const cartForm=document.querySelector('#cart form');
  if(cartForm && !document.getElementById('pick-delivery-location')){
    const address=cartForm.querySelector('[name="address"]');
    if(address){
      const wrap=document.createElement('div');
      wrap.innerHTML='<button type="button" class="btn s o" id="pick-delivery-location">📍 Use my current map location</button><p id="delivery-location-note" style="font-size:.8rem;opacity:.72;margin:3px 0 8px">After choosing the pin, also add a well-known nearby building, landmark, or place in the address/notes so the rider can find you.</p>';
      address.parentNode.insertBefore(wrap,address);
      for(const n of ['lat','lng','map_url']){
        const h=document.createElement('input');h.type='hidden';h.name=n;cartForm.appendChild(h);
      }
      document.getElementById('pick-delivery-location').onclick=()=>{
        if(!navigator.geolocation){toast('Location is not available on this device.');return}
        navigator.geolocation.getCurrentPosition(pos=>{
          const lat=pos.coords.latitude,lng=pos.coords.longitude,url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lng);
          cartForm.lat.value=lat;cartForm.lng.value=lng;cartForm.map_url.value=url;
          const note=document.getElementById('delivery-location-note');
          note.innerHTML='📍 Pin saved. Please still add the nearby building/landmark in the address or notes.';
          toast('Delivery pin saved');
        },()=>toast('Location permission was not granted. Enter the address manually.'),{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
      };
    }
  }

  // Subscription: optional nickname + auto-fill from logged-in customer profile.
  const subForm=document.querySelector('#subd form');
  if(subForm){
    if(!subForm.querySelector('[name="nickname"]')){
      const lab=document.createElement('label');lab.textContent='Nickname (optional)';
      const input=document.createElement('input');input.name='nickname';input.maxLength=60;input.placeholder='e.g. Kuya Jun';
      subForm.insertBefore(lab,subForm.querySelector('[name="name"]'));
      subForm.insertBefore(input,subForm.querySelector('[name="name"]'));
    }
    const original=window.subOpen;
    if(original && !window.__pinoySubPatched){
      window.__pinoySubPatched=true;
      window.subOpen=async id=>{
        original(id);
        try{
          const token=localStorage.getItem('ct');
          if(!token)return;
          const p=await api('/me');
          const map={name:p.name,email:p.email,phone:p.phone,address:p.address,paci:p.paci};
          Object.entries(map).forEach(([k,v])=>{
            const f=subForm.querySelector('[name="'+k+'"]');
            if(f&&v&&!f.value)f.value=v;
          });
        }catch(_){}
      };
    }
  }

  // Admin-only customer email composer. It uses the existing Gmail OAuth sender.
  if(location.pathname.endsWith('/admin.html')||location.pathname==='/admin.html'){
    const addEmailButton=()=>{
      const side=document.getElementById('side');
      if(!side||side.querySelector('[data-customer-email]'))return;
      const b=document.createElement('button');
      b.dataset.customerEmail='1';b.textContent='Customer Email';b.onclick=()=>{
        let d=document.getElementById('customerEmailDialog');
        if(!d){
          d=document.createElement('dialog');d.id='customerEmailDialog';
          d.innerHTML='<h2>Send customer email</h2><form><label>Customer email<input name="to" type="email" required></label><label>Subject<input name="subject" maxlength="160" required></label><label>Message<textarea name="text" rows="8" maxlength="5000" required></textarea></label><button class="btn">Send email</button> <button type="button" class="btn o">Close</button></form>';
          document.body.appendChild(d);
          d.querySelector('.o').onclick=()=>d.close();
          d.querySelector('form').onsubmit=async e=>{
            e.preventDefault();
            const data=Object.fromEntries(new FormData(e.target));
            try{
              const res=await fetch('/api/admin/email-customer',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('at')},body:JSON.stringify(data)});
              const j=await res.json();if(!res.ok)throw new Error(j.error||'Email failed');
              e.target.reset();d.close();toast(j.message||'Email sent');
            }catch(err){toast(err.message)}
          };
        }
        d.showModal();
      };
      side.appendChild(b);
    };
    const obs=new MutationObserver(addEmailButton);obs.observe(document.body,{childList:true,subtree:true});setTimeout(addEmailButton,500);
  }

  // Customer delivery/driver state: show a clear pending state until a driver is assigned.
  if(location.pathname.endsWith('/account.html')||location.pathname==='/account.html'){
    const pendingDriver=()=>{
      const table=document.getElementById('ot');
      if(!table)return;
      table.querySelectorAll('tr').forEach(row=>{
        if(row.querySelector('th')||row.querySelector('.order-driver'))return;
        const text=row.textContent||'';
        if(/Delivered|Completed|No orders yet/.test(text))return;
        const cell=row.cells?.[3];
        if(!cell)return;
        const block=document.createElement('div');
        block.className='order-driver';
        block.style.cssText='margin-top:8px;padding:8px;border-radius:10px;border:1px solid #ead9b8;background:#fffaf0';
        block.innerHTML='<b>Driver</b><br><span>Driver name: pending</span><br><span>Driver number: pending</span>';
        cell.appendChild(block);
      });
    };
    const obs=new MutationObserver(pendingDriver);
    const table=document.getElementById('ot');
    if(table)obs.observe(table,{childList:true,subtree:true});
    setTimeout(pendingDriver,700);

    // Loyalty display follows a repeating 10-order cycle.
    const loyalty=document.getElementById('loyalty-progress');
    let loyaltyObs=null;
    const fixLoyaltyText=()=>{
      const el=document.getElementById('loyalty-progress');
      if(!el)return;
      const m=(el.textContent||'').match(/(\d+) completed deliveries/);
      if(!m)return;
      const total=Number(m[1])||0,cycle=total%10;
      const next=`${total} completed deliveries. Current loyalty cycle: ${cycle}/10. A new reward cycle starts after every 10 completed orders.`;
      if(el.textContent===next)return;
      if(loyaltyObs)loyaltyObs.disconnect();
      el.textContent=next;
      if(loyaltyObs)loyaltyObs.observe(el,{childList:true,characterData:true,subtree:true});
    };
    if(loyalty){
      loyaltyObs=new MutationObserver(fixLoyaltyText);
      loyaltyObs.observe(loyalty,{childList:true,characterData:true,subtree:true});
      setTimeout(fixLoyaltyText,800);
    }
  }
})();