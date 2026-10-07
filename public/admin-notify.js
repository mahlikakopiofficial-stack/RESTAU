(function(){
  if(!document.title.includes('Admin')||window.__adminLiveStarted)return;
  window.__adminLiveStarted=true;
  const adminToken=()=>tk('at');
  const seen={orders:0,inquiries:0,messages:0};
  let fallbackTimer=null,reconnectTimer=null,reconnectDelay=1000,controller=null;
  const advance=ev=>{
    if(ev.type==='order')seen.orders=Math.max(seen.orders,Number(ev.id)||0);
    else if(ev.type==='inquiry')seen.inquiries=Math.max(seen.inquiries,Number(ev.id)||0);
    else if(ev.type==='message')seen.messages=Math.max(seen.messages,Number(ev.id)||0);
  };
  const handleEvent=ev=>{
    if(!ev?.type)return;
    advance(ev);
    if(ev.type==='order'){
      toast('🔔 New order #'+ev.id+' from '+(ev.name||'customer'));
      if(typeof Notification!=='undefined'&&Notification.permission==='granted')try{new Notification('New PinoyAmbula order',{body:'Order #'+ev.id+' from '+(ev.name||'customer')});}catch(e){}
      if(typeof go==='function')go('Orders');
    }else if(ev.type==='inquiry'){
      toast('💬 New inquiry from '+(ev.name||'customer'));
      if(typeof Notification!=='undefined'&&Notification.permission==='granted')try{new Notification('New PinoyAmbula inquiry',{body:'Inquiry from '+(ev.name||'customer')});}catch(e){}
      if(typeof go==='function')go('Inquiries');
    }else if(ev.type==='message'){
      toast('💬 New customer message from '+(ev.name||'customer'));
      if(typeof Notification!=='undefined'&&Notification.permission==='granted')try{new Notification('New PinoyAmbula customer message',{body:'Message from '+(ev.name||'customer')});}catch(e){}
      if(typeof go==='function')go('Inquiries');
    }
  };
  const startFallback=()=>{
    if(fallbackTimer||!adminToken())return;
    const poll=async()=>{
      if(!adminToken()){clearInterval(fallbackTimer);fallbackTimer=null;return;}
      try{
        const qs=new URLSearchParams({orders:String(seen.orders),inquiries:String(seen.inquiries),messages:String(seen.messages)});
        const response=await fetch((window.PINOY_RUNTIME?.apiOrigin||'')+'/api/admin/notifications?'+qs.toString(),{headers:{Authorization:'Bearer '+adminToken(),Accept:'application/json'},cache:'no-store'});
        if(!response.ok)throw new Error('notification fallback '+response.status);
        const data=await response.json();
        for(const ev of (Array.isArray(data.events)?data.events:[]))handleEvent(ev);
        seen.orders=Math.max(seen.orders,Number(data.orders)||0);
        seen.inquiries=Math.max(seen.inquiries,Number(data.inquiries)||0);
        seen.messages=Math.max(seen.messages,Number(data.messages)||0);
      }catch(e){}
    };
    poll();
    fallbackTimer=setInterval(poll,1000);
  };
  const stopFallback=()=>{if(fallbackTimer){clearInterval(fallbackTimer);fallbackTimer=null;}};
  const connect=()=>{
    if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null;}
    try{controller?.abort()}catch(e){}
    controller=new AbortController();
    fetch((window.PINOY_RUNTIME?.apiOrigin||'')+'/api/admin/events',{method:'GET',headers:{Authorization:'Bearer '+adminToken(),Accept:'text/event-stream'},cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error('Live admin stream '+response.status);
        stopFallback();
        reconnectDelay=1000;
        const reader=response.body?.getReader();
        if(!reader)throw new Error('Live admin stream unavailable');
        const decoder=new TextDecoder();let buffer='';
        while(true){
          const part=await reader.read();if(part.done)break;
          buffer+=decoder.decode(part.value,{stream:true});
          const frames=buffer.split('\n\n');buffer=frames.pop()||'';
          for(const frame of frames){
            const data=frame.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('');
            if(!data)continue;
            try{handleEvent(JSON.parse(data));}catch(e){}
          }
        }
        throw new Error('Live admin stream closed');
      })
      .catch(()=>{
        if(!adminToken())return;
        startFallback();
        reconnectTimer=setTimeout(connect,reconnectDelay);
        reconnectDelay=Math.min(reconnectDelay*2,10000);
      });
  };
  if(typeof Notification!=='undefined'&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});
  startFallback();
  connect();
})();