(function(){
  'use strict';
  const esc0=(v)=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money0=(v)=>typeof money==='function'?money(v):Number(v||0).toFixed(3)+' KWD';
  const btn=(label,fn,cls='btn s')=>`<button type="button" class="${cls}" onclick="${fn}">${label}</button>`;
  function orderRows(rows){return rows.map(r=>`<tr><td data-label="#">${r.id}</td><td data-label="Date">${esc0(typeof kuwaitDateTime==='function'?kuwaitDateTime(r.created):r.created)}</td><td data-label="Customer"><b>${esc0(r.name)}</b><br>${esc0(r.phone||'')}<br>${esc0(r.email||'')}</td><td data-label="Drop location">${esc0(r.address||'')}${r.paci?`<br><b>PACI:</b> ${esc0(r.paci)}`:''}${r.notes?`<br><i>${esc0(r.notes)}</i>`:''}</td><td data-label="Items">${(()=>{try{return JSON.parse(r.items||'[]').map(i=>`${i.qty}× ${esc0(i.name)}`).join('<br>')}catch{return esc0(r.items)}})()}</td><td data-label="Payment">${esc0(r.pay||'COD')}<br><small>Payment: ${esc0(r.payment_status||'Pending')}</small>${String(r.pay||'COD').toUpperCase()==='COD'?'<br><select aria-label="COD cash collection for order '+r.id+'" onchange="setOrderCashCollected('+r.id+',this.value)"><option value="0"'+(!r.cod_cash_collected?' selected':'')+'>Cash not collected</option><option value="1"'+(r.cod_cash_collected?' selected':'')+'>Cash collected by driver</option></select>':''}</td><td data-label="Total"><b>${money0(r.total)}</b></td><td data-label="Status"><select onchange="A('/status/orders/${r.id}','PUT',{status:this.value}).then(()=>{toast('Order #${r.id} updated');go('Orders')}).catch(e=>toast(e.message))">${['Pending','New','Confirmed','Preparing','Out for delivery','Delivered','Cancelled','Completed'].map(s=>`<option${s===r.status?' selected':''}>${s}</option>`).join('')}</select>${['Pending','New'].includes(r.status)?`<div style="margin-top:4px">${btn('✓ Confirm',`confirmAdminOrder(${r.id})`,'btn s b')}</div>`:''}</td><td data-label="Actions"><div style="display:flex;gap:5px;flex-wrap:wrap">${btn('🖨',`pr(${r.id})`,'btn s o')}${btn('💬 Chat',`openAdminOrderChat(${r.id})`,'btn s o')}</div></td></tr>`).join('')}
  window.setOrderCashCollected=async function(id,value){
    try{
      await A('/orders/'+id,'PUT',{cod_cash_collected:Number(value)?1:0});
      toast(Number(value)?'COD cash marked collected':'COD cash marked not collected');
      go('Orders');
    }catch(e){toast(e.message)}
  };
  window.confirmAdminOrder=async function(id){try{await A('/status/orders/'+id,'PUT',{status:'Confirmed'});toast('Order #'+id+' confirmed');go('Orders')}catch(e){toast(e.message)}};
  window.openAdminOrderChat=async function(id){
    let d=document.getElementById('adminOrderChat');
    if(!d){
      d=document.createElement('dialog');d.id='adminOrderChat';
      d.innerHTML='<h3 id="adminOrderChatTitle"></h3><div id="adminOrderChatMessages" class="conversation"></div><form onsubmit="sendAdminOrderChat(event)"><textarea name="message" rows="3" maxlength="4000" required placeholder="Reply to the customer..."></textarea><button class="btn">Send reply</button> <button type="button" class="btn o" onclick="adminOrderChatClose()">Close</button></form>';
      document.body.appendChild(d);
    }
    window.__adminOrderChatId=id;
    if(window.__adminOrderChatTimer)clearInterval(window.__adminOrderChatTimer);
    const refresh=async()=>{
      try{
        const x=await A('/orders/'+id+'/chat');
        document.getElementById('adminOrderChatTitle').textContent='Order #'+id+' chat · '+x.order.status+(x.inquiry?' · Conversation #'+x.inquiry.id:' · New conversation');
        document.getElementById('adminOrderChatMessages').innerHTML=x.messages?.length?x.messages.map(m=>`<article class="message ${m.author==='admin'?'staff':''}"><b>${m.author==='admin'?'Restaurant':'Customer'}</b><time>${esc0(typeof kuwaitDateTime==='function'?kuwaitDateTime(m.created):m.created)}</time><p>${esc0(m.message)}</p></article>`).join(''):'<p>No chat messages yet. Send the first reply below.</p>';
        const box=document.getElementById('adminOrderChatMessages');box.scrollTop=box.scrollHeight;
      }catch(e){toast(e.message)}
    };
    window.__adminOrderChatRefresh=refresh;
    if(!d.dataset.chatLifecycleBound){
      d.dataset.chatLifecycleBound='1';
      d.addEventListener('close',()=>{
        if(window.__adminOrderChatTimer)clearInterval(window.__adminOrderChatTimer);
        window.__adminOrderChatTimer=null;
        window.__adminOrderChatRefresh=null;
        window.__adminOrderChatId=null;
      });
    }
    if(!d.open)d.showModal();
    await refresh();
    if(window.__adminOrderChatId!==id||!d.open)return;
    window.__adminOrderChatTimer=null;
  };
window.adminOrderChatClose=function(){if(window.__adminOrderChatTimer)clearInterval(window.__adminOrderChatTimer);window.__adminOrderChatTimer=null;window.__adminOrderChatRefresh=null;window.__adminOrderChatId=null;const d=document.getElementById('adminOrderChat');if(d?.open)d.close()};
  window.sendAdminOrderChat=async function(e){
    e.preventDefault();
    if(!window.__adminOrderChatId)return;
    try{
      await A('/orders/'+window.__adminOrderChatId+'/chat','POST',Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      toast('Reply sent');
      await (window.__adminOrderChatRefresh?.()||Promise.resolve());
    }catch(x){toast(x.message)}
  };
  window.__adminLiveChatSync=window.__adminLiveChatSync||false;
  if(!window.__adminLiveChatSync){
    window.__adminLiveChatSync=true;
    window.addEventListener('admin-live-event',event=>{
      const ev=event.detail||{};
      if((ev.type==='message'||ev.type==='inquiry')&&window.__adminInquiryId){
        loadInquiry(window.__adminInquiryId).catch(()=>{});
      }
      if((ev.type==='message'||ev.type==='order')&&window.__adminOrderChatId){
        window.__adminOrderChatRefresh?.();
      }
      if(ev.type==='order'&&typeof window.go==='function')window.go('Orders');
    });
  }

  R.Orders=async function(){const all=await A('/list/orders'),f=window._of||'All',rows=f==='All'?all:all.filter(x=>x.status===f),filters=['All','Pending','New','Confirmed','Preparing','Out for delivery','Delivered','Cancelled','Completed'];window._ol=all;return `<div class="admin-fix-toolbar"><select style="width:auto" onchange="window._of=this.value;go('Orders')">${filters.map(x=>`<option${x===f?' selected':''}>${x}</option>`).join('')}</select>${btn('↻ Refresh',`go('Orders')`,'btn s o')}${btn('⬇ CSV',`exp('orders')`,'btn s o')}<span class="admin-live">● Live order monitor</span></div><div class="admin-alert-note">New orders are delivered to this dashboard by the live server stream. Pending/New orders have a direct Confirm button.</div><div class="tw"><table><thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Drop location</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${orderRows(rows)||'<tr><td colspan="9">No orders found.</td></tr>'}</tbody></table></div>`};
  async function loadInquiry(id){const data=await A('/inquiries/'+id+'/messages'),box=document.getElementById('adminInquiryMessages');if(!box)return;box.innerHTML=data.map(m=>`<article class="message ${m.author==='admin'?'staff':''}"><b>${m.author==='admin'?'Restaurant':'Customer'}</b><time>${esc0(typeof kuwaitDateTime==='function'?kuwaitDateTime(m.created):m.created)}</time><p>${esc0(m.message)}</p></article>`).join('');box.scrollTop=box.scrollHeight}
  window.openAdminInquiry=async function(id){
    let d=document.getElementById('adminInquiryChat');
    if(!d){
      d=document.createElement('dialog');
      d.id='adminInquiryChat';
      d.innerHTML='<h3 id="adminInquiryTitle">Inquiry</h3><div id="adminInquiryMessages" class="conversation"></div><form onsubmit="sendAdminInquiry(event)"><textarea name="message" rows="4" maxlength="4000" required placeholder="Write a reply to the customer..."></textarea><button class="btn">Send reply</button> <button type="button" class="btn o" onclick="adminInquiryClose()">Close</button></form>';
      document.body.appendChild(d);
    }
    window.__adminInquiryId=id;
    if(window.__adminInquiryTimer)clearInterval(window.__adminInquiryTimer);
    if(!d.dataset.chatLifecycleBound){
      d.dataset.chatLifecycleBound='1';
      d.addEventListener('close',()=>{
        if(window.__adminInquiryTimer)clearInterval(window.__adminInquiryTimer);
        window.__adminInquiryTimer=null;
        window.__adminInquiryId=null;
      });
    }
    try{
      const rows=await A('/list/inquiries');
      const q=rows.find(x=>Number(x.id)===Number(id));
      if(!q)throw new Error('Conversation not found');
      document.getElementById('adminInquiryTitle').textContent=`Inquiry #${id} · Conversation #${id} · ${q.name||'Customer'} · ${q.type||'General'}`;
      if(!d.open)d.showModal();
      await loadInquiry(id);
      if(window.__adminInquiryId!==id||!d.open)return;
      window.__adminInquiryTimer=null;
    }catch(e){toast(e.message)}
  };
  window.adminInquiryClose=function(){if(window.__adminInquiryTimer)clearInterval(window.__adminInquiryTimer);window.__adminInquiryTimer=null;window.__adminInquiryId=null;const d=document.getElementById('adminInquiryChat');if(d?.open)d.close()};
  window.sendAdminInquiry=async function(e){e.preventDefault();if(!window.__adminInquiryId)return;try{await A('/inquiries/'+window.__adminInquiryId+'/messages','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();toast('Reply sent to customer');await loadInquiry(window.__adminInquiryId)}catch(x){toast(x.message)}};
  R.Inquiries=async function(){const rows=await A('/list/inquiries');return `<div class="admin-fix-toolbar">${btn('↻ Refresh',`go('Inquiries')`,'btn s o')}${btn('⬇ CSV',`exp('inquiries')`,'btn s o')}<span class="admin-live">● Live conversation monitor</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Name</th><th>Contact</th><th>Topic</th><th>Message</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Date">${esc0(typeof kuwaitDateTime==='function'?kuwaitDateTime(r.created):r.created)}</td><td data-label="Name"><b>${esc0(r.name)}</b></td><td data-label="Contact">${esc0(r.email||'')}<br>${esc0(r.phone||'')}</td><td data-label="Topic">${esc0(r.type||'General')}</td><td data-label="Message">${esc0(r.msg)}</td><td data-label="Status">${esc0(r.status||'New')}</td><td data-label="Action"><div style="display:flex;gap:5px;flex-wrap:wrap">${btn('💬 Reply',`openAdminInquiry(${r.id})`,'btn s b')}${btn('Delete',`rm('inquiries',${r.id})`,'btn s o')}</div></td></tr>`).join('')||'<tr><td colspan="7">No inquiries yet.</td></tr>'}</tbody></table></div>`};
  window.sendNewsletterNow=async function(e){e.preventDefault();const f=e.target,b=f.querySelector('button[type=submit]');try{b.disabled=true;const r=await A('/newsletter/send','POST',Object.fromEntries(new FormData(f)));f.reset();toast(`Newsletter queued for ${r.total} subscribers`);go('Newsletter')}catch(x){toast(x.message)}finally{b.disabled=false}};
  R.Newsletter=async function(){const n=await A('/list/newsletter'),c=await A('/newsletter/campaigns');window._em=n.map(x=>x.email).join(',');return `<div class="card" style="padding:16px;margin-bottom:16px"><h3>Mass message to all newsletter subscribers</h3><p style="font-size:.9rem;opacity:.75">One campaign is queued for every valid subscriber. Delivery is processed by the server queue.</p><form onsubmit="sendNewsletterNow(event)"><label>Subject</label><input name="subject" required maxlength="180" placeholder="New PinoyAmbula update"><label>Message</label><textarea name="message" rows="8" maxlength="10000" required placeholder="Write the newsletter message..."></textarea><button type="submit" class="btn">Send to all subscribers (${n.length})</button></form></div><div class="admin-fix-toolbar">${btn('Copy all emails',`navigator.clipboard.writeText(_em).then(()=>toast('Emails copied'))`,'btn s o')}${btn('⬇ CSV',`exp('newsletter')`,'btn s o')}<span>${n.length} subscribers</span></div>${c.length?'<h3>Recent campaigns</h3>'+tbl(c,[["#",x=>x.id],["Created",x=>esc0(typeof kuwaitDateTime==='function'?kuwaitDateTime(x.created):x.created)],["Subject",x=>esc0(x.subject)],["Status",x=>esc0(x.status)],["Total",x=>x.total],["Sent",x=>x.sent],["Failed",x=>x.failed]]):'<p>No campaigns yet.</p>'}`};
})();
