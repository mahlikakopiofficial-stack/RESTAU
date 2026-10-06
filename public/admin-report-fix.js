(function(){
  'use strict';
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const parts=value=>{
    const raw=String(value??'').trim();
    if(!raw)return null;
    const sql=raw.length===19&&raw[4]==='-'&&raw[7]==='-'&&raw[10]===' '&&raw[13]===':'&&raw[16]===':';
    const d=new Date(sql?raw.replace(' ','T')+'Z':raw);
    return Number.isNaN(d.valueOf())?null:d;
  };
  const format=value=>{
    const raw=String(value??'').trim();
    if(!raw)return '';
    const d=parts(raw);
    if(!d)return raw;
    return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
  };
  if(typeof window.kuwaitToday!=='function')window.kuwaitToday=today;
  if(typeof window.kuwaitDateTime!=='function')window.kuwaitDateTime=format;
  window.adminKuwaitToday=typeof window.kuwaitToday==='function'?window.kuwaitToday:today;
  window.adminKuwaitDateTime=typeof window.kuwaitDateTime==='function'?window.kuwaitDateTime:format;
})();
