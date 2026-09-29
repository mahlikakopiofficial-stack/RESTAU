'use strict';

const https=require('https');
const fs=require('fs');
const path=require('path');

const OAUTH_SCOPE='https://www.googleapis.com/auth/gmail.send';
const REDIRECT_DEFAULT='https://pinoyambulakw.duckdns.org/api/gmail/oauth/callback';

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
function oauthConfig(){return {clientId:required('GMAIL_CLIENT_ID'),clientSecret:required('GMAIL_CLIENT_SECRET'),redirectUri:clean(process.env.GMAIL_REDIRECT_URI||REDIRECT_DEFAULT),state:required('GMAIL_OAUTH_STATE')};}
function getAuthorizationUrl(){
  const c=oauthConfig();
  return 'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:'code',access_type:'offline',prompt:'consent',scope:OAUTH_SCOPE,state:c.state}).toString();
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
function encodeBase64Url(value){return Buffer.from(value,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function sendMail({to,subject,text,html}){
  const user=required('GMAIL_USER'),recipient=clean(to);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient))throw new Error('Invalid recipient');
  const fromName=clean(process.env.GMAIL_FROM_NAME||'PinoyAmbula'),boundary='pinoyambula-reset-'+Date.now();
  const message=['From: '+fromName+' <'+user+'>','To: <'+recipient+'>','Subject: '+clean(subject),'MIME-Version: 1.0','Content-Type: multipart/alternative; boundary="'+boundary+'"','',
    '--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit','',String(text||''),'',
    '--'+boundary,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: 8bit','',String(html||''),'','--'+boundary+'--'].join('\r\n');
  const token=await accessToken(),body=JSON.stringify({raw:encodeBase64Url(message)});
  return requestJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},body);
}
module.exports={getAuthorizationUrl,exchangeCode,sendMail,OAUTH_SCOPE,REDIRECT_DEFAULT};
