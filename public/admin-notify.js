(function(){
  if(!document.title.includes('Admin')||window.__adminLiveStarted)return;
  window.__adminLiveStarted=true;

  const adminToken=()=>tk('at');
  const seen={orders:0,inquiries:0,messages:0};
  let reconnectTimer=null,reconnectDelay=1000,controller=null;

  const cursorKey=type=>type==='order'?'orders':type==='inquiry'?'inquiries':type==='message'?'messages':null;

  const advance=ev=>{
    const key=cursorKey(ev.type);
    if(key)seen[key]=Math.max(seen[key],Number(ev.id)||0);
  };

  const handleEvent=ev=>{
    if(!ev?.type)return;

    if(ev.type==='ready'){
      seen.orders=Math.max(seen.orders,Number(ev.orders)||0);
      seen.inquiries=Math.max(seen.inquiries,Number(ev.inquiries)||0);
      seen.messages=Math.max(seen.messages,Number(ev.messages)||0);
      return;
    }

    const key=cursorKey(ev.type);
    const id=Number(ev.id)||0;
    if(key&&id&&id<=seen[key])return;

    window.dispatchEvent(new CustomEvent('admin-live-event',{detail:ev}));
    advance(ev);

    if(ev.type==='order'){
      toast('🔔 New order #'+ev.id+' from '+(ev.name||'customer'));
      if(typeof Notification!=='undefined'&&Notification.permission==='granted')try{
        new Notification('New PinoyAmbula order',{body:'Order #'+ev.id+' from '+(ev.name||'customer')});
      }catch(e){}
      if(typeof go==='function')go('Orders');
    }else if(ev.type==='inquiry'){
      toast('💬 New inquiry from '+(ev.name||'customer'));
      if(typeof Notification!=='undefined'&&Notification.permission==='granted')try{
        new Notification('New PinoyAmbula inquiry',{body:'Inquiry from '+(ev.name||'customer')});
      }catch(e){}
      if(typeof go==='function')go('Inquiries');
    }else if(ev.type==='message'){
      toast('💬 New customer message from '+(ev.name||'customer'));
      if(typeof Notification!=='undefined'&&Notification.permission==='granted')try{
        new Notification('New PinoyAmbula customer message',{body:'Message from '+(ev.name||'customer')});
      }catch(e){}
      if(typeof go==='function')go('Inquiries');
    }
  };

  const connect=()=>{
    if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null;}
    try{controller?.abort()}catch(e){}

    controller=new AbortController();

    const params=new URLSearchParams();
    if(seen.orders||seen.inquiries||seen.messages){
      params.set('orders',String(seen.orders));
      params.set('inquiries',String(seen.inquiries));
      params.set('messages',String(seen.messages));
    }

    const base=(window.PINOY_RUNTIME?.apiOrigin||'')+'/api/admin/events';
    const url=params.toString()?base+'?'+params.toString():base;

    fetch(url,{
      method:'GET',
      headers:{
        Authorization:'Bearer '+adminToken(),
        Accept:'text/event-stream'
      },
      cache:'no-store',
      signal:controller.signal
    }).then(async response=>{
      if(!response.ok)throw new Error('Live admin stream '+response.status);

      reconnectDelay=1000;
      const reader=response.body?.getReader();
      if(!reader)throw new Error('Live admin stream unavailable');

      const decoder=new TextDecoder();
      let buffer='';

      while(true){
        const part=await reader.read();
        if(part.done)break;

        buffer+=decoder.decode(part.value,{stream:true});
        const frames=buffer.split('\n\n');
        buffer=frames.pop()||'';

        for(const frame of frames){
          const data=frame
            .split('\n')
            .filter(x=>x.startsWith('data:'))
            .map(x=>x.slice(5).trim())
            .join('');

          if(!data)continue;
          try{handleEvent(JSON.parse(data));}catch(e){}
        }
      }

      throw new Error('Live admin stream closed');
    }).catch(()=>{
      if(!adminToken())return;
      reconnectTimer=setTimeout(connect,reconnectDelay);
      reconnectDelay=Math.min(reconnectDelay*2,10000);
    });
  };

  if(typeof Notification!=='undefined'&&Notification.permission==='default')
    Notification.requestPermission().catch(()=>{});

  connect();
})();