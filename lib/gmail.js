'use strict';

const https=require('https');
const fs=require('fs');
const path=require('path');

const OAUTH_SCOPE='https://www.googleapis.com/auth/gmail.send';
const REDIRECT_DEFAULT='https://pinoyambula.com/api/gmail/oauth/callback';

function clean(v){return String(v??'').replace(/[\r\n]/g,'').trim();}
function required(name){const value=clean(process.env[name]);if(!value)throw new Error(name+' is not configured');return value;}
function requestJson(url,options={},body=null){
  return new Promise((resolve,reject)=>{
    const req=https.request(url,{...options,timeout:15000},res=>{
      let data='';res.setEncoding('utf8');res.on('data',chunk=>data+=chunk);res.on('end',()=>{
        let parsed;try{parsed=JSON.parse(data||'{}')}catch{return reject(new Error('Google returned invalid JSON'))}
        if(res.statusCode<200||res.statusCode>=300)return reject(new Error('Google API: '+(parsed.error_description||parsed.error||('HTTP '+res.statusCode))));
        resolve(parsed);
      });
    });
    req.on('timeout',()=>req.destroy(new Error('Google API timeout')));req.on('error',reject);if(body)req.write(body);req.end();
  });
}
function oauthConfig(){return {clientId:required('GMAIL_CLIENT_ID'),clientSecret:required('GMAIL_CLIENT_SECRET'),redirectUri:clean(process.env.GMAIL_REDIRECT_URI||REDIRECT_DEFAULT)};}
function getAuthorizationUrl(state){
  const c=oauthConfig();
  const nonce=clean(state);
  if(!/^[A-Za-z0-9_-]{32,200}$/.test(nonce))throw new Error('A valid one-time Gmail OAuth state is required');
  return 'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:'code',access_type:'offline',prompt:'consent',scope:OAUTH_SCOPE,state:nonce}).toString();
}
function saveRefreshToken(token){
  const envPath=path.join(__dirname,'..','.env');let content='';
  try{content=fs.readFileSync(envPath,'utf8')}catch{}
  const line='GMAIL_REFRESH_TOKEN='+clean(token);
  content=/^GMAIL_REFRESH_TOKEN=/m.test(content)?content.replace(/^GMAIL_REFRESH_TOKEN=.*$/m,line):content+(content.endsWith('\n')||!content?'':'\n')+line+'\n';
  fs.writeFileSync(envPath,content,{mode:0o600});process.env.GMAIL_REFRESH_TOKEN=clean(token);
}
async function exchangeCode(code){
  const c=oauthConfig();
  const body=new URLSearchParams({code:String(code),client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri,grant_type:'authorization_code'}).toString();
  const token=await requestJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}},body);
  if(!token.refresh_token)throw new Error('Google did not return a refresh token. Re-authorize with consent.');
  saveRefreshToken(token.refresh_token);return token;
}
async function accessToken(){
  const refresh=clean(process.env.GMAIL_REFRESH_TOKEN);if(!refresh)throw new Error('GMAIL_REFRESH_TOKEN is not configured. Complete Gmail authorization first.');
  const c=oauthConfig();
  const body=new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,refresh_token:refresh,grant_type:'refresh_token'}).toString();
  const token=await requestJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}},body);
  return token.access_token;
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function configuredReceiptLogoUrl(site){
  // Mirror the admin receipt template: receipt_logo_url first, then logo_url.
  // Read settings from the live SQLite database so uploaded logo changes need
  // no code change and every email uses the exact same saved image as receipts.
  let configured='';
  try{
    const Database=require('better-sqlite3');
    const dbPath=path.join(__dirname,'..','data','resto.db');
    const db=new Database(dbPath,{readonly:true,fileMustExist:true,timeout:1000});
    try{
      const rows=db.prepare("SELECT k,v FROM settings WHERE k IN ('receipt_logo_url','logo_url')").all();
      const values=Object.fromEntries(rows.map(row=>[row.k,clean(row.v)]));
      configured=values.receipt_logo_url||values.logo_url||'';
    }finally{db.close();}
  }catch(error){
    console.error('EMAIL_BRANDING_LOGO_LOOKUP_FAILED',error.message);
  }
  if(!configured)return '';
  if(/^https?:\\/\\//i.test(configured))return configured;
  if(configured.startsWith('//'))return 'https:'+configured;
  // Only permit an HTTP(S) URL or a relative public asset path.
  if(/^[a-z][a-z0-9+.-]*:/i.test(configured))return '';
  return site+'/'+configured.replace(/^\\/+/, '');
}
function brandedHtml(html){
  const content=String(html||'');
  if(!content.trim())return content;
  const site=clean(process.env.PUBLIC_BASE_URL||'https://pinoyambula.com').replace(/\/+$/,'')||'https://pinoyambula.com';
  const logoUrl=configuredReceiptLogoUrl(site);
  const brandName=clean(process.env.RESTO_NAME||'PinoyAmbula')||'PinoyAmbula';
  return '<!doctype html><html lang="en"><head><meta charset="UTF-8"></head>'+
    '<body style="margin:0;padding:0;background-color:#f5f1e8">'+
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Message from '+escapeHtml(brandName)+'</div>'+
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f5f1e8"><tr><td align="center" style="padding:24px 10px">'+
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background-color:#ffffff;border:1px solid #eadfca;border-collapse:separate;border-spacing:0">'+
    '<tr><td align="center" bgcolor="#fffaf0" style="padding:20px 16px 16px;border-bottom:4px solid #f2c94c">'+
    (logoUrl?'<a href="'+escapeHtml(site)+'" style="text-decoration:none">'+
    '<img src="'+escapeHtml(logoUrl)+'" alt="'+escapeHtml(brandName)+' logo" width="180" style="display:block;width:auto;max-width:180px;max-height:90px;height:auto;object-fit:contain;margin:0 auto 8px;border:0;outline:none;text-decoration:none"></a>':'')+
    '<div style="font-family:Arial,sans-serif;font-size:20px;line-height:1.3;font-weight:bold;color:#7b2d26">'+escapeHtml(brandName)+'</div>'+
    '</td></tr><tr><td style="padding:20px 22px;font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#302a28">'+content+'</td></tr>'+
    '<tr><td align="center" style="padding:15px 18px;background-color:#fffaf0;border-top:1px solid #eee1c8;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#6f625c">'+
    'Official '+escapeHtml(brandName)+' email · <a href="'+escapeHtml(site)+'" style="color:#7b2d26">'+escapeHtml(site.replace(/^https?:\/\//i,''))+'</a>'+
    '</td></tr></table></td></tr></table></body></html>';
}
function encodeBase64Url(value){return Buffer.from(value,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function sendMail({to,subject,text,html}){
  const user=required('GMAIL_USER'),recipient=clean(to);
  required('GMAIL_CLIENT_ID'); required('GMAIL_CLIENT_SECRET'); required('GMAIL_REFRESH_TOKEN');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient))throw new Error('Invalid recipient');
  const fromName=clean(process.env.GMAIL_FROM_NAME||'PinoyAmbula'),fromEmail=clean(process.env.GMAIL_FROM_EMAIL||user),boundary='pinoyambula-reset-'+Date.now();
  const message=['From: '+fromName+' <'+fromEmail+'>','To: <'+recipient+'>','Subject: '+clean(subject),'MIME-Version: 1.0','Content-Type: multipart/alternative; boundary="'+boundary+'"','',
    '--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit','',String(text||''),'',
    '--'+boundary,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: 8bit','',brandedHtml(html),'','--'+boundary+'--'].join('\r\n');
  const body=JSON.stringify({raw:encodeBase64Url(message)});
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const token=await accessToken();
      return await requestJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},body);
    }catch(error){
      lastError=error;
      console.error('GMAIL_SEND_ATTEMPT_FAILED',attempt,clean(recipient),error.message);
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*attempt));
    }
  }
  throw lastError||new Error('Gmail send failed');
}
module.exports={getAuthorizationUrl,exchangeCode,sendMail,OAUTH_SCOPE,REDIRECT_DEFAULT};
