'use strict';

const API_VERSION=String(process.env.WHATSAPP_API_VERSION||'v23.0').trim();
const TOKEN=String(process.env.WHATSAPP_ACCESS_TOKEN||'').trim();
const PHONE_NUMBER_ID=String(process.env.WHATSAPP_PHONE_NUMBER_ID||'').trim();

function clean(v){return String(v??'').replace(/[^0-9]/g,'');}
function configured(){return Boolean(TOKEN&&PHONE_NUMBER_ID);}
function normalize(v){
  let n=clean(v);
  if(!n)return '';
  if(n.startsWith('00'))n=n.slice(2);
  if(/^\d{8}$/.test(n))n='965'+n;
  return /^\d{8,15}$/.test(n)?n:'';
}

async function sendWhatsAppText(to,text){
  if(!configured())return {skipped:true,reason:'WhatsApp provider is not configured'};
  const phone=normalize(to);
  if(!phone)return {skipped:true,reason:'Invalid phone number'};
  const response=await fetch(
    'https://graph.facebook.com/'+API_VERSION+'/'+encodeURIComponent(PHONE_NUMBER_ID)+'/messages',
    {
      method:'POST',
      headers:{
        authorization:'Bearer '+TOKEN,
        'content-type':'application/json'
      },
      body:JSON.stringify({
        messaging_product:'whatsapp',
        recipient_type:'individual',
        to:phone,
        type:'text',
        text:{preview_url:false,body:String(text||'').slice(0,4096)}
      })
    }
  );
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||'WhatsApp API request failed');
  return {sent:true,id:data?.messages?.[0]?.id||null};
}

function status(){return {configured:configured(),phoneNumberConfigured:Boolean(PHONE_NUMBER_ID),accessTokenConfigured:Boolean(TOKEN)}}

module.exports={sendWhatsAppText,configured,status,normalize};