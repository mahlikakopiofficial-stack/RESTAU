/* PinoyAmbula universal brand + UX layer. Loaded by app.js on every surface. */
(function(){
  const LOGO_FALLBACK='/icons/pinoyambula.svg';
  const logoUrl=()=>window.__PA_LOGO__||LOGO_FALLBACK;
  const setLogo=(src)=>{
    const url=String(src||LOGO_FALLBACK).trim()||LOGO_FALLBACK;
    window.__PA_LOGO__=url;
    document.querySelectorAll('img.brand-mark,img.footer-brand-mark,img[data-brand-logo]').forEach(img=>{img.src=url;});
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link=>{link.href=url;});
    document.querySelectorAll('.pa-default-logo').forEach(el=>{el.style.backgroundImage=`url("${url.replace(/"/g,'&quot;')}")`;el.textContent='';});
  };
  const apiGet=async(path)=>{try{const base=String(window.PINOY_RUNTIME?.apiOrigin||'').replace(/\/$/,'');const r=await fetch(base+'/api'+path);return r.ok?r.json():null;}catch{return null;}};
  const injectStyle=(id,css)=>{if(document.getElementById(id))return;const s=document.createElement('style');s.id=id;s.textContent=css;document.head.appendChild(s);};

  async function publicBrand(){
    injectStyle('pa-brand-ux-css',`.pa-plan-card{position:relative;overflow:hidden;border:1px solid rgba(123,45,38,.16);box-shadow:0 12px 28px rgba(61,42,31,.08);}.pa-plan-card::before{content:'PINOYAMBULA';position:absolute;right:-34px;top:18px;transform:rotate(12deg);font-size:10px;letter-spacing:.22em;opacity:.12;font-weight:800;}.pa-plan-badge{display:inline-block;padding:4px 9px;border-radius:999px;background:#7b2d26;color:#fff;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;}`);
    const cfg=await apiGet('/config');
    setLogo(cfg?.logo_url||LOGO_FALLBACK);
    const applyDefaults=()=>{document.querySelectorAll('.ph').forEach(el=>{const bg=getComputedStyle(el).backgroundImage;if(!bg||bg==='none')el.classList.add('pa-default-logo');});setLogo(logoUrl());};
    const mo=new MutationObserver(()=>applyDefaults());mo.observe(document.body,{childList:true,subtree:true});setTimeout(applyDefaults,100);setTimeout(()=>mo.disconnect(),15000);
    const stylePlans=()=>document.querySelectorAll('#plan-list .card').forEach((card,i)=>{card.classList.add('pa-plan-card');if(!card.querySelector('.pa-plan-badge')){const badge=document.createElement('span');badge.className='pa-plan-badge';badge.textContent=i===0?'Everyday favorite':i===1?'Dinner focus':'Best value';card.prepend(badge);}});
    const pl=document.getElementById('plan-list');if(pl){const pmo=new MutationObserver(stylePlans);pmo.observe(pl,{childList:true,subtree:true});setTimeout(stylePlans,500);setTimeout(()=>pmo.disconnect(),20000);}else setTimeout(stylePlans,800);
  }

  function adminWait(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(typeof R!=='undefined'&&typeof go==='function'&&typeof A==='function'){clearInterval(timer);adminEnhance();}
      else if(tries>120)clearInterval(timer);
    },100);
  }

  function adminEnhance(){
    injectStyle('pa-admin-ux-css',`.pa-admin-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 14px;}.pa-admin-tools input,.pa-admin-tools select{max-width:320px;}.pa-chat-panel{position:fixed;right:20px;bottom:20px;width:min(430px,calc(100vw - 40px));max-height:72vh;z-index:200;background:#fffaf0;border:1px solid #ddd2c2;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.22);padding:16px;display:none;}.pa-chat-panel.open{display:block;}.pa-chat-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;}.pa-chat-messages{max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:8px;margin:10px 0;padding:4px;}.pa-msg{padding:9px 11px;border-radius:12px;max-width:88%;white-space:pre-wrap;}.pa-msg.customer{align-self:flex-start;background:#eee6d8;}.pa-msg.admin{align-self:flex-end;background:#7b2d26;color:#fff;}.pa-chat-panel textarea{min-height:80px;}.pa-default-logo{background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important;background-color:#fffaf0!important;}`);

    const originalMenu=R.Menu;
    if(typeof originalMenu==='function'){
      R.Menu=async function(){const html=await originalMenu();return `<div class="pa-admin-tools"><input id="pa-menu-search" type="search" placeholder="Search menu by name, category, region or ingredient"><select id="pa-menu-cat"><option value="">All categories</option>${['Regular','Budget','Drinks','Sweets','Catering','Other Asian'].map(c=>`<option>${c}</option>`).join('')}</select><span id="pa-menu-count" class="small"></span></div>`+html;};
      window.PA_afterMenu=function(){const search=document.getElementById('pa-menu-search'),cat=document.getElementById('pa-menu-cat');const filter=()=>{const q=(search?.value||'').toLowerCase().trim(),c=cat?.value||'';let shown=0;document.querySelectorAll('#main .grid > .card').forEach(card=>{const text=card.textContent.toLowerCase(),sel=card.querySelector('select');const ok=(!q||text.includes(q))&&(!c||sel?.value===c);card.style.display=ok?'':'none';if(ok)shown++;});const n=document.getElementById('pa-menu-count');if(n)n.textContent=shown+' matching item(s)';};search?.addEventListener('input',filter);cat?.addEventListener('change',filter);filter();document.querySelectorAll('#main .ph').forEach(el=>{if(getComputedStyle(el).backgroundImage==='none'){el.classList.add('pa-default-logo');el.style.backgroundImage=`url("${logoUrl()}")`;}});};
    }

    R['Regional Dishes']=async function(){const rows=await A('/regional-dishes');A_after=()=>document.querySelectorAll('.pa-regional-img').forEach(el=>el.onclick=()=>pickRegionalImage(Number(el.dataset.id)));return `<div class="pa-admin-tools"><input id="pa-regional-search" type="search" placeholder="Search regional dish or region"><span class="small">Missing photos use the universal PinoyAmbula logo. Deactivate dishes instead of deleting them.</span></div><div class="grid">${rows.map(r=>`<div class="card pa-regional-card"><div class="ph pa-regional-img ${r.img?'':'pa-default-logo'}" data-id="${r.id}" style="height:180px;cursor:pointer;${r.img?`background-image:url('${esc(r.img)}')`:''}">${r.img?'':' '}</div><div class="p mini"><input value="${esc(r.name)}" onchange="up2('regional-dishes',${r.id},'name',this.value)"><input value="${esc(r.region)}" onchange="up2('regional-dishes',${r.id},'region',this.value)"><textarea rows="2" onchange="up2('regional-dishes',${r.id},'descr',this.value)">${esc(r.descr||'')}</textarea><input type="number" step="0.001" value="${r.price||0}" onchange="up2('regional-dishes',${r.id},'price',+this.value)"><label><input type="checkbox" style="width:auto" ${r.active?'checked':''} onchange="up2('regional-dishes',${r.id},'active',this.checked?1:0)"> Active</label><button class="btn s o" type="button" onclick="pickRegionalImage(${r.id})">Change image</button></div></div>`).join('')}</div>`;};
    window.pickRegionalImage=async function(id){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{if(!input.files[0])return;const fd=new FormData();fd.append('file',input.files[0]);try{await A('/upload?target=regional&id='+id,'POST',fd);toast('Regional dish image saved');go('Regional Dishes');}catch(e){toast(e.message);}};input.click();};

    const originalCustomers=R.Customers;R.Customers=async function(){const html=await originalCustomers();return `<div class="pa-admin-tools"><button class="btn s" type="button" onclick="PA_openCustomerChat()">💬 Open customer chat</button><span class="small">Replies are stored in the inquiry thread and delivered through the configured email channel when available.</span></div>`+html;};
    const originalInquiries=R.Inquiries;R.Inquiries=async function(){const html=await originalInquiries();return `<div class="pa-admin-tools"><button class="btn s" type="button" onclick="PA_openInquiryChat()">💬 Open inquiry chat</button></div>`+html;};
    window.PA_openCustomerChat=async function(){const customers=await A('/list/customers');const inquiries=await A('/list/inquiries');PA_openPanel(customers,inquiries,null);};
    window.PA_openInquiryChat=async function(){const inquiries=await A('/list/inquiries');const customers=await A('/list/customers');PA_openPanel(customers,inquiries,inquiries[0]?.id||null);};
    function PA_openPanel(customers,inquiries,initialId){let p=document.querySelector('.pa-chat-panel');if(!p){p=document.createElement('div');p.className='pa-chat-panel';document.body.appendChild(p);}const valid=inquiries||[];p.innerHTML=`<div class="pa-chat-head"><strong>Customer chat</strong><button class="btn s o" type="button" onclick="this.closest('.pa-chat-panel').classList.remove('open')">Close</button></div><label>Customer / conversation<select id="pa-chat-select"><option value="">Select conversation</option>${valid.map(i=>`<option value="${i.id}" ${i.id===initialId?'selected':''}>${esc(i.name||'Customer')} — ${esc(i.type||'General')} #${i.id}</option>`).join('')}</select></label><div id="pa-chat-messages" class="pa-chat-messages"></div><textarea id="pa-chat-input" placeholder="Type a reply..."></textarea><button class="btn" type="button" id="pa-chat-send">Send reply</button>`;p.classList.add('open');const select=p.querySelector('#pa-chat-select'),box=p.querySelector('#pa-chat-messages'),input=p.querySelector('#pa-chat-input');const load=async()=>{const id=Number(select.value||0);if(!id){box.innerHTML='<p class="small">Choose a conversation.</p>';return;}try{const msgs=await A('/inquiries/'+id+'/messages');box.innerHTML=msgs.map(m=>`<div class="pa-msg ${m.author==='admin'?'admin':'customer'}"><b>${m.author==='admin'?'You':'Customer'}</b><br>${esc(m.message)}</div>`).join('');box.scrollTop=box.scrollHeight;}catch(e){box.innerHTML='<p>'+esc(e.message)+'</p>';}};select.onchange=load;load();p.querySelector('#pa-chat-send').onclick=async()=>{const id=Number(select.value||0),message=input.value.trim();if(!id||!message)return toast('Select a conversation and enter a message');try{await A('/inquiries/'+id+'/messages','POST',{message});input.value='';await load();toast('Reply sent');}catch(e){toast(e.message);}};}

    const originalSettings=R.Settings;R.Settings=async function(){const html=await originalSettings();return html.replace('<h3 style="margin-top:20px">Branding</h3>',`<h3 style="margin-top:20px">Branding — Universal Logo</h3><p class="small">Set the single logo URL here. Public header, footer, favicon, menu fallback images, regional dish fallback images and admin branding will use it.</p>`);};
    const oldGo=go;window.go=async function(t){const result=await oldGo(t);if(t==='Menu')window.PA_afterMenu?.();return result;};
  }

  const run=()=>{if(document.title.includes('Admin'))adminWait();else publicBrand();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
