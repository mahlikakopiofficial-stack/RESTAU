'use strict';
const fs=require('fs');
const file=process.argv[2]||'server.js';
let s=fs.readFileSync(file,'utf8');
if(s.includes('PASSWORD_RESET_GMAIL_V2')){console.log('PASSWORD_RESET_GMAIL_V2 already applied');process.exit(0)}
const requireNeed="const express=require('express'),Database=require('better-sqlite3'),multer=require('multer');";
if(!s.includes(requireNeed)) throw new Error('Expected express require line not found');
s=s.replace(requireNeed, requireNeed+"\nconst {sendMail}=require('./lib/gmail');");
const tableNeed="CREATE TABLE IF NOT EXISTS loyalty_redemptions(customer_id INTEGER NOT NULL,threshold INTEGER NOT NULL,order_id INTEGER NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(customer_id,threshold));";
if(!s.includes(tableNeed)) throw new Error('Expected database table marker not found');
s=s.replace(tableNeed, tableNeed+"\nCREATE TABLE IF NOT EXISTS password_resets(id INTEGER PRIMARY KEY,customer_id INTEGER NOT NULL,token_hash TEXT UNIQUE NOT NULL,expires_at INTEGER NOT NULL,used INTEGER DEFAULT 0,created_at INTEGER DEFAULT (strftime('%s','now')));\n");
const old="app.post('/api/password-reset',lim(5),w((q,r)=>{const phone=String(q.body.phone||'').trim(),email=String(q.body.email||'').trim().toLowerCase();\n  need({phone},'phone');\n  if(email&&!/^\\S+@\\S+\\.\\S+$/.test(email))throw new Error('Enter a valid email address.');\n  const customer=one('SELECT id,name,email,phone FROM customers WHERE phone=?',phone);\n  if(customer&&(!email||String(customer.email||'').toLowerCase()===email)){\n    const inquiryId=db.prepare(\"INSERT INTO inquiries(name,email,phone,type,msg) VALUES(?,?,?,'Password reset','Customer requested a password reset.')\")\n      .run(customer.name,customer.email||email,customer.phone).lastInsertRowid;\n    db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(inquiryId,'customer','Password reset requested. Verify identity using the registered contact before issuing a temporary password.');\n  }\n  r.json({ok:1,message:'If the details match an account, staff will verify your identity and contact you using the registered number.'});\n}));";
if(!s.includes(old)) throw new Error('Expected old password-reset route not found');
const neu=`/* PASSWORD_RESET_GMAIL_V2 */
app.post('/api/password-reset',lim(5),w(async(q,r)=>{
  const email=String(q.body.email||'').trim().toLowerCase();
  if(!/^\\S+@\\S+\\.\\S+$/.test(email))throw new Error('Enter a valid email address.');
  const customer=one('SELECT id,name,email FROM customers WHERE lower(trim(email))=? LIMIT 1',email);
  const generic='If an account matches that email, a password reset link has been sent.';
  if(!customer)return r.json({ok:1,message:generic});
  db.prepare('UPDATE password_resets SET used=1 WHERE customer_id=? AND used=0').run(customer.id);
  const raw=crypto.randomBytes(32).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(raw).digest('hex');
  const expires=Date.now()+30*60*1000;
  db.prepare('INSERT INTO password_resets(customer_id,token_hash,expires_at) VALUES(?,?,?)').run(customer.id,tokenHash,expires);
  const base=String(process.env.PUBLIC_BASE_URL||'https://pinoyambulakw.duckdns.org').replace(/\\/$/,'');
  const link=base+'/reset-password.html?token='+encodeURIComponent(raw);
  const name=String(customer.name||'there').replace(/[<>]/g,'');
  await sendMail({
    to:customer.email,
    subject:'Reset your PinoyAmbula password',
    text:'Hello '+name+',\\n\\nWe received a request to reset your PinoyAmbula password. Use this link within 30 minutes:\\n'+link+'\\n\\nIf you did not request this, you can ignore this email.',
    html:'<p>Hello '+name+',</p><p>We received a request to reset your PinoyAmbula password.</p><p><a href="'+link+'">Reset your password</a></p><p>This link expires in 30 minutes and can be used only once.</p><p>If you did not request this, you can ignore this email.</p>'
  });
  r.json({ok:1,message:generic});
}));
app.post('/api/password-reset/confirm',lim(8),w((q,r)=>{
  const token=String(q.body.token||'').trim(),password=String(q.body.password||'');
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid or expired reset link.');
  if(password.length<6)throw new Error('Password must be at least 6 characters.');
  const hashToken=crypto.createHash('sha256').update(token).digest('hex');
  const row=one('SELECT id,customer_id FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>? LIMIT 1',hashToken,Date.now());
  if(!row)throw new Error('Invalid or expired reset link.');
  const tx=db.transaction(()=>{
    const used=db.prepare('UPDATE password_resets SET used=1 WHERE id=? AND used=0').run(row.id);
    if(used.changes!==1)throw new Error('Invalid or expired reset link.');
    db.prepare('UPDATE customers SET pw=?,auth_version=COALESCE(auth_version,0)+1 WHERE id=?').run(hash(password),row.customer_id);
  });
  tx();
  r.json({ok:1,message:'Password reset successfully. You can now log in with your new password.'});
}));`;
s=s.replace(old,neu);
s=s.replace("const w=f=>(q,r)=>{try{f(q,r)}catch(e){r.status(400).json({error:e.message})}};","const w=f=>(q,r)=>{try{Promise.resolve(f(q,r)).catch(e=>r.status(400).json({error:e.message}))}catch(e){r.status(400).json({error:e.message})}};");
fs.writeFileSync(file,s);
console.log('Applied Gmail password reset integration to '+file);
