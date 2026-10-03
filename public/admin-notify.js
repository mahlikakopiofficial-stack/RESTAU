(function(){
  if(!document.title.includes('Admin'))return;
  let cursor={orders:0,inquiries:0,messages:0};
  const A0=(u,m,b)=>window.api('/admin'+u,m,b,'at');
  const start=()=>{
    A0('/notifications').then(x=>{cursor={orders:x.orders||0,inquiries:x.inquiries||0,messages:x.messages||0};}).catch(()=>{});
    if(window.__adminNotifyFixTimer)clearInterval(window.__adminNotifyFixTimer);
    window.__adminNotifyFixTimer=setInterval(async()=>{
      try{
        const x=await A0('/notifications?orders='+cursor.orders+'&inquiries='+cursor.inquiries+'&messages='+cursor.messages);
        cursor={orders:x.orders||cursor.orders,inquiries:x.inquiries||cursor.inquiries,messages:x.messages||cursor.messages};
        if(!x.events?.length)return;
        x.events.forEach(ev=>toast(ev.type==='order'?'🔔 New order #'+ev.id+' from '+(ev.name||'customer'):ev.type==='inquiry'?'💬 New inquiry from '+(ev.name||'customer'):'💬 New customer message from '+(ev.name||'customer')));
        if(typeof Notification!=='undefined'&&Notification.permission==='granted')x.events.forEach(ev=>new Notification(ev.type==='order'?'New PinoyAmbula order':'New PinoyAmbula customer message',{body:ev.type==='order'?`Order #${ev.id} from ${ev.name||'customer'}`:`Message from ${ev.name||'customer'}`}));
        if(x.events.some(ev=>ev.type==='order'))go('Orders');else if(x.events.some(ev=>ev.type!=='order'))go('Inquiries');
      }catch(e){}
    },5000);
    if(typeof Notification!=='undefined'&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});
  };
  start();
})();
