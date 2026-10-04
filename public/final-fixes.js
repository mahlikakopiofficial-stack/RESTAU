(() => {
  'use strict';

  // Single-source PinoyAmbula brand mark: the same SVG is used by the
  // customer header, admin favicon, browser favicon, and PWA manifest.
  const BRAND_ICON='/icons/pinoyambula.svg';
  const BRAND_NAME='PinoyAmbula';
  const applyBrandMark=()=>{
    document.querySelectorAll('link[rel="icon"]').forEach(link=>link.href=BRAND_ICON);
    const logo=document.querySelector('nav .logo');
    if(logo){
      logo.innerHTML='<img src="'+BRAND_ICON+'" alt="" class="brand-mark"> <span>'+BRAND_NAME+'</span>';
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
  const applyUniversalBrand=async()=>{
    try{
      const cfg=await api('/config');
      const src=String(cfg.brand_logo_url||cfg.logo_url||'/icons/pinoyambula.svg').trim()||'/icons/pinoyambula.svg';
      window.PINOY_BRAND_LOGO_URL=src;
      document.querySelectorAll('img.brand-mark,img.footer-brand-mark').forEach(img=>{img.src=src});
      document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link=>link.href=src);
      document.querySelectorAll('[data-brand-logo]').forEach(el=>{el.src=src});
    }catch(_){}
  };
  applyUniversalBrand();

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

  // Auto-hide the public/admin navigation while scrolling down.
  const nav=document.querySelector('nav');
  if(nav){
    let last=window.scrollY, timer;
    nav.style.transition='transform .22s ease';
    window.addEventListener('scroll',()=>{
      const y=window.scrollY;
      if(y>last+8&&y>70)nav.style.transform='translateY(-110%)';
      else if(y<last-8)nav.style.transform='translateY(0)';
      last=y;
      clearTimeout(timer);
      timer=setTimeout(()=>nav.style.transform='translateY(0)',1200);
    },{passive:true});
    document.addEventListener('click',e=>{
      if(e.target.closest('nav a,#burger'))setTimeout(()=>nav.style.transform='translateY(0)',50);
    });
  }

  // Public pages must not expose an admin navigation link.
  if(!location.pathname.endsWith('/admin.html') && location.pathname!=='/admin.html'){
    document.querySelectorAll('a[href="admin.html"],a[href="/admin.html"]').forEach(a=>a.remove());
  }

  // Admin Customers can send a real email from the same chatbox.
  if((location.pathname.endsWith('/admin.html')||location.pathname==='/admin.html')&&
     typeof window.openCustomerChat==='function'&&!window.__customerEmailComposerReady){
    window.__customerEmailComposerReady=true;
    const openCustomerChat=window.openCustomerChat;
    window.openCustomerChat=async function(id,name,email){
      const result=await openCustomerChat.apply(this,arguments);
      const dialog=document.getElementById('customerChatDialog');
      if(!dialog)return result;
      let panel=dialog.querySelector('#customer-email-composer');
      if(!panel){
        panel=document.createElement('section');
        panel.id='customer-email-composer';
        panel.className='customer-email-composer';
        panel.hidden=true;
        panel.innerHTML='<h3>Customer Email</h3><form id="customerEmailForm"><label>To<input name="to" type="email" autocomplete="email" maxlength="254" required></label><label>Subject<input name="subject" maxlength="160" required></label><label>Message<textarea name="text" rows="4" maxlength="5000" required></textarea></label><button class="btn" type="submit">Send email</button> <span role="status" aria-live="polite"></span></form>';
        const chatForm=dialog.querySelector('#customerChatForm');
        if(chatForm)chatForm.after(panel);else dialog.appendChild(panel);
        panel.querySelector('form').addEventListener('submit',async event=>{
          event.preventDefault();
          const form=event.currentTarget,send=form.querySelector('button[type="submit"]'),status=form.querySelector('[role="status"]');
          const payload={to:form.elements.to.value.trim(),subject:form.elements.subject.value.trim(),text:form.elements.text.value.trim()};
          if(!payload.to||!payload.subject||!payload.text)return;
          send.disabled=true;status.textContent='Sending…';
          try{
            await window.api('/admin/email-customer','POST',payload,'at');
            status.textContent='Email sent.';
            form.elements.text.value='';
            window.toast?.('Customer email sent');
          }catch(error){
            status.textContent=error.message||'Email could not be sent.';
            window.toast?.(status.textContent);
          }finally{send.disabled=false}
        });
      }
      const form=panel.querySelector('form');
      form.elements.to.value=String(email||dialog.dataset.customerEmail||'');
      form.elements.subject.value='PinoyAmbula customer support';
      form.elements.text.value='';
      form.querySelector('[role="status"]').textContent='';
      panel.hidden=true;
      const button=dialog.querySelector('#customerChatEmail');
      if(button){
        button.textContent='Customer Email';
        button.setAttribute('aria-expanded','false');
        button.onclick=()=>{
          panel.hidden=!panel.hidden;
          button.setAttribute('aria-expanded',String(!panel.hidden));
          if(!panel.hidden)form.elements.to.focus();
        };
      }
      return result;
    };
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

  // Customer communication is handled inside the Admin > Customers chatbox.
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

