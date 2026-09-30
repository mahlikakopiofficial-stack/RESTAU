const fs=require('fs'),path=require('path'),crypto=require('crypto');
try{fs.readFileSync(path.join(__dirname,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2]})}catch(e){}
const express=require('express'),Database=require('better-sqlite3'),multer=require('multer');
const {sendMail,getAuthorizationUrl,exchangeCode}=require('./lib/gmail');
const {notifyInquiryReceived,notifyInquiryReply,notifyAdminInquiry,notifyAdminCustomerMessage,notifyNewsletterWelcome,sendNewsletterCampaign,notifyOrderReceived,notifyAdminOrder,notifyOrderStatus,notifyPaymentStatus,notifySubscriptionReceived,notifySubscriptionStatus,notifySubscriptionPaymentStatus,sendPasswordResetEmail}=require('./lib/notifications');
const E=process.env,PORT=E.PORT||3000,SECRET=E.SECRET||'change-me',ADMIN_PW=E.ADMIN_PASSWORD||'admin123',CUR=E.CURRENCY||'KWD',FEE=+(E.DELIVERY_FEE||1),NAME=E.RESTO_NAME||'PinoyAmbula';
if(E.NODE_ENV==='production'&&(SECRET.length<16||SECRET.startsWith('put-a')||SECRET==='change-me'||ADMIN_PW==='admin123'||ADMIN_PW==='change-this-now')){console.error('STOP: set a strong SECRET (16+ chars) and a real ADMIN_PASSWORD in .env');process.exit(1)}
const DATA=path.join(__dirname,'data'),UP=path.join(__dirname,'uploads');[DATA,UP].forEach(d=>fs.mkdirSync(d,{recursive:true}));
const db=new Database(path.join(DATA,'resto.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY,cat TEXT,region TEXT DEFAULT 'Filipino',name TEXT,descr TEXT,price REAL,img TEXT,emoji TEXT,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY,name TEXT,phone TEXT UNIQUE,email TEXT,pw TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,customer_id INTEGER,name TEXT,phone TEXT,address TEXT,paci TEXT,notes TEXT,items TEXT,total REAL,pay TEXT DEFAULT 'COD',status TEXT DEFAULT 'New',created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subs(id INTEGER PRIMARY KEY,customer_id INTEGER,name TEXT,phone TEXT,address TEXT,paci TEXT,plan TEXT,start TEXT,end TEXT,price REAL,status TEXT DEFAULT 'Active',created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS inquiries(id INTEGER PRIMARY KEY,customer_id INTEGER,order_id INTEGER,name TEXT,email TEXT,phone TEXT,type TEXT,msg TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS password_reset_tokens(id INTEGER PRIMARY KEY,customer_id INTEGER NOT NULL,token_hash TEXT UNIQUE NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS newsletter(id INTEGER PRIMARY KEY,email TEXT UNIQUE,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS gallery(id INTEGER PRIMARY KEY,img TEXT,caption TEXT);
CREATE TABLE IF NOT EXISTS testimonials(id INTEGER PRIMARY KEY,name TEXT,text TEXT,stars INTEGER DEFAULT 5);
CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,name TEXT,price REAL,descr TEXT,active INTEGER DEFAULT 1,includes TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS newsletter_campaigns(id INTEGER PRIMARY KEY,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT DEFAULT 'Queued',total INTEGER DEFAULT 0,sent INTEGER DEFAULT 0,failed INTEGER DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP,completed TEXT);
CREATE TABLE IF NOT EXISTS newsletter_jobs(id INTEGER PRIMARY KEY,campaign_id INTEGER NOT NULL,email TEXT NOT NULL,status TEXT DEFAULT 'Pending',error TEXT,sent_at TEXT,UNIQUE(campaign_id,email));
CREATE TABLE IF NOT EXISTS loyalty_redemptions(customer_id INTEGER NOT NULL,threshold INTEGER NOT NULL,order_id INTEGER NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(customer_id,threshold));
`);
const ensureColumn=(table,column,definition)=>{
  if(!db.prepare(`PRAGMA table_info(${table})`).all().some(x=>x.name===column))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
[
  ['items','discount_price','REAL DEFAULT 0'],
  ['customers','address',"TEXT DEFAULT ''"],
  ['customers','paci',"TEXT DEFAULT ''"],
  ['customers','birthday',"TEXT DEFAULT ''"],
  ['customers','nationality',"TEXT DEFAULT ''"],
  ['customers','auth_version','INTEGER DEFAULT 0'],
  ['orders','subtotal','REAL DEFAULT 0'],
  ['orders','discount','REAL DEFAULT 0'],
  ['orders','email',"TEXT DEFAULT ''"],
  ['orders','promo_code',"TEXT DEFAULT ''"],
  ['orders','payment_status',"TEXT DEFAULT 'Pending'"],
  ['orders','confirmed_at','TEXT'],
  ['orders','delivered_at','TEXT'],
  ['orders','cancelled_at','TEXT'],
  ['orders','eta','TEXT'],
  ['orders','driver_name',"TEXT DEFAULT ''"],
  ['orders','driver_phone',"TEXT DEFAULT ''"],
  ['orders','status_message',"TEXT DEFAULT ''"],
  ['orders','received_at','TEXT'],
  ['orders','loyalty_reward','INTEGER DEFAULT 0'],
  ['orders','lat','REAL'],
  ['orders','lng','REAL'],
  ['orders','map_url',"TEXT DEFAULT ''"],
  ['gallery','media_type',"TEXT DEFAULT 'image'"],
  ['gallery','media_url',"TEXT DEFAULT ''"],
  ['subs','email',"TEXT DEFAULT ''"],
  ['subs','payment_method',"TEXT DEFAULT 'COD'"],
  ['subs','payment_status',"TEXT DEFAULT 'Pending'"],
  ['subs','duration_days','INTEGER DEFAULT 26'],
  ['subs','nickname',"TEXT DEFAULT ''"],
  ['plans','duration_days','INTEGER DEFAULT 26'],
  ['plans','img',"TEXT DEFAULT ''"],
  ['inquiries','customer_id','INTEGER'],
  ['inquiries','order_id','INTEGER']
].forEach(([table,column,definition])=>ensureColumn(table,column,definition));
db.exec(`CREATE TABLE IF NOT EXISTS inquiry_messages(
  id INTEGER PRIMARY KEY,
  inquiry_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created TEXT DEFAULT CURRENT_TIMESTAMP
);`);
if(!db.prepare('SELECT COUNT(*) n FROM items').get().n){
const ins=db.prepare('INSERT INTO items(cat,region,name,descr,price,emoji) VALUES(?,?,?,?,?,?)');
`Regular|Filipino|Chicken Adobo|Soy-vinegar braised chicken, garlic, bay leaf, steamed rice|2.500|🍗
Regular|Filipino|Sinigang na Baboy|Sour tamarind pork soup with vegetables|2.800|🍲
Regular|Filipino|Kare-Kare|Oxtail peanut stew with bagoong and vegetables|3.500|🥘
Regular|Filipino|Lechon Kawali|Crispy deep-fried pork belly with liver sauce|3.200|🥓
Regular|Filipino|Pancit Canton|Stir-fried noodles with chicken and vegetables|2.200|🍜
Budget|Filipino|Tapsilog|Beef tapa, garlic rice and fried egg|1.800|🍳
Budget|Filipino|Longsilog|Sweet longganisa, garlic rice and egg|1.600|🌭
Budget|Filipino|Adobo Rice Bowl|Budget chicken adobo over rice|1.500|🍚
Drinks|Filipino|Sago't Gulaman|Brown sugar syrup, tapioca pearls and jelly|0.750|🧋
Drinks|Filipino|Buko Juice|Fresh young coconut juice|0.900|🥥
Drinks|Filipino|Calamansi Juice|Filipino lime, sweet and tangy|0.800|🍋
Drinks|Filipino|Halo-Halo|Shaved ice, sweet beans, leche flan, ube ice cream|1.800|🍧
Catering|Filipino|Pancit Party Tray (10 pax)|Pancit bihon tray for gatherings|15.000|🍜
Catering|Filipino|Adobo Tray (20 pax)|Chicken adobo party tray with rice|30.000|🍗
Catering|Filipino|Lechon Belly (15 pax)|Whole roasted pork belly, order 1 day ahead|45.000|🐖
Other Asian|Japan|Chicken Katsu Curry|Crispy cutlet with Japanese curry rice|2.900|🍛
Other Asian|Japan|Salmon Sushi Roll|8-piece salmon maki roll|3.200|🍣
Other Asian|Korea|Bibimbap|Rice bowl with vegetables, beef and gochujang|3.000|🍲
Other Asian|Korea|Kimchi Jjigae|Spicy kimchi and pork stew|2.800|🌶️
Other Asian|Thailand|Pad Thai|Rice noodles, shrimp, peanuts and lime|2.800|🍜
Other Asian|Thailand|Green Curry|Coconut green curry with chicken and rice|2.900|🥥
Other Asian|Vietnam|Pho Bo|Beef noodle soup with herbs|3.000|🍜
Other Asian|Vietnam|Banh Mi|Crispy baguette with pork, pickles and herbs|1.900|🥖`.split('\n').forEach(l=>{const a=l.split('|');ins.run(...a.slice(0,4),+a[4],a[5])});
['Handaan feast|🍽️','Pancit for long life|🍜','Halo-halo summer|🍧','Lechon celebration|🐖','Sampaguita table|🌼','Kain tayo!|🍚'].forEach(x=>db.prepare('INSERT INTO gallery(caption,img) VALUES(?,NULL)').run(x));
[['Maria S.','Tastes just like my Lola\'s adobo. The delivery was fast and hot!',5],['Ahmed K.','Ordered catering for 30 people. Everyone loved the pancit and lechon.',5],['Joy R.','Budget meals are so filling. Tapsilog every Friday!',5]].forEach(x=>db.prepare('INSERT INTO testimonials(name,text,stars) VALUES(?,?,?)').run(...x));
}
const PLANS=[{id:'lunch26',name:'26-Day Lunch Plan',price:39,desc:'One Filipino lunch delivered daily for 26 days'},{id:'dinner26',name:'26-Day Dinner Plan',price:39,desc:'One Filipino dinner delivered daily for 26 days'},{id:'both26',name:'26-Day Lunch + Dinner',price:72,desc:'Lunch and dinner every day for 26 days'}];
db.exec(`CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT);CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,name TEXT,price REAL,descr TEXT,active INTEGER DEFAULT 1,includes TEXT DEFAULT '[]');`);
for(const c of['ALTER TABLE testimonials ADD COLUMN approved INTEGER DEFAULT 1',"ALTER TABLE inquiries ADD COLUMN status TEXT DEFAULT 'New'","ALTER TABLE plans ADD COLUMN includes TEXT DEFAULT '[]'"])try{db.exec(c)}catch(e){}
if(!db.prepare('SELECT COUNT(*) n FROM plans').get().n)PLANS.forEach(p=>db.prepare('INSERT INTO plans(id,name,price,descr,active,includes) VALUES(?,?,?,?,1,?)').run(p.id,p.name,p.price,p.desc,JSON.stringify(p.id==='lunch26'?['One Filipino lunch each day for 26 days','Daily delivery to your registered address','Cash on delivery']:p.id==='dinner26'?['One Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery']:['One Filipino lunch and one Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery'])));
const planInc=db.prepare("SELECT COUNT(*) n FROM plans WHERE includes IS NULL OR includes='' OR includes='[]'").get().n;if(planInc){db.prepare("UPDATE plans SET includes=? WHERE id='lunch26'").run(JSON.stringify(['One Filipino lunch each day for 26 days','Daily delivery to your registered address','Cash on delivery']));db.prepare("UPDATE plans SET includes=? WHERE id='dinner26'").run(JSON.stringify(['One Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery']));db.prepare("UPDATE plans SET includes=? WHERE id='both26'").run(JSON.stringify(['One Filipino lunch and one Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery']))}
const DEF={name:NAME,currency:CUR,fee:String(FEE),min_order:'0',accepting:'1',payment_card:'0',phone:'',hours:'',map_url:'',hero_img:'',hero_title:'Mabuhay! Kain Tayo 🇵🇭',hero_text:'Home-style Filipino cooking made with love — from everyday meals to fiesta catering, delivered to your door with payment options at checkout.'};
for(const k in DEF)db.prepare('INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)').run(k,DEF[k]);
db.prepare('UPDATE settings SET v=? WHERE k=? AND v=?').run(DEF.hero_text,'hero_text','Home-style Filipino cooking made with love — from everyday meals to fiesta catering. Delivered to your door, pay cash on delivery.');
const S=()=>Object.fromEntries(db.prepare('SELECT k,v FROM settings').all().map(x=>[x.k,x.v]));
const sweep=()=>db.prepare("UPDATE subs SET status='Completed' WHERE status='Active' AND \"end\"<date('now')").run();sweep();setInterval(sweep,36e5).unref();
const sig=p=>crypto.createHmac('sha256',SECRET).update(p).digest('base64url');
const mk=o=>{const p=Buffer.from(JSON.stringify({...o,exp:Date.now()+7*864e5})).toString('base64url');return p+'.'+sig(p)};
const rd=q=>{const[p,s]=(q.headers.authorization||'').slice(7).split('.');if(!p||s!==sig(p))return null;try{const o=JSON.parse(Buffer.from(p,'base64url'));return o.exp>Date.now()?o:null}catch{return null}};
const hash=pw=>{const s=crypto.randomBytes(8).toString('hex');return s+':'+crypto.scryptSync(pw,s,32).toString('hex')};
const chk=(pw,h)=>{if(!h)return false;const[s,x]=h.split(':');return crypto.scryptSync(pw,s,32).toString('hex')===x};
const w=f=>(q,r)=>{try{f(q,r)}catch(e){r.status(400).json({error:e.message})}};
const need=(o,...k)=>k.forEach(x=>{if(!String(o[x]||'').trim())throw new Error(x+' is required')});
const admin=(q,r,n)=>rd(q)?.r==='admin'?n():r.status(401).json({error:'Admin login required'});
const customerToken=q=>{const token=rd(q);if(token?.r!=='c')return null;const customer=one('SELECT auth_version FROM customers WHERE id=?',token.id);return customer&&+(token.v||0)===(customer.auth_version||0)?token:null};
const cust=(q,r,n)=>{const t=customerToken(q);if(!t)return r.status(401).json({error:'Login required'});q.cid=t.id;n()};
const one=(s,...a)=>db.prepare(s).get(...a);
const custId=(b,q)=>{const t=customerToken(q);if(t)return t.id;const p=String(b.phone).trim(),c=one('SELECT id FROM customers WHERE phone=?',p);return c?c.id:Number(db.prepare('INSERT INTO customers(name,phone,email) VALUES(?,?,?)').run(b.name,p,b.email||'').lastInsertRowid)};
const hits=new Map();setInterval(()=>hits.clear(),6e4).unref();
const lim=n=>(q,r,x)=>{const k=q.ip+q.path,c=(hits.get(k)||0)+1;hits.set(k,c);c>n?r.status(429).json({error:'Too many attempts. Please wait a minute and try again.'}):x()};
const safeEq=(a,b)=>{const h=v=>crypto.createHash('sha256').update(String(v??'')).digest();return crypto.timingSafeEqual(h(a),h(b))};
const escHtml=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);

const allowedOrigins = new Set([
  'https://localhost',
  'http://localhost',
  'https://pinoyambulakw.duckdns.org'
]);

app.use((q,r,n)=>{
  const origin=q.headers.origin;

  if(origin && allowedOrigins.has(origin)){
    r.setHeader('Access-Control-Allow-Origin',origin);
  }

  r.setHeader('Vary','Origin');
  r.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  r.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');

  if(q.method==='OPTIONS'){
    return r.sendStatus(204);
  }

  n();
});
app.use((q,r,n)=>{r.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'same-origin'});n()});
app.use(express.json({limit:'100kb'}));
app.get('/api/health',(q,r)=>r.json({ok:1,up:Math.round(process.uptime()),items:one('SELECT COUNT(*) n FROM items').n}));
app.get('/api/config',(q,r)=>{
  const st=S();
  r.json({
    ...st,
    fee:+st.fee||0,
    min_order:+st.min_order||0,
    accepting:st.accepting!=='0',
    approval_mode:st.approval_mode||'AUTO',
    payment_cod:st.payment_cod!=='0',
    payment_card:st.payment_card==='1',
    promo_enabled:st.promo_enabled!=='0'
  });
});
app.get('/api/menu',(q,r)=>r.json(db.prepare('SELECT * FROM items WHERE active=1 ORDER BY id').all()));
app.get('/api/plans',(q,r)=>r.json(db.prepare('SELECT id,name,price,descr AS "desc",includes,duration_days,img FROM plans WHERE active=1 ORDER BY rowid').all().map(p=>({...p,includes:(()=>{try{return JSON.parse(p.includes||'[]')}catch{return []}})()}))));
app.get('/api/gallery',(q,r)=>r.json(db.prepare('SELECT * FROM gallery ORDER BY id').all()));
app.get('/api/testimonials',(q,r)=>r.json(db.prepare('SELECT * FROM testimonials WHERE approved=1 ORDER BY id DESC').all()));
app.post('/api/testimonials',lim(5),w((q,r)=>{need(q.body,'name','text');db.prepare('INSERT INTO testimonials(name,text,stars,approved) VALUES(?,?,?,0)').run(String(q.body.name).slice(0,60),String(q.body.text).slice(0,500),Math.min(5,Math.max(1,+q.body.stars||5)));r.json({ok:1})}));
app.post('/api/newsletter',lim(20),async(q,r)=>{
  let inserted=false;
  try{
    const e=String(q.body.email||'').trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(e))throw new Error('Valid email required');
    const result=db.prepare('INSERT OR IGNORE INTO newsletter(email) VALUES(?)').run(e);
    inserted=!!result.changes;
    if(inserted)await notifyNewsletterWelcome(e);
    r.json({ok:1});
  }catch(error){
    if(inserted)db.prepare('DELETE FROM newsletter WHERE email=?').run(String(q.body.email||'').trim().toLowerCase());
    console.error('NEWSLETTER_WELCOME_FAILED',error.message);
    r.status(400).json({error:'Subscription could not be completed. Please try again later.'});
  }
});
app.get('/api/newsletter/unsubscribe',lim(20),w((q,r)=>{
  const email=String(q.query.email||'').trim().toLowerCase();
  const token=String(q.query.token||'');
  const expected=crypto.createHmac('sha256',SECRET).update('newsletter|'+email).digest('hex');
  if(!/^\S+@\S+\.\S+$/.test(email)||token!==expected)return r.status(400).type('html').send('<h2>Invalid unsubscribe link</h2><p>Please use the unsubscribe link from your newsletter.</p>');
  db.prepare('DELETE FROM newsletter WHERE email=?').run(email);
  r.type('html').send('<h2>You are unsubscribed</h2><p>'+escHtml(email)+' has been removed from the PinoyAmbula newsletter.</p><p>You can subscribe again from the restaurant website at any time.</p>');
}));
app.post('/api/inquiry',lim(20),w((q,r)=>{
  const b=q.body;
  need(b,'name','msg');
  if(!b.email&&!b.phone)throw new Error('Email or phone required');
  if(b.email&&!/^\S+@\S+\.\S+$/.test(String(b.email)))throw new Error('Valid email required');
  const token=customerToken(q);
  const customerId=token?token.id:null;
  const inquiry={
    id:Number(db.prepare('INSERT INTO inquiries(customer_id,name,email,phone,type,msg) VALUES(?,?,?,?,?,?)')
      .run(customerId,String(b.name).slice(0,100),String(b.email||'').slice(0,200),String(b.phone||'').slice(0,40),String(b.type||'General').slice(0,80),String(b.msg).slice(0,4000)).lastInsertRowid),
    customer_id:customerId,
    name:String(b.name).slice(0,100),
    email:String(b.email||'').slice(0,200),
    phone:String(b.phone||'').slice(0,40),
    type:String(b.type||'General').slice(0,80),
    msg:String(b.msg).slice(0,4000)
  };
  db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(inquiry.id,'customer',inquiry.msg);
  notifyAdminInquiry(inquiry);
  r.json({ok:1,id:inquiry.id});
}));
app.post('/api/register',lim(8),w((q,r)=>{
  const b=q.body;
  need(b,'name','phone','password');
  if(b.password.length<6)throw new Error('Password min 6 characters');
  if(b.email&&!/^\S+@\S+\.\S+$/.test(String(b.email)))throw new Error('Valid email required');
  const phone=String(b.phone).trim(),customer=one('SELECT * FROM customers WHERE phone=?',phone);
  const values=[String(b.name).slice(0,100),phone,String(b.email||'').slice(0,200),String(b.address||'').slice(0,500),String(b.paci||'').slice(0,80),validDate(b.birthday)||'',String(b.nationality||'').slice(0,100)];
  let id;
  if(customer){
    if(customer.pw)throw new Error('Phone already registered');
    db.prepare('UPDATE customers SET name=?,phone=?,email=?,address=?,paci=?,birthday=?,nationality=?,pw=? WHERE id=?').run(...values,hash(b.password),customer.id);
    id=customer.id;
  }else{
    id=Number(db.prepare('INSERT INTO customers(name,phone,email,address,paci,birthday,nationality,pw) VALUES(?,?,?,?,?,?,?,?)').run(...values,hash(b.password)).lastInsertRowid);
  }
  const version=one('SELECT auth_version FROM customers WHERE id=?',id)?.auth_version||0;
  r.json({token:mk({r:'c',id,v:version}),name:b.name});
}));
app.post('/api/login',lim(8),w((q,r)=>{const c=one('SELECT * FROM customers WHERE phone=?',String(q.body.phone||'').trim());if(!c||!chk(q.body.password||'',c.pw))return r.status(401).json({error:'Wrong phone or password'});r.json({token:mk({r:'c',id:c.id,v:c.auth_version||0}),name:c.name})}));
app.get('/api/gmail/oauth/start',(q,r)=>{
  try{
    r.redirect(getAuthorizationUrl());
  }catch(error){
    console.error('GMAIL_OAUTH_START_FAILED',error.message);
    r.status(500).send('Gmail authorization is not configured yet.');
  }
});
app.get('/api/gmail/oauth/callback',async(q,r)=>{
  try{
    const expected=String(E.GMAIL_OAUTH_STATE||'');
    if(!expected||String(q.query.state||'')!==expected)return r.status(400).send('Invalid OAuth state.');
    if(!q.query.code)return r.status(400).send('Google authorization was not completed.');
    await exchangeCode(String(q.query.code));
    r.type('html').send('<!doctype html><meta charset="utf-8"><title>Gmail connected</title><h2>Gmail connected successfully.</h2><p>You can close this window and return to PinoyAmbula.</p>');
  }catch(error){
    console.error('GMAIL_OAUTH_CALLBACK_FAILED',error.message);
    r.status(500).send('Gmail authorization failed. Check the server logs.');
  }
});
app.post('/api/password-reset',lim(5),async(q,r)=>{
  const email=String(q.body.email||'').trim().toLowerCase();
  const generic='If that email is registered, a password reset link has been sent.';
  try{
    if(!/^\S+@\S+\.\S+$/.test(email))return r.json({ok:1,message:generic});
    const customer=one('SELECT id,name,email FROM customers WHERE lower(trim(email))=?',email);
    if(!customer)return r.json({ok:1,message:generic});

    db.prepare('DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at<?').run(Date.now());
    db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE customer_id=? AND used_at IS NULL').run(Date.now(),customer.id);

    const raw=crypto.randomBytes(32).toString('base64url');
    const tokenHash=crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt=Date.now()+30*60*1000;
    db.prepare('INSERT INTO password_reset_tokens(customer_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)')
      .run(customer.id,tokenHash,expiresAt,Date.now());

    const base=String(E.PUBLIC_BASE_URL||'').replace(/\/$/,'');
    if(!base)throw new Error('PUBLIC_BASE_URL is not configured');
    const resetUrl=base+'/reset-password.html?token='+encodeURIComponent(raw);
    const safeName=String(customer.name||'Customer').replace(/[<>]/g,'');
    const text='Hello '+safeName+',\\n\\nWe received a request to reset your PinoyAmbula account password. Use this link within 30 minutes:\\n\\n'+resetUrl+'\\n\\nIf you did not request this, you can ignore this email.';
    const html='<p>Hello '+safeName+',</p><p>We received a request to reset your PinoyAmbula account password.</p><p><a href="'+resetUrl.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email.</p>';
    try{
      await sendMail({to:customer.email,subject:'Reset your PinoyAmbula password',text,html});
    }catch(mailError){
      db.prepare('DELETE FROM password_reset_tokens WHERE token_hash=?').run(tokenHash);
      console.error('PASSWORD_RESET_EMAIL_FAILED',mailError.message);
      return r.json({ok:1,message:generic});
    }
    r.json({ok:1,message:generic});
  }catch(error){
    console.error('PASSWORD_RESET_FAILED',error.message);
    r.json({ok:1,message:generic});
  }
});

app.post('/api/password-reset/confirm',lim(8),w((q,r)=>{
  const token=String(q.body.token||'').trim();
  const password=String(q.body.password||'');
  if(!token||token.length<40)throw new Error('Invalid or expired reset link.');
  if(password.length<6)throw new Error('Password must be at least 6 characters.');
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  const row=one('SELECT id,customer_id,expires_at,used_at FROM password_reset_tokens WHERE token_hash=?',tokenHash);
  if(!row||row.used_at||row.expires_at<Date.now())throw new Error('Invalid or expired reset link.');
  const tx=db.transaction(()=>{
    db.prepare('UPDATE customers SET pw=?,auth_version=auth_version+1 WHERE id=?').run(hash(password),row.customer_id);
    db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE customer_id=? AND used_at IS NULL').run(Date.now(),row.customer_id);
  });
  tx();
  r.json({ok:1,message:'Your password has been reset. You can now log in with your new password.'});
}));
app.get('/api/customer/inquiries',cust,w((q,r)=>{
  const rows=db.prepare('SELECT id,name,email,phone,type,msg,status,created,order_id FROM inquiries WHERE customer_id=? ORDER BY id DESC').all(q.cid);
  r.json(rows);
}));
app.get('/api/customer/orders/:id/chat',cust,w((q,r)=>{
  const order=one('SELECT id,status FROM orders WHERE id=? AND customer_id=?',q.params.id,q.cid);
  if(!order)return r.status(404).json({error:'Order not found'});
  if(['Delivered','Completed'].includes(order.status))return r.status(404).json({error:'Order chat is closed'});
  const inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE customer_id=? AND order_id=? ORDER BY id DESC LIMIT 1',q.cid,q.params.id);
  const messages=inquiry?db.prepare('SELECT id,author,message,created FROM inquiry_messages WHERE inquiry_id=? ORDER BY id').all(inquiry.id):[];
  r.json({order,inquiry,messages});
}));
app.post('/api/customer/orders/:id/chat',lim(20),cust,w((q,r)=>{
  need(q.body,'message');
  const order=one('SELECT id,status FROM orders WHERE id=? AND customer_id=?',q.params.id,q.cid);
  if(!order)return r.status(404).json({error:'Order not found'});
  if(['Delivered','Completed'].includes(order.status))return r.status(404).json({error:'Order chat is closed'});
  const c=one('SELECT name,email,phone FROM customers WHERE id=?',q.cid);
  const message=String(q.body.message).trim().slice(0,4000);
  if(!message)throw new Error('Message is required');
  let inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE customer_id=? AND order_id=? ORDER BY id DESC LIMIT 1',q.cid,q.params.id);
  if(!inquiry){
    const id=Number(db.prepare('INSERT INTO inquiries(customer_id,order_id,name,email,phone,type,msg) VALUES(?,?,?,?,?,?,?)').run(q.cid,q.params.id,c.name,c.email||'',c.phone||'','Order #'+q.params.id,message).lastInsertRowid);
    inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE id=?',id);
  }else{
    db.prepare("UPDATE inquiries SET status='New' WHERE id=?").run(inquiry.id);
  }
  db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(inquiry.id,'customer',message);
  notifyAdminCustomerMessage(inquiry,message);
  r.json({ok:1,id:inquiry.id,orderId:Number(q.params.id)});
}));
app.get('/api/customer/inquiries/:id/messages',cust,w((q,r)=>{
  const inquiry=one('SELECT id,customer_id,msg,created,status FROM inquiries WHERE id=? AND customer_id=?',q.params.id,q.cid);
  if(!inquiry)return r.status(404).json({error:'Conversation not found'});
  const messages=db.prepare('SELECT id,author,message,created FROM inquiry_messages WHERE inquiry_id=? ORDER BY id').all(inquiry.id);
  r.json(messages.length?messages:[{id:0,author:'customer',message:inquiry.msg,created:inquiry.created}]);
}));
app.post('/api/customer/inquiries',lim(20),cust,w((q,r)=>{
  need(q.body,'message');
  const c=one('SELECT name,email,phone FROM customers WHERE id=?',q.cid);
  const message=String(q.body.message).trim().slice(0,4000);
  const type=String(q.body.type||'Support').slice(0,80);
  const inquiry={
    id:Number(db.prepare('INSERT INTO inquiries(customer_id,name,email,phone,type,msg) VALUES(?,?,?,?,?,?)')
      .run(q.cid,c.name,c.email||'',c.phone||'',type,message).lastInsertRowid),
    customer_id:q.cid,name:c.name,email:c.email||'',phone:c.phone||'',type,msg:message
  };
  db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(inquiry.id,'customer',inquiry.msg);
  notifyAdminCustomerMessage(inquiry,message);
  r.json({ok:1,id:inquiry.id});
}));
app.post('/api/customer/inquiries/:id/messages',lim(20),cust,w((q,r)=>{
  const inquiry=one('SELECT id,customer_id,name,email,phone,type,msg FROM inquiries WHERE id=? AND customer_id=?',q.params.id,q.cid);
  if(!inquiry)return r.status(404).json({error:'Conversation not found'});
  need(q.body,'message');
  const message=String(q.body.message).trim();
  if(message.length>4000)throw new Error('Message must be 4000 characters or fewer');
  const id=db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)')
    .run(inquiry.id,'customer',message).lastInsertRowid;
  db.prepare("UPDATE inquiries SET status='New' WHERE id=?").run(inquiry.id);
  notifyAdminCustomerMessage(inquiry,message);
  r.json({ok:1,id:Number(id)});
}));
app.get('/api/me',cust,w((q,r)=>{
  const c=one('SELECT id,name,phone,email,address,paci,birthday,nationality FROM customers WHERE id=?',q.cid);
  const delivered=one("SELECT COUNT(*) n FROM orders WHERE customer_id=? AND status IN ('Delivered','Completed')",q.cid).n;
  const redeemed=new Set(db.prepare('SELECT threshold FROM loyalty_redemptions WHERE customer_id=?').all(q.cid).map(x=>x.threshold));
  const cycleBase=delivered>0?Math.floor((delivered-1)/10)*10:0;
  const rewards=[{threshold:cycleBase+5,label:'20% off your order'},{threshold:cycleBase+8,label:'Free delivery'},{threshold:cycleBase+10,label:'One free meal'}].filter(reward=>delivered>=reward.threshold&&!redeemed.has(reward.threshold));
  const orders=db.prepare('SELECT * FROM orders WHERE customer_id=? ORDER BY id DESC').all(q.cid).map(o=>{
    if(o.status!=='Out for delivery')return {...o,eta:'',driver_name:'',driver_phone:'',status_message:''};
    return {...o,eta:'',status_message:''};
  });
  r.json({...c,delivered,rewards,orders,subs:db.prepare('SELECT * FROM subs WHERE customer_id=? ORDER BY id DESC').all(q.cid)});
}));
app.post('/api/order',lim(30),w((q,r)=>{
  const b=q.body;
  need(b,'name','phone','address');
  if(b.email&&!/^\S+@\S+\.\S+$/.test(String(b.email)))throw new Error('Valid email required');

  const st=S();

  if(st.accepting!=='1')
    throw new Error('Sorry, we are closed for orders right now.');

  const requestedPay=String(b.pay||'COD').toUpperCase();

  if(requestedPay==='COD' && st.payment_cod==='0')
    throw new Error('Cash on Delivery is currently unavailable.');

  if(requestedPay==='CARD' && st.payment_card!=='1')
    throw new Error('Card payment is currently unavailable.');

  if(!['COD','CARD'].includes(requestedPay))
    throw new Error('Invalid payment method.');

  const its=(b.items||[]).map(i=>{
    const x=one(
      'SELECT id,name,cat,price,discount_price FROM items WHERE id=? AND active=1',
      i.id
    );

    if(!x)return null;

    const regular=+x.price||0;
    const dp=+x.discount_price||0;
    const unit=(dp>0 && dp<regular)?dp:regular;

    return {
      id:x.id,
      name:x.name,
      cat:x.cat,
      price:unit,
      regular_price:regular,
      qty:Math.max(1,Math.min(99,+i.qty||1))
    };
  }).filter(Boolean);

  if(!its.length)
    throw new Error('Cart is empty');

  const customerId=custId(b,q);
  const delivered=one("SELECT COUNT(*) n FROM orders WHERE customer_id=? AND status IN ('Delivered','Completed')",customerId).n;
  const rewardThreshold=+(b.loyalty_reward||0);
  if(rewardThreshold){
    if(!customerToken(q))throw new Error('Log in to redeem a loyalty reward.');
    const rewardKind=rewardThreshold%10||10;
     const cycleBase=delivered>0?Math.floor((delivered-1)/10)*10:0;
     const validMilestones=[cycleBase+5,cycleBase+8,cycleBase+10];
     if(![5,8,10].includes(rewardKind)||!validMilestones.includes(rewardThreshold)||delivered<rewardThreshold||one('SELECT 1 FROM loyalty_redemptions WHERE customer_id=? AND threshold=?',customerId,rewardThreshold))throw new Error('That loyalty reward is not available.');
  }

  const sub=its.reduce((n,i)=>n+i.price*i.qty,0);

  if(sub<+(st.min_order||0))
    throw new Error(
      'Minimum order is '+(+st.min_order).toFixed(3)+' '+st.currency
    );

  let discount=0;
  let promoCode=String(b.promo_code||'').trim().toUpperCase();

  if(st.promo_enabled!=='0' && promoCode && promoCode===String(st.promo_code||'').trim().toUpperCase()){
    const pv=Math.max(0,+st.promo_value||0);

    if(String(st.promo_type||'percent')==='percent')
      discount=Math.min(sub,sub*pv/100);
    else
      discount=Math.min(sub,pv);
  }else{
    promoCode='';
  }

  let rewardDiscount=0;
  if(rewardThreshold===5)rewardDiscount=sub*.2;
  if(rewardThreshold===10){
    const meal=its.filter(item=>['Regular','Budget'].includes(item.cat)).sort((a,b)=>a.price-b.price)[0];
    if(!meal)throw new Error('Add a regular or budget meal to redeem your free meal.');
    rewardDiscount=meal.price;
  }
  const rewardKind=rewardThreshold%10||10;
   const delivery=rewardKind===8?0:+(st.fee||0);
  discount=Math.min(sub,discount+rewardDiscount);
  const total=Math.max(0,sub-discount+delivery);
  const approval=String(st.approval_mode||'AUTO').toUpperCase();
  const status=approval==='ADMIN'?'Pending':'Confirmed';

  const saveOrder=db.transaction(()=>{
  const id=db.prepare(`
    INSERT INTO orders(
      customer_id,name,phone,email,address,paci,notes,items,
      subtotal,discount,promo_code,total,pay,payment_status,status,
      confirmed_at,loyalty_reward,lat,lng,map_url
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    customerId,
    b.name,
    b.phone,
    b.email||'',
    b.address,
    b.paci||'',
    b.notes||'',
    JSON.stringify(its),
    sub,
    discount,
    promoCode,
    total,
    requestedPay,
    requestedPay==='CARD'?'Pending':'Pending',
    status,
    status==='Confirmed'?new Date().toISOString():null,
    rewardThreshold,
    Number.isFinite(+b.lat)?+b.lat:null,
    Number.isFinite(+b.lng)?+b.lng:null,
    String(b.map_url||'').slice(0,500)
  ).lastInsertRowid;
  if(rewardThreshold)db.prepare('INSERT INTO loyalty_redemptions(customer_id,threshold,order_id) VALUES(?,?,?)').run(customerId,rewardThreshold,id);
  return Number(id);
  });
  const id=saveOrder();
  const savedOrder=one('SELECT * FROM orders WHERE id=?',id);
  notifyOrderReceived(savedOrder);
  notifyAdminOrder(savedOrder);

  r.json({
    id:Number(id),
    subtotal:sub,
    discount,
    delivery,
    total,
    pay:requestedPay,
    status,
    promo_code:promoCode
  });
}));
app.post('/api/subscribe',lim(20),w((q,r)=>{
  const b=q.body;
  need(b,'name','phone','email','address','plan','start');
  if(!/^\S+@\S+\.\S+$/.test(String(b.email)))throw new Error('Valid email required');
  const p=one('SELECT * FROM plans WHERE id=? AND active=1',b.plan);
  if(!p)throw new Error('Unknown plan');
  const st=S(),payment=String(b.payment_method||'COD').toUpperCase();
  if(!['COD','CARD'].includes(payment))throw new Error('Invalid payment method');
  if(payment==='COD'&&st.payment_cod==='0')throw new Error('Cash on Delivery is currently unavailable.');
  if(payment==='CARD'&&st.payment_card!=='1')throw new Error('Card payment is currently unavailable.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(b.start)))throw new Error('Invalid start date');
  const start=new Date(b.start+'T00:00:00Z');
  if(isNaN(start)||start.toISOString().slice(0,10)!==b.start)throw new Error('Invalid start date');
  if(b.start<new Date().toISOString().slice(0,10))throw new Error('Start date cannot be in the past');
  const duration=Math.max(1,Math.min(366,+p.duration_days||26));
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+duration-1);
  const date=x=>x.toISOString().slice(0,10);
  const id=db.prepare('INSERT INTO subs(customer_id,name,nickname,phone,address,paci,plan,start,end,price,email,payment_method,payment_status,duration_days) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(custId(b,q),String(b.name).slice(0,100),String(b.nickname||'').slice(0,60),String(b.phone).slice(0,40),String(b.address).slice(0,400),String(b.paci||'').slice(0,80),p.name,date(start),date(end),p.price,String(b.email).slice(0,200),payment,'Pending',duration).lastInsertRowid;
  const savedSub=one('SELECT * FROM subs WHERE id=?',id);
  notifySubscriptionReceived(savedSub);
  r.json({id:Number(id),start:date(start),end:date(end),duration_days:duration,price:p.price,payment_method:payment,payment_status:'Pending'});
}));

/* ---------- admin ---------- */
app.post('/api/admin/login',lim(8),(q,r)=>safeEq(q.body.password,ADMIN_PW)?r.json({token:mk({r:'admin'})}):r.status(401).json({error:'Wrong password'}));
app.post('/api/admin/customers/:id/reset-password',admin,async(q,r)=>{
  try{
    const customer=one('SELECT id,name,email FROM customers WHERE id=?',q.params.id);
    if(!customer)throw new Error('Customer not found');
    if(!/^\S+@\S+\.\S+$/.test(String(customer.email||'')))throw new Error('Customer does not have a valid email address.');
    db.prepare('DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at<?').run(Date.now());
    db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE customer_id=? AND used_at IS NULL').run(Date.now(),customer.id);
    const raw=crypto.randomBytes(32).toString('base64url');
    const tokenHash=crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt=Date.now()+30*60*1000;
    db.prepare('INSERT INTO password_reset_tokens(customer_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)').run(customer.id,tokenHash,expiresAt,Date.now());
    const base=String(E.PUBLIC_BASE_URL||'').replace(/\/$/,'');
    if(!base)throw new Error('PUBLIC_BASE_URL is not configured');
    const resetUrl=base+'/reset-password.html?token='+encodeURIComponent(raw);
    try{
      await sendPasswordResetEmail({to:customer.email,name:customer.name,resetUrl});
    }catch(mailError){
      db.prepare('DELETE FROM password_reset_tokens WHERE token_hash=?').run(tokenHash);
      throw mailError;
    }
    r.json({ok:1,message:'Password reset email sent.'});
  }catch(error){
    console.error('ADMIN_PASSWORD_RESET_FAILED',error.message);
    r.status(400).json({error:error.message});
  }
});
app.post('/api/admin/email-customer',admin,w(async(q,r)=>{
  const to=String(q.body.to||'').trim().toLowerCase(),subject=String(q.body.subject||'').trim(),text=String(q.body.text||'').trim();
  if(!/^\\S+@\\S+\\.\\S+$/.test(to))throw new Error('Valid customer email required');
  if(!subject)throw new Error('Subject is required');
  if(!text)throw new Error('Message is required');
  if(subject.length>160||text.length>5000)throw new Error('Subject or message is too long');
  await sendMail({to,subject,text,html:'<div style="font-family:Arial,sans-serif;white-space:pre-wrap">'+escHtml(text)+'</div>'});
  r.json({ok:1,message:'Customer email sent.'});
}));
app.get('/api/admin/inquiries/:id/messages',admin,w((q,r)=>{
  const inquiry=one('SELECT id,msg,created FROM inquiries WHERE id=?',q.params.id);
  if(!inquiry)return r.status(404).json({error:'Inquiry not found'});
  const messages=db.prepare('SELECT id,author,message,created FROM inquiry_messages WHERE inquiry_id=? ORDER BY id').all(q.params.id);
  r.json(messages.length?messages:[{id:0,author:'customer',message:inquiry.msg,created:inquiry.created}]);
}));
app.get('/api/admin/orders/:id/chat',admin,w((q,r)=>{
  const order=one('SELECT id,status,name,email,phone FROM orders WHERE id=?',q.params.id);
  if(!order)return r.status(404).json({error:'Order not found'});
  const inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE order_id=? ORDER BY id DESC LIMIT 1',q.params.id);
  const messages=inquiry?db.prepare('SELECT id,author,message,created FROM inquiry_messages WHERE inquiry_id=? ORDER BY id').all(inquiry.id):[];
  r.json({order,inquiry,messages});
}));
app.post('/api/admin/inquiries/:id/messages',admin,w((q,r)=>{
  const inquiry=one('SELECT id,name,email,type,msg FROM inquiries WHERE id=?',q.params.id);
  if(!inquiry)return r.status(404).json({error:'Inquiry not found'});
  need(q.body,'message');
  const message=String(q.body.message).trim();
  if(message.length>4000)throw new Error('Reply must be 4000 characters or fewer');
  const id=db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)')
    .run(q.params.id,'admin',message).lastInsertRowid;
  db.prepare("UPDATE inquiries SET status='Replied' WHERE id=?").run(q.params.id);
  notifyInquiryReply(inquiry,message);
  r.json({ok:1,id:Number(id),emailQueued:!!inquiry.email});
}));
app.post('/api/admin/newsletter/send',admin,w((q,r)=>{
  const subject=String(q.body.subject||'').trim();
  const message=String(q.body.message||'').trim();
  if(!subject||!message)throw new Error('Newsletter subject and message are required');
  const subscribers=db.prepare('SELECT email FROM newsletter ORDER BY id').all()
    .filter(x=>/^\S+@\S+\.\S+$/.test(String(x.email||'')));
  if(!subscribers.length)throw new Error('No newsletter subscribers found');
  const tx=db.transaction(()=>{
    const campaignId=Number(db.prepare('INSERT INTO newsletter_campaigns(subject,message,status,total) VALUES(?,?,?,?)')
      .run(subject,message,'Queued',subscribers.length).lastInsertRowid);
    const ins=db.prepare('INSERT OR IGNORE INTO newsletter_jobs(campaign_id,email) VALUES(?,?)');
    for(const subscriber of subscribers)ins.run(campaignId,subscriber.email);
    return campaignId;
  });
  r.json({ok:1,id:tx(),status:'Queued',total:subscribers.length});
}));
app.get('/api/admin/newsletter/campaigns',admin,w((q,r)=>{
  r.json(db.prepare('SELECT * FROM newsletter_campaigns ORDER BY id DESC LIMIT 20').all());
}));
app.get('/api/admin/stats',admin,(q,r)=>{const n=s=>one(s).n;r.json({orders:n('SELECT COUNT(*) n FROM orders'),newOrders:n("SELECT COUNT(*) n FROM orders WHERE status='New'"),revenue:n("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status!='Cancelled'"),customers:n('SELECT COUNT(*) n FROM customers'),activeSubs:n("SELECT COUNT(*) n FROM subs WHERE status='Active'"),inquiries:n('SELECT COUNT(*) n FROM inquiries'),subscribers:n('SELECT COUNT(*) n FROM newsletter')})});
app.get('/api/admin/report',admin,w((q,r)=>{const date=/^\d{4}-\d{2}-\d{2}$/.test(q.query.date||'')?q.query.date:new Date().toISOString().slice(0,10),orders=db.prepare("SELECT * FROM orders WHERE date(created)=? ORDER BY id").all(date),active=orders.filter(x=>x.status!=='Cancelled'),summary={date,orders:orders.length,delivered:orders.filter(x=>x.status==='Delivered').length,newOrders:orders.filter(x=>x.status==='New').length,preparing:orders.filter(x=>x.status==='Preparing').length,outForDelivery:orders.filter(x=>x.status==='Out for delivery').length,cancelled:orders.filter(x=>x.status==='Cancelled').length,revenue:active.reduce((s,x)=>s+x.total,0),averageOrder:active.length?active.reduce((s,x)=>s+x.total,0)/active.length:0,activeSubscriptions:one("SELECT COUNT(*) n FROM subs WHERE status='Active'").n,newSubscriptions:one("SELECT COUNT(*) n FROM subs WHERE date(created)=?",date).n,inquiries:one('SELECT COUNT(*) n FROM inquiries WHERE date(created)=?',date).n,newsletter:one('SELECT COUNT(*) n FROM newsletter WHERE date(created)=?',date).n};const top={};for(const o of active){try{for(const i of JSON.parse(o.items||'[]'))top[i.name]=(top[i.name]||0)+i.qty}catch{}}summary.topItems=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,qty])=>({name,qty}));r.json(summary)}));
const T=['orders','customers','subs','inquiries','newsletter','testimonials','gallery','items','plans'],DEL=['items','gallery','testimonials','inquiries','newsletter','customers','plans'];
app.get('/api/admin/list/:t',admin,w((q,r)=>{const t=q.params.t;if(!T.includes(t))throw new Error('bad table');r.json(t==='customers'?db.prepare('SELECT id,name,phone,email,created,(SELECT COUNT(*) FROM orders o WHERE o.customer_id=customers.id) orders,(SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.customer_id=customers.id) spent FROM customers ORDER BY id DESC').all():db.prepare(`SELECT * FROM ${t} ORDER BY id DESC`).all())}));
app.put('/api/admin/status/:t/:id',admin,w((q,r)=>{
  if(!['orders','subs','inquiries'].includes(q.params.t))
    throw new Error('bad table');

  const status=String(q.body.status||'');
  const table=q.params.t;

  if(table==='orders'){
    const allowed=['Pending','New','Confirmed','Preparing','Out for delivery','Delivered','Cancelled','Completed'];
    if(!allowed.includes(status))throw new Error('Invalid order status');
    const before=one('SELECT * FROM orders WHERE id=?',q.params.id);
    if(!before)throw new Error('Order not found');
    const sets=['status=?'];
    const vals=[status];
    if(status==='Confirmed'){sets.push('confirmed_at=?');vals.push(new Date().toISOString());}
    if(status==='Delivered'){sets.push('delivered_at=?');vals.push(new Date().toISOString());}
    if(status==='Cancelled'){sets.push('cancelled_at=?');vals.push(new Date().toISOString());}
    vals.push(q.params.id);
    db.prepare('UPDATE orders SET '+sets.join(',')+' WHERE id=?').run(...vals);
    const after=one('SELECT * FROM orders WHERE id=?',q.params.id);
    notifyOrderStatus(after,before.status);
    return r.json({ok:1,status});
  }

  if(table==='subs'){
    const allowed=['Active','Paused','Completed','Cancelled'];
    if(!allowed.includes(status))throw new Error('Invalid subscription status');
    const before=one('SELECT * FROM subs WHERE id=?',q.params.id);
    if(!before)throw new Error('Subscription not found');
    db.prepare('UPDATE subs SET status=? WHERE id=?').run(status,q.params.id);
    const after=one('SELECT * FROM subs WHERE id=?',q.params.id);
    notifySubscriptionStatus(after,before.status);
    return r.json({ok:1,status});
  }

  const allowed=['New','Read','Replied'];
  if(!allowed.includes(status))throw new Error('Invalid inquiry status');
  const result=db.prepare('UPDATE inquiries SET status=? WHERE id=?').run(status,q.params.id);
  if(!result.changes)throw new Error('Inquiry not found');
  r.json({ok:1,status});
}));
app.put('/api/admin/payment/:id',admin,w((q,r)=>{
  const status=String(q.body.status||'');
  if(!['Pending','Paid','Failed','Refunded'].includes(status))throw new Error('Invalid payment status');
  const before=one('SELECT * FROM orders WHERE id=?',q.params.id);
  if(!before)throw new Error('Order not found');
  db.prepare('UPDATE orders SET payment_status=? WHERE id=?').run(status,q.params.id);
  const after=one('SELECT * FROM orders WHERE id=?',q.params.id);
  notifyPaymentStatus(after,before.payment_status);
  r.json({ok:1,status});
}));
app.put('/api/admin/orders/:id',admin,w((q,r)=>{
  const allowed=['driver_name','driver_phone'];
  const keys=Object.keys(q.body).filter(key=>allowed.includes(key));
  if(!keys.length)throw new Error('Only driver name and driver phone can be updated');
  const result=db.prepare(`UPDATE orders SET ${keys.map(key=>key+'=?').join(',')} WHERE id=?`)
    .run(...keys.map(key=>String(q.body[key]||'').slice(0,120)),q.params.id);
  if(!result.changes)throw new Error('Order not found');
  r.json({ok:1});
}));
app.post('/api/orders/:id/received',cust,w((q,r)=>{
  const order=one('SELECT status,received_at FROM orders WHERE id=? AND customer_id=?',q.params.id,q.cid);
  if(!order)return r.status(404).json({error:'Order not found'});
  if(!['Delivered','Completed'].includes(order.status))throw new Error('You can confirm receipt after delivery.');
  if(!order.received_at)db.prepare('UPDATE orders SET received_at=? WHERE id=?').run(new Date().toISOString(),q.params.id);
  r.json({ok:1,received:true});
}));
app.put('/api/admin/subs/:id',admin,w((q,r)=>{
  const b=q.body,allowed=['name','email','phone','address','paci','start','end','payment_method','payment_status'];
  const keys=Object.keys(b).filter(key=>allowed.includes(key));
  if(!keys.length)throw new Error('Nothing to update');
  if((b.email!==undefined)&&b.email&&!/^\S+@\S+\.\S+$/.test(String(b.email)))throw new Error('Valid email required');
  if(b.payment_method!==undefined&&!['COD','CARD'].includes(String(b.payment_method).toUpperCase()))throw new Error('Invalid payment method');
  if(b.payment_status!==undefined&&!['Pending','Paid','Failed','Refunded'].includes(b.payment_status))throw new Error('Invalid payment status');
  for(const key of ['start','end'])if(b[key]!==undefined&&!validDate(b[key]))throw new Error('Invalid '+key+' date');
  const current=one('SELECT start,end FROM subs WHERE id=?',q.params.id);
  if(!current)throw new Error('Subscription not found');
  const start=b.start||current.start,end=b.end||current.end;
  if(start>end)throw new Error('End date must be on or after start date');
  const before=one('SELECT * FROM subs WHERE id=?',q.params.id);
  if(!before)throw new Error('Subscription not found');
  const result=db.prepare(`UPDATE subs SET ${keys.map(key=>key+'=?').join(',')} WHERE id=?`)
    .run(...keys.map(key=>key==='payment_method'?String(b[key]).toUpperCase():String(b[key]).slice(0,500)),q.params.id);
  if(!result.changes)throw new Error('Subscription not found');
  const after=one('SELECT * FROM subs WHERE id=?',q.params.id);
  if(keys.includes('payment_status'))notifySubscriptionPaymentStatus(after,before.payment_status);
  r.json({ok:1});
}));
const validDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;
  const date=new Date(value+'T00:00:00Z');
  return Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==value?null:value;
};
app.get('/api/admin/report-range',admin,w((q,r)=>{
  const today=new Date().toISOString().slice(0,10);
  const from=validDate(q.query.from)||validDate(q.query.date)||today;
  const to=validDate(q.query.to)||validDate(q.query.date)||from;
  if(from>to)throw new Error('Start date must be on or before end date');
  const orders=db.prepare('SELECT * FROM orders WHERE date(created) BETWEEN ? AND ? ORDER BY id DESC').all(from,to);
  const active=orders.filter(order=>order.status!=='Cancelled');
  const summary={
    from,to,orders:orders.length,
    delivered:orders.filter(order=>order.status==='Delivered').length,
    newOrders:orders.filter(order=>['New','Pending'].includes(order.status)).length,
    preparing:orders.filter(order=>order.status==='Preparing').length,
    outForDelivery:orders.filter(order=>order.status==='Out for delivery').length,
    cancelled:orders.filter(order=>order.status==='Cancelled').length,
    revenue:active.reduce((sum,order)=>sum+(+order.total||0),0),
    paidOrders:active.filter(order=>order.payment_status==='Paid').length,
    paidRevenue:active.filter(order=>order.payment_status==='Paid').reduce((sum,order)=>sum+(+order.total||0),0),
    averageOrder:active.length?active.reduce((sum,order)=>sum+(+order.total||0),0)/active.length:0,
    activeSubscriptions:one("SELECT COUNT(*) n FROM subs WHERE status='Active' AND start<=? AND \"end\">=?",to,from).n,
    newSubscriptions:one('SELECT COUNT(*) n FROM subs WHERE date(created) BETWEEN ? AND ?',from,to).n,
    inquiries:one('SELECT COUNT(*) n FROM inquiries WHERE date(created) BETWEEN ? AND ?',from,to).n,
    newsletter:one('SELECT COUNT(*) n FROM newsletter WHERE date(created) BETWEEN ? AND ?',from,to).n,
    ordersList:orders
  };
  const top={};
  for(const order of active){try{for(const item of JSON.parse(order.items||'[]'))top[item.name]=(top[item.name]||0)+item.qty}catch{}}
  summary.topItems=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,qty])=>({name,qty}));
  r.json(summary);
}));
const F=['cat','region','name','descr','price','discount_price','emoji','active'];
app.put('/api/admin/items/:id',admin,w((q,r)=>{const k=Object.keys(q.body).filter(x=>F.includes(x));if('price' in q.body&&!(+q.body.price>=0))throw new Error('Invalid price');if(!k.length)throw new Error('nothing to update');db.prepare(`UPDATE items SET ${k.map(x=>x+'=?').join(',')} WHERE id=?`).run(...k.map(x=>q.body[x]),q.params.id);r.json({ok:1})}));
app.post('/api/admin/items',admin,w((q,r)=>{
  const b=q.body;
  need(b,'name','price','cat');

  if(!(+b.price>=0))
    throw new Error('Invalid price');

  if(b.discount_price!==undefined &&
     b.discount_price!=='' &&
     !(+b.discount_price>=0))
    throw new Error('Invalid discount price');

  db.prepare(
    'INSERT INTO items(cat,region,name,descr,price,discount_price,emoji) VALUES(?,?,?,?,?,?,?)'
  ).run(
    b.cat,
    b.region||'Filipino',
    b.name,
    b.descr||'',
    +b.price,
    b.discount_price===''?null:+b.discount_price||0,
    b.emoji||'🍽️'
  );

  r.json({ok:1});
}));
app.post('/api/admin/testimonials',admin,w((q,r)=>{need(q.body,'name','text');db.prepare('INSERT INTO testimonials(name,text,stars) VALUES(?,?,?)').run(q.body.name,q.body.text,Math.min(5,Math.max(1,+q.body.stars||5)));r.json({ok:1})}));
const galleryEmbed=value=>{
  let url;
  try{url=new URL(String(value||''))}catch{throw new Error('Enter a valid YouTube, TikTok, or Facebook video URL.')}
  if(url.protocol!=='https:')throw new Error('Video URLs must use HTTPS.');
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(url.hostname)){
    const id=url.hostname.includes('youtu.be')?url.pathname.split('/').filter(Boolean)[0]:url.searchParams.get('v')||url.pathname.split('/').filter(Boolean).pop();
    if(!/^[A-Za-z0-9_-]{6,20}$/.test(id||''))throw new Error('Invalid YouTube video URL.');
    return 'https://www.youtube-nocookie.com/embed/'+id;
  }
  if(['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(url.hostname)){
    const id=url.pathname.match(/\/video\/(\d+)/)?.[1];
    if(!id)throw new Error('Invalid TikTok video URL.');
    return 'https://www.tiktok.com/player/v1/'+id;
  }
  if(['facebook.com','www.facebook.com','m.facebook.com','fb.watch'].includes(url.hostname)){
    if(!url.pathname.includes('/videos/')&&!url.pathname.includes('/watch')&&url.hostname!=='fb.watch')throw new Error('Enter a Facebook video URL.');
    return 'https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(url.toString())+'&show_text=false';
  }
  throw new Error('Only YouTube, TikTok, and Facebook video URLs are supported.');
};
app.post('/api/admin/gallery',admin,w((q,r)=>{
  const caption=String(q.body.caption||'').slice(0,200),url=galleryEmbed(q.body.url);
  db.prepare("INSERT INTO gallery(img,caption,media_type,media_url) VALUES(NULL,?,'video',?)").run(caption,url);
  r.json({ok:1});
}));
app.put('/api/admin/gallery/:id',admin,w((q,r)=>{
  if(q.body.caption===undefined)throw new Error('Caption is required');
  const result=db.prepare('UPDATE gallery SET caption=? WHERE id=?').run(String(q.body.caption).slice(0,200),q.params.id);
  if(!result.changes)throw new Error('Gallery item not found');
  r.json({ok:1});
}));
app.delete('/api/admin/:t/:id',admin,w((q,r)=>{if(!DEL.includes(q.params.t))throw new Error('bad table');db.prepare(`DELETE FROM ${q.params.t} WHERE id=?`).run(q.params.id);r.json({ok:1})}));
const SK=[
  'name','phone','hours','currency','fee','min_order','accepting',
  'hero_title','hero_text','logo_url','whatsapp','facebook','instagram',
  'location','map_url','approval_mode','payment_cod','payment_card',
  'promo_enabled','promo_code','promo_type','promo_value'
];
app.get('/api/admin/settings',admin,(q,r)=>r.json(S()));
app.put('/api/admin/settings',admin,w((q,r)=>{
  const b=q.body;

  if(b.fee!==undefined && !(+b.fee>=0))
    throw new Error('Invalid delivery fee');

  if(b.min_order!==undefined && !(+b.min_order>=0))
    throw new Error('Invalid minimum order');

  if(b.currency!==undefined &&
     !/^[A-Za-z]{2,5}$/.test(b.currency))
    throw new Error('Currency must be a code like KWD');

  if(b.approval_mode!==undefined &&
     !['AUTO','ADMIN'].includes(String(b.approval_mode).toUpperCase()))
    throw new Error('Invalid approval mode');

  if(b.promo_type!==undefined &&
     !['percent','fixed'].includes(String(b.promo_type)))
    throw new Error('Invalid promo type');

  if(b.promo_value!==undefined &&
     !(+b.promo_value>=0))
    throw new Error('Invalid promo value');

  SK.forEach(k=>{
    if(b[k]!==undefined){
      db.prepare(
        'INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)'
      ).run(k,String(b[k]).slice(0,400));
    }
  });

  r.json({ok:1});
}));
app.post('/api/admin/plans',admin,w((q,r)=>{
  const b=q.body;need(b,'name','price');
  if(!(+b.price>=0))throw new Error('Invalid price');
  const duration=+(b.duration_days||26);
  if(!Number.isInteger(duration)||duration<1||duration>366)throw new Error('Duration must be 1 to 366 days');
  const id=String(b.id||b.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+crypto.randomBytes(3).toString('hex');
  const includes=Array.isArray(b.includes)?b.includes:String(b.includes||'').split(/\r?\n|\|/).map(x=>x.trim()).filter(Boolean);
  db.prepare('INSERT INTO plans(id,name,price,descr,active,includes,duration_days) VALUES(?,?,?,?,?,?,?)')
    .run(id,String(b.name).slice(0,100),+b.price,String(b.descr||'').slice(0,500),b.active===0?0:1,JSON.stringify(includes),duration);
  r.json({ok:1,id});
}));
app.put('/api/admin/plans/:id',admin,w((q,r)=>{
  if(q.body.includes!==undefined){const v=Array.isArray(q.body.includes)?q.body.includes:String(q.body.includes).split(/\r?\n|\|/).map(x=>x.trim()).filter(Boolean);q.body.includes=JSON.stringify(v)}
  const k=Object.keys(q.body).filter(x=>['name','descr','price','active','includes','duration_days','img'].includes(x));
  if(!k.length)throw new Error('nothing to update');
  if('price' in q.body&&!(+q.body.price>=0))throw new Error('Invalid price');
  if('duration_days' in q.body&&(!Number.isInteger(+q.body.duration_days)||+q.body.duration_days<1||+q.body.duration_days>366))throw new Error('Duration must be 1 to 366 days');
  db.prepare(`UPDATE plans SET ${k.map(x=>x+'=?').join(',')} WHERE id=?`).run(...k.map(x=>q.body[x]),q.params.id);
  r.json({ok:1});
}));
app.put('/api/admin/testimonials/:id',admin,w((q,r)=>{db.prepare('UPDATE testimonials SET approved=? WHERE id=?').run(q.body.approved?1:0,q.params.id);r.json({ok:1})}));
app.get('/api/admin/export/:t',admin,w((q,r)=>{const t=q.params.t;if(!['orders','customers','subs','inquiries','newsletter'].includes(t))throw new Error('bad table');
const rows=db.prepare(t==='customers'?'SELECT id,name,phone,email,created FROM customers':`SELECT * FROM ${t}`).all(),cols=rows[0]?Object.keys(rows[0]):['empty'];
const c=v=>{v=String(v??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
r.type('text/csv').send('\ufeff'+[cols.map(c).join(',')].concat(rows.map(x=>cols.map(k=>c(x[k])).join(','))).join('\n'))}));
const up=multer({storage:multer.diskStorage({destination:UP,filename:(q,f,cb)=>cb(null,crypto.randomBytes(8).toString('hex')+path.extname(f.originalname).toLowerCase())}),limits:{fileSize:5e6},fileFilter:(q,f,cb)=>/^image\/(jpe?g|png|webp|gif)$/.test(f.mimetype)?cb(null,true):cb(new Error('Images only (jpg, png, webp, gif)'))});
app.post('/api/admin/upload',admin,up.single('file'),w((q,r)=>{if(!q.file)throw new Error('No file');const url='/uploads/'+q.file.filename,t=q.query;
const old=t.target==='hero'?one("SELECT v x FROM settings WHERE k='hero_img'")?.x:t.target==='item'?one('SELECT img x FROM items WHERE id=?',t.id)?.x:t.target==='plan'?one('SELECT img x FROM plans WHERE id=?',t.id)?.x:t.id?one('SELECT img x FROM gallery WHERE id=?',t.id)?.x:null;
if(t.target==='hero')db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('hero_img',?)").run(url);else if(t.target==='item')db.prepare('UPDATE items SET img=? WHERE id=?').run(url,t.id);else if(t.target==='plan')db.prepare('UPDATE plans SET img=? WHERE id=?').run(url,t.id);else if(t.id)db.prepare("UPDATE gallery SET img=?,media_type='image',media_url=? WHERE id=?").run(url,url,t.id);else db.prepare("INSERT INTO gallery(img,caption,media_type,media_url) VALUES(?,'','image',?)").run(url,url);
if(old&&old.startsWith('/uploads/'))fs.unlink(path.join(UP,path.basename(old)),()=>{});r.json({url})}));
app.delete('/api/admin/image',admin,w((q,r)=>{
  const {target,id}=q.body||{};
  let row,clear;
  if(target==='hero'){
    row=one("SELECT v img FROM settings WHERE k='hero_img'");
    clear=()=>db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('hero_img','')").run();
  }else if(target==='item'){
    row=one('SELECT img FROM items WHERE id=?',id);
    clear=()=>db.prepare('UPDATE items SET img=NULL WHERE id=?').run(id);
  }else if(target==='plan'){
    row=one('SELECT img FROM plans WHERE id=?',id);
    clear=()=>db.prepare("UPDATE plans SET img='' WHERE id=?").run(id);
  }else if(target==='gallery'){
    row=one('SELECT img FROM gallery WHERE id=?',id);
    clear=()=>db.prepare('UPDATE gallery SET img=NULL WHERE id=?').run(id);
  }else throw new Error('Invalid image target');
  if(!row)throw new Error('Image target not found');
  clear();
  if(row.img&&row.img.startsWith('/uploads/'))fs.unlink(path.join(UP,path.basename(row.img)),()=>{});
  r.json({ok:1});
}));
let newsletterWorkerBusy=false;
async function processNewsletterQueue(){
  if(newsletterWorkerBusy)return;
  newsletterWorkerBusy=true;
  try{
    const job=one("SELECT j.id,j.campaign_id,j.email,c.subject,c.message FROM newsletter_jobs j JOIN newsletter_campaigns c ON c.id=j.campaign_id WHERE j.status='Pending' AND c.status IN ('Queued','Sending') ORDER BY j.id LIMIT 1");
    if(!job)return;
    db.prepare("UPDATE newsletter_campaigns SET status='Sending' WHERE id=? AND status='Queued'").run(job.campaign_id);
    try{
      const result=await sendNewsletterCampaign([{email:job.email}],job.subject,job.message);
      if(result.sent){
        db.prepare("UPDATE newsletter_jobs SET status='Sent',sent_at=CURRENT_TIMESTAMP,error=NULL WHERE id=?").run(job.id);
        db.prepare("UPDATE newsletter_campaigns SET sent=sent+1 WHERE id=?").run(job.campaign_id);
      }else{
        db.prepare("UPDATE newsletter_jobs SET status='Failed',error=? WHERE id=?").run(result.failures?.[0]?.error||'Email send failed',job.id);
        db.prepare("UPDATE newsletter_campaigns SET failed=failed+1 WHERE id=?").run(job.campaign_id);
      }
    }catch(error){
      db.prepare("UPDATE newsletter_jobs SET status='Failed',error=? WHERE id=?").run(String(error.message).slice(0,500),job.id);
      db.prepare("UPDATE newsletter_campaigns SET failed=failed+1 WHERE id=?").run(job.campaign_id);
      console.error('NEWSLETTER_JOB_FAILED',job.email,error.message);
    }
    const state=one('SELECT total,sent,failed FROM newsletter_campaigns WHERE id=?',job.campaign_id);
    if(state&&state.sent+state.failed>=state.total){
      db.prepare("UPDATE newsletter_campaigns SET status='Completed',completed=CURRENT_TIMESTAMP WHERE id=?").run(job.campaign_id);
    }
  }finally{newsletterWorkerBusy=false;}
}
setInterval(processNewsletterQueue,Math.max(500,+(E.NEWSLETTER_INTERVAL_MS||1100))).unref();
app.get('/check.html',(q,r,n)=>E.ENABLE_CHECK==='0'?r.status(404).send('Not found'):n());
app.use((q,r,n)=>{
  const host=String(q.hostname||'').toLowerCase();
  const isAdminHost=host.startsWith('admin.')||host==='admin.localhost';
  if(isAdminHost && (q.path==='/'||q.path==='/index.html')) return r.sendFile(path.join(__dirname,'public','admin.html'));
  if(!isAdminHost && q.path==='/admin.html' && E.NODE_ENV==='production') return r.status(404).send('Not found');
  n();
});
['admin','account','check'].forEach(p=>app.get('/'+p,(q,r)=>r.redirect('/'+p+'.html')));
app.use('/uploads',express.static(UP,{maxAge:'7d'}));app.use(express.static(path.join(__dirname,'public')));
app.use('/api',(q,r)=>r.status(404).json({error:'Not found'}));
app.get(/^\/(?!uploads\/).*/,(q,r)=>r.redirect('/'));
app.use((e,q,r,n)=>r.status(400).json({error:e.message}));
app.listen(PORT,()=>console.log(NAME+' running on http://localhost:'+PORT+(ADMIN_PW==='admin123'?'  (WARNING: set ADMIN_PASSWORD)':'')));
