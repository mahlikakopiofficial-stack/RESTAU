(function(){
  if(!document.title.includes('Admin'))return;

  const handleOrder=ev=>{
    if(!ev?.id)return;
    toast('🔔 New order #'+ev.id+' from '+(ev.name||'customer'));
    if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
      try{new Notification('New PinoyAmbula order',{body:'Order #'+ev.id+' from '+(ev.name||'customer')});}catch(e){}
    }
    if(typeof go==='function')go('Orders');
  };

  let controller=null;
  let reconnectTimer=null;
  let reconnectDelay=1000;

  const connect=()=>{
    if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null;}
    try{controller?.abort()}catch(e){}
    controller=new AbortController();

    fetch((window.PINOY_RUNTIME?.apiOrigin||'')+'/api/admin/events',{
      method:'GET',
      headers:{Authorization:'Bearer '+tk('at'),Accept:'text/event-stream'},
      cache:'no-store',
      signal:controller.signal
    }).then(async response=>{
      if(!response.ok)throw new Error('Live order stream '+response.status);
      reconnectDelay=1000;
      const reader=response.body?.getReader();
      if(!reader)throw new Error('Live order stream unavailable');
      const decoder=new TextDecoder();
      let buffer='';
      while(true){
        const part=await reader.read();
        if(part.done)break;
        buffer+=decoder.decode(part.value,{stream:true});
        const frames=buffer.split('\n\n');
        buffer=frames.pop()||'';
        for(const frame of frames){
          const data=frame.split('\n')
            .filter(x=>x.startsWith('data:'))
            .map(x=>x.slice(5).trim())
            .join('');
          if(!data)continue;
          try{
            const ev=JSON.parse(data);
            if(ev.type==='order')handleOrder(ev);
          }catch(e){}
        }
      }
      throw new Error('Live order stream closed');
    }).catch(()=>{
      if(!tk('at'))return;
      reconnectTimer=setTimeout(connect,reconnectDelay);
      reconnectDelay=Math.min(reconnectDelay*2,30000);
    });
  };

  if(typeof Notification!=='undefined'&&Notification.permission==='default'){
    Notification.requestPermission().catch(()=>{});
  }
  connect();
})();