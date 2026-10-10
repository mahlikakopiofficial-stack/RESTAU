const fs=require('fs'),path=require('path'),crypto=require('crypto');
try{fs.readFileSync(path.join(__dirname,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2]})}catch(e){}
const express=require('express'),Database=require('better-sqlite3'),multer=require('multer');
const loyalty=require('./public/loyalty.js');
const inventory=require('./lib/inventory');
const adminPush=require('./lib/admin-push');
const {sendMail,getAuthorizationUrl,exchangeCode}=require('./lib/gmail');
const {notifyRegistration,notifyInquiryReceived,notifyInquiryReply,notifyAdminInquiry,notifyAdminCustomerMessage,notifyNewsletterWelcome,sendNewsletterCampaign,notifyOrderReceived,notifyAdminOrder,notifyOrderStatus,notifyPaymentStatus,notifySubscriptionReceived,notifyAdminSubscription,notifySubscriptionStatus,notifySubscriptionPaymentStatus,sendPasswordResetEmail}=require('./lib/notifications');
const {sendWhatsAppText,configured:whatsappConfigured,status:whatsappStatus}=require('./lib/whatsapp');
const E=process.env,PORT=E.PORT||3000,SECRET=E.SECRET||'change-me',ADMIN_PW=E.ADMIN_PASSWORD||'admin123',CUR=E.CURRENCY||'KWD',FEE=+(E.DELIVERY_FEE||1),NAME=E.RESTO_NAME||'PinoyAmbula';
const kuwaitToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
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
CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY,title TEXT NOT NULL,message TEXT NOT NULL,image TEXT DEFAULT '',cta_label TEXT DEFAULT '',cta_url TEXT DEFAULT '',priority INTEGER DEFAULT 0,starts_at TEXT DEFAULT '',ends_at TEXT DEFAULT '',active INTEGER DEFAULT 1,created TEXT DEFAULT CURRENT_TIMESTAMP,updated TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS regional_dishes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,region TEXT NOT NULL,descr TEXT DEFAULT '',price REAL DEFAULT 0,img TEXT DEFAULT '',active INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS heritage(id INTEGER PRIMARY KEY,title TEXT NOT NULL,caption TEXT DEFAULT '',media_type TEXT DEFAULT 'image',img TEXT DEFAULT '',media_url TEXT DEFAULT '',active INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notification_log(id INTEGER PRIMARY KEY,channel TEXT NOT NULL,event_key TEXT NOT NULL UNIQUE,recipient TEXT DEFAULT '',status TEXT DEFAULT 'Pending',error TEXT DEFAULT '',created TEXT DEFAULT CURRENT_TIMESTAMP,sent_at TEXT);
CREATE TABLE IF NOT EXISTS admin_push_tokens(token TEXT PRIMARY KEY,device_name TEXT DEFAULT 'admin-android',active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,last_seen TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const ensureColumn=(table,column,definition)=>{
  if(!db.prepare(`PRAGMA table_info(${table})`).all().some(x=>x.name===column))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
[
  ['items','discount_price','REAL DEFAULT 0'],
  ['items','ingredients',"TEXT DEFAULT ''"],
  ['items','stock_available','INTEGER DEFAULT 3'],
  ['items','daily_restock_quantity','INTEGER DEFAULT 3'],
  ['items','stock_date',"TEXT DEFAULT ''"],
  ['customers','address',"TEXT DEFAULT ''"],
  ['customers','paci',"TEXT DEFAULT ''"],
  ['customers','birthday',"TEXT DEFAULT ''"],
  ['customers','nationality',"TEXT DEFAULT ''"],
  ['customers','auth_version','INTEGER DEFAULT 0'],
  ['customers','whatsapp_opt_in','INTEGER DEFAULT 0'],
  ['orders','subtotal','REAL DEFAULT 0'],
  ['orders','discount','REAL DEFAULT 0'],
  ['orders','email',"TEXT DEFAULT ''"],
  ['orders','promo_code',"TEXT DEFAULT ''"],
  ['orders','payment_status',"TEXT DEFAULT 'Pending'"],
  ['orders','cod_cash_collected','INTEGER DEFAULT 0'],
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
  ['orders','whatsapp_opt_in','INTEGER DEFAULT 0'],
  ['orders','inventory_deducted','INTEGER DEFAULT 0'],
  ['orders','inventory_restored','INTEGER DEFAULT 0'],
  ['gallery','media_type',"TEXT DEFAULT 'image'"],
  ['gallery','media_url',"TEXT DEFAULT ''"],
  ['subs','email',"TEXT DEFAULT ''"],
  ['subs','payment_method',"TEXT DEFAULT 'COD'"],
  ['subs','payment_status',"TEXT DEFAULT 'Pending'"],
  ['subs','duration_days','INTEGER DEFAULT 26'],
  ['subs','nickname',"TEXT DEFAULT ''"],
  ['subs','whatsapp_opt_in','INTEGER DEFAULT 0'],
  ['plans','duration_days','INTEGER DEFAULT 26'],
  ['plans','img',"TEXT DEFAULT ''"],
  ['inquiries','customer_id','INTEGER'],
  ['inquiries','order_id','INTEGER'],
  ['inquiries','status',"TEXT DEFAULT 'New'"],
  ['announcements','updated_at','TEXT'],
  ['regional_dishes','stock_available','INTEGER DEFAULT 3'],
  ['regional_dishes','daily_restock_quantity','INTEGER DEFAULT 3'],
  ['regional_dishes','stock_date',"TEXT DEFAULT ''"]
].forEach(([table,column,definition])=>ensureColumn(table,column,definition));
const ingredientDefaults={
'Chicken Adobo':'Chicken, soy sauce, vinegar, garlic, bay leaf, black pepper, cooking oil, steamed rice',
'Kare-Kare':'Oxtail, beef, peanut butter, annatto, eggplant, string beans, bok choy, bagoong',
'Pancit Canton':'Wheat noodles, chicken, cabbage, carrots, green beans, onion, garlic, soy sauce, oyster sauce',
'Tapsilog':'Beef tapa, garlic, soy sauce, calamansi, sugar, garlic rice, egg, cooking oil',
'Longsilog':'Longganisa, garlic rice, egg, cooking oil, garlic, vinegar dip',
'Adobo Rice Bowl':'Chicken, soy sauce, vinegar, garlic, bay leaf, black pepper, rice',
"Sago't Gulaman":'Sago pearls, gulaman jelly, brown sugar, pandan, water, ice',
'Buko Juice':'Young coconut water, young coconut meat, ice',
'Calamansi Juice':'Calamansi juice, water, sugar, ice',
'Halo-Halo':'Shaved ice, sweet beans, nata de coco, kaong, ube, leche flan, evaporated milk, sugar',
'Pancit Party Tray (10 pax)':'Pancit bihon, chicken, cabbage, carrots, green beans, onion, garlic, soy sauce, oyster sauce',
'Adobo Tray (20 pax)':'Chicken, soy sauce, vinegar, garlic, bay leaf, black pepper, cooking oil, steamed rice',
'Chicken Katsu Curry':'Chicken breast, panko, flour, egg, Japanese curry, onion, carrot, potato, rice',
'Salmon Sushi Roll':'Salmon, sushi rice, nori, rice vinegar, cucumber, sesame, soy sauce',
'Bibimbap':'Rice, beef, spinach, carrot, bean sprouts, zucchini, egg, gochujang, sesame oil',
'Pad Thai':'Rice noodles, shrimp, tofu, bean sprouts, egg, peanuts, tamarind, fish sauce, sugar, lime',
'Green Curry':'Chicken, green curry paste, coconut milk, Thai basil, eggplant, fish sauce, sugar, rice',
'Pho Bo':'Beef, rice noodles, onion, ginger, star anise, cinnamon, herbs, fish sauce, beef broth'
};
for(const [name,ingredients] of Object.entries(ingredientDefaults)) db.prepare("UPDATE items SET ingredients=? WHERE name=? AND COALESCE(ingredients,'')=''").run(ingredients,name);
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
Regular|Filipino|Kare-Kare|Oxtail peanut stew with bagoong and vegetables|3.500|🥘
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
Other Asian|Japan|Chicken Katsu Curry|Crispy cutlet with Japanese curry rice|2.900|🍛
Other Asian|Japan|Salmon Sushi Roll|8-piece salmon maki roll|3.200|🍣
Other Asian|Korea|Bibimbap|Rice bowl with vegetables, beef and gochujang|3.000|🍲
Other Asian|Thailand|Pad Thai|Rice noodles, shrimp, peanuts and lime|2.800|🍜
Other Asian|Thailand|Green Curry|Coconut green curry with chicken and rice|2.900|🥥
Other Asian|Vietnam|Pho Bo|Beef noodle soup with herbs|3.000|🍜`.split('\n').forEach(l=>{const a=l.split('|');ins.run(...a.slice(0,4),+a[4],a[5])});
['Handaan feast|🍽️','Pancit for long life|🍜','Halo-halo summer|🍧','Lechon celebration|🐖','Sampaguita table|🌼','Kain tayo!|🍚'].forEach(x=>db.prepare('INSERT INTO gallery(caption,img) VALUES(?,NULL)').run(x));
[['Maria S.','Tastes just like my Lola\'s adobo. The delivery was fast and hot!',5],['Ahmed K.','Ordered catering for 30 people. Everyone loved the pancit and lechon.',5],['Joy R.','Budget meals are so filling. Tapsilog every Friday!',5]].forEach(x=>db.prepare('INSERT INTO testimonials(name,text,stars) VALUES(?,?,?)').run(...x));
}
const PLANS=[{id:'lunch26',name:'26-Day Lunch Plan',price:39,desc:'One Filipino lunch delivered daily for 26 days'},{id:'dinner26',name:'26-Day Dinner Plan',price:39,desc:'One Filipino dinner delivered daily for 26 days'},{id:'both26',name:'26-Day Lunch + Dinner',price:72,desc:'Lunch and dinner every day for 26 days'}];
db.exec(`CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT);CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,name TEXT,price REAL,descr TEXT,active INTEGER DEFAULT 1,includes TEXT DEFAULT '[]');`);
for(const c of['ALTER TABLE testimonials ADD COLUMN approved INTEGER DEFAULT 1',"ALTER TABLE inquiries ADD COLUMN status TEXT DEFAULT 'New'","ALTER TABLE plans ADD COLUMN includes TEXT DEFAULT '[]'","ALTER TABLE plans ADD COLUMN duration_days INTEGER DEFAULT 26","ALTER TABLE plans ADD COLUMN img TEXT DEFAULT ''"])try{db.exec(c)}catch(e){}
if(!db.prepare('SELECT COUNT(*) n FROM plans').get().n)PLANS.forEach(p=>db.prepare('INSERT INTO plans(id,name,price,descr,active,includes) VALUES(?,?,?,?,1,?)').run(p.id,p.name,p.price,p.desc,JSON.stringify(p.id==='lunch26'?['One Filipino lunch each day for 26 days','Daily delivery to your registered address','Cash on delivery']:p.id==='dinner26'?['One Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery']:['One Filipino lunch and one Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery'])));
const planInc=db.prepare("SELECT COUNT(*) n FROM plans WHERE includes IS NULL OR includes='' OR includes='[]'").get().n;if(planInc){db.prepare("UPDATE plans SET includes=? WHERE id='lunch26'").run(JSON.stringify(['One Filipino lunch each day for 26 days','Daily delivery to your registered address','Cash on delivery']));db.prepare("UPDATE plans SET includes=? WHERE id='dinner26'").run(JSON.stringify(['One Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery']));db.prepare("UPDATE plans SET includes=? WHERE id='both26'").run(JSON.stringify(['One Filipino lunch and one Filipino dinner each day for 26 days','Daily delivery to your registered address','Cash on delivery']))}
const DEF={name:NAME,currency:CUR,fee:String(FEE),min_order:'0',accepting:'1',subscriptions_enabled:'1',payment_card:'0',phone:'',hours:'',map_url:'',hero_img:'',hero_title:'Mabuhay! Kain Tayo 🇵🇭',hero_text:'Home-style Filipino cooking made with love — from everyday meals to fiesta catering, delivered to your door with payment options at checkout.',banner_position_x:'50',banner_position_y:'50',menu_default_icon:'/icons/pinoyambula.svg',drink_default_icon:'/icons/pinoyambula.svg',receipt_logo_url:'/icons/pinoyambula.svg',receipt_no_refund:'No refund after order confirmation.',receipt_exchange_policy:'Exchange only for verified order issues reported promptly.',theme_style:'filipino-heritage',content_service_regular_name:'Regular Meals',content_service_regular_description:'Classic Filipino ulam & rice',content_service_regular_image:'',content_service_budget_name:'Budget Meals',content_service_budget_description:'Filling silog meals, easy on the wallet',content_service_budget_image:'',content_service_drinks_name:'Drinks',content_service_drinks_description:"Sago't gulaman, buko, halo-halo etc.",content_service_drinks_image:'',content_service_sweets_name:'Sweets',content_service_sweets_description:'Filipino desserts and merienda favorites',content_service_sweets_image:'',content_service_catering_name:'Catering for Events',content_service_catering_description:'Party trays & Full Meals for any handaan',content_service_catering_image:'',receipt_title:'Delivery Receipt',receipt_customer_label:'Customer',receipt_delivery_label:'Delivery',receipt_payment_label:'Payment',receipt_items_label:'Order items',receipt_subtotal_label:'Subtotal',receipt_discount_label:'Discount',receipt_delivery_fee_label:'Delivery fee',receipt_total_label:'Total',receipt_tracking_label:'Delivery tracking',receipt_footer:'Thank you for ordering from PinoyAmbula. Keep this receipt for your records.',content_order_button:'Order Now!',content_subscription_button:'Subscription OFFER!',content_services_title:'Our Services',content_services_subtitle:'Tap a service to see its menu',content_menu_title:'Our Menu',content_menu_subtitle:'Filipino favorites plus dishes from around Asia',content_menu_search_label:'Find your',content_menu_search_placeholder:'Search dishes or ingredients',content_subscription_title:'Subscription Meal',content_subscription_subtitle:'Daily delivery for 26 days — payment status confirmed with the restaurant',content_subscribe_button:'Subscribe',content_subscribe_confirm_button:'Confirm',content_gallery_title:'Gallery',content_reviews_title:'What Our Customers Say',content_newsletter_title:'Newsletter',content_newsletter_subtitle:'Get promos and new dishes in your inbox',content_newsletter_button:'Subscribe',content_contact_title:'Inquiry / Contact',content_contact_subtitle:'Catering, party orders, questions — we reply fast',content_contact_button:'Send inquiry',content_cart_title:'Your Order',content_checkout_button:'Place Order',content_footer_thanks:'Maraming Salamat po!'};
for(const k in DEF)db.prepare('INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)').run(k,DEF[k]);
db.prepare('UPDATE settings SET v=? WHERE k=? AND v=?').run(DEF.hero_text,'hero_text','Home-style Filipino cooking made with love — from everyday meals to fiesta catering. Delivered to your door, pay cash on delivery.');
const S=()=>Object.fromEntries(db.prepare('SELECT k,v FROM settings').all().map(x=>[x.k,x.v]));
const sweets=[
  ['Leche Flan','Silky caramel custard made with egg yolks and condensed milk',1.200,'🍮'],
  ['Ube Halaya','Creamy purple yam dessert topped with toasted coconut',1.400,'🍠'],
  ['Turon','Crispy banana and jackfruit rolls with caramelized sugar',0.900,'🍌'],
  ['Bibingka','Soft rice cake baked with coconut and salted egg',1.300,'🥮']
];
const addSweet=db.prepare("INSERT INTO items(cat,region,name,descr,price,emoji) SELECT 'Sweets','Filipino',?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM items WHERE name=?)");
for(const [name,descr,price,emoji] of sweets)addSweet.run(name,descr,price,emoji,name);
if(!db.prepare('SELECT COUNT(*) n FROM regional_dishes').get().n){
  const regional=[
    ['Chicken Inasal','Western Visayas','Char-grilled marinated chicken associated with Bacolod and the Western Visayas.',3.000],
    ['La Paz Batchoy','Western Visayas','Rich noodle soup associated with La Paz, Iloilo.',2.800],
    ['Pinapaitan','Ilocos Region','Savory and bitter Ilocano stew traditionally made with offal and bile.',2.800],
    ['Pancit Batil Patung','Cagayan Valley','Noodle dish associated with Tuguegarao and nearby areas.',2.600],
    ['Kansi','Western Visayas','Sour beef soup associated with Negros Occidental and Iloilo.',3.100],
    ['Kinilaw','Visayas and Mindanao','Vinegar-cured seafood preparation found across many coastal communities in the Philippines.',2.900]
  ];
  const ri=db.prepare('INSERT INTO regional_dishes(name,region,descr,price,sort_order) VALUES(?,?,?,?,?)');
  regional.forEach((x,i)=>ri.run(x[0],x[1],x[2],x[3],i));
}
const moreRegional=[
  ['Bringhe','Central Luzon','Kapampangan-style festive rice dish cooked with coconut milk and chicken.',3.000],
  ['Pinangat','Bicol Region','Taro leaves simmered with coconut and savory filling, a Bicol classic.',2.900],
  ['Binagol','Eastern Visayas','Sweet taro-based delicacy traditionally prepared in a polished coconut shell.',2.200],
  ['Moron','Eastern Visayas','Sticky rice delicacy wrapped in banana leaves, associated with Leyte.',2.000],
  ['Chicken Binakol','Western Visayas','Chicken soup with coconut water and young coconut, popular in the Visayas.',3.100],
  ['Kinunot na Isda','Bicol Region','Flaked fish cooked with coconut cream and leafy aromatics.',3.100],
  ['Sinuglaw','Davao Region','Grilled fish and kinilaw-style seafood combined with vinegar and aromatics.',3.400],
  ['Lechon Manok','Visayas and Mindanao','Grilled or roasted whole chicken commonly served at family gatherings.',9.500],
  ['Pastil','Bangsamoro Region','Seasoned shredded meat or fish served over rice and wrapped for easy meals.',1.900]
];
const mr=db.prepare('INSERT INTO regional_dishes(name,region,descr,price,sort_order) VALUES(?,?,?,?,?)');
moreRegional.forEach((x,i)=>{if(!db.prepare('SELECT 1 FROM regional_dishes WHERE name=?').get(x[0]))mr.run(x[0],x[1],x[2],x[3],20+i);});
const sampleGallery=[
  ['Baybayin script — public-domain reference','https://commons.wikimedia.org/wiki/Special:Redirect/file/Baybayin_script_tagalog_wi.svg'],
  ['Bahay Kubo — Tboli nipa hut','https://commons.wikimedia.org/wiki/Special:Redirect/file/Bahay_kubo.jpg'],
  ['Filipino weaving culture','https://commons.wikimedia.org/wiki/Special:Redirect/file/Weaving_Culture_in_the_Philippines.jpg'],
  ['Fiesta salo-salo','https://commons.wikimedia.org/wiki/Special:Redirect/file/Fiesta_Salo-Salo_Foods_in_the_Philippines_%281%29.jpg']
];
for(const [caption,img] of sampleGallery){
  if(!db.prepare('SELECT 1 FROM gallery WHERE caption=?').get(caption))
    db.prepare('INSERT INTO gallery(img,caption,media_type,media_url) VALUES(?,?,?,?)').run(img,caption,'image','');
}
const sampleHeritage=[
  ['Baybayin script','Traditional Philippine writing system reference; image from Wikimedia Commons.','image','https://commons.wikimedia.org/wiki/Special:Redirect/file/Baybayin_script_tagalog_wi.svg',''],
  ['Bahay Kubo','Traditional Philippine raised house; image from Wikimedia Commons.','image','https://commons.wikimedia.org/wiki/Special:Redirect/file/Bahay_kubo.jpg',''],
  ['Weaving culture','Philippine handloom weaving tradition; image from Wikimedia Commons.','image','https://commons.wikimedia.org/wiki/Special:Redirect/file/Weaving_Culture_in_the_Philippines.jpg',''],
  ['Fiesta salo-salo','Shared food and community celebration; image from Wikimedia Commons.','image','https://commons.wikimedia.org/wiki/Special:Redirect/file/Fiesta_Salo-Salo_Foods_in_the_Philippines_%281%29.jpg','']
];
for(const [title,caption,media_type,img,media_url] of sampleHeritage){
  if(!db.prepare('SELECT 1 FROM heritage WHERE title=?').get(title))
    db.prepare('INSERT INTO heritage(title,caption,media_type,img,media_url,active,sort_order) VALUES(?,?,?,?,?,?,?)').run(title,caption,media_type,img,media_url,1,99);
}
const notificationOnce=async(eventKey,recipient,text)=>{
  if(!eventKey||!recipient||!whatsappConfigured())return {skipped:true,reason:'WhatsApp provider is not configured'};
  const existing=one("SELECT status FROM notification_log WHERE event_key=?",eventKey);
  if(existing&&['Sent','Pending'].includes(existing.status))return {duplicate:true,status:existing.status};
  if(existing){
    db.prepare("UPDATE notification_log SET recipient=?,status='Pending',error='' WHERE event_key=?").run(recipient,eventKey);
  }else{
    db.prepare("INSERT INTO notification_log(channel,event_key,recipient,status) VALUES('whatsapp',?,?,?)").run(eventKey,recipient,'Pending');
  }
  try{
    const result=await sendWhatsAppText(recipient,text);
    if(result.sent)db.prepare("UPDATE notification_log SET status='Sent',sent_at=CURRENT_TIMESTAMP,error='' WHERE event_key=?").run(eventKey);
    else db.prepare("UPDATE notification_log SET status='Skipped',error=? WHERE event_key=?").run(String(result.reason||'Skipped').slice(0,500),eventKey);
    return result;
  }catch(error){
    db.prepare("UPDATE notification_log SET status='Failed',error=? WHERE event_key=?").run(String(error.message||error).slice(0,500),eventKey);
    console.error('WHATSAPP_NOTIFICATION_FAILED',eventKey,error.message||error);
    return {failed:true,error:error.message||String(error)};
  }
};
const restaurantName=()=>String(S().name||NAME).trim();
const adminWhatsAppRecipient=()=>String(process.env.WHATSAPP_ADMIN_TO||'').trim();
const adminOrderWhatsAppText=order=>restaurantName()+': NEW ORDER #'+order.id+' from '+String(order.name||'Customer')+'. Total '+Number(order.total||0).toFixed(3)+' '+String(S().currency||CUR)+'. Payment: '+String(order.pay||'COD')+'.';
const adminInquiryWhatsAppText=inquiry=>restaurantName()+': NEW INQUIRY #'+inquiry.id+' from '+String(inquiry.name||'Customer')+'. Topic: '+String(inquiry.type||'General')+'. '+String(inquiry.msg||'').slice(0,700);
const adminMessageWhatsAppText=(inquiry,message)=>restaurantName()+': NEW CUSTOMER MESSAGE from '+String(inquiry.name||'Customer')+(inquiry.order_id?' for order #'+inquiry.order_id:'')+'. '+String(message||'').slice(0,700);
const notifyAdminWhatsApp=(eventKey,text)=>{
  const recipient=adminWhatsAppRecipient();
  if(!recipient)return Promise.resolve({skipped:true,reason:'WHATSAPP_ADMIN_TO is not configured'});
  return notificationOnce('admin:'+eventKey,recipient,text);
};
const orderWhatsAppText=(order,event)=>restaurantName()+': Order #'+order.id+' for '+String(order.name||'Customer')+' is now '+(event==='received'?'received':String(event).toLowerCase())+'. Total: '+Number(order.total||0).toFixed(3)+' '+String(S().currency||CUR)+'.';
const subscriptionWhatsAppText=(sub,event)=>restaurantName()+': Your '+String(sub.plan||'subscription')+' is '+String(event)+'. Schedule: '+sub.start+' to '+sub.end+'.';
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

// Live admin order stream. Orders are pushed to connected admin dashboards
// immediately after the database transaction commits; polling is not required.
const adminOrderStreams=new Set();
const customerStreams=new Map();

const broadcastAdminEvent=(event)=>{
  console.log('[ADMIN-SSE] broadcast type='+String(event?.type||'')+' id='+String(event?.id||'')+' clients='+adminOrderStreams.size);
  const payload='data: '+JSON.stringify(event)+'\n\n';
  for(const stream of adminOrderStreams){
    try{stream.write(payload);if(typeof stream.flush==='function')stream.flush()}catch(e){adminOrderStreams.delete(stream)}
  }
};

const queueAdminPush=event=>{
  Promise.resolve().then(()=>adminPush.sendAdminPush(db,event)).catch(error=>{
    console.error('[ADMIN-PUSH] Unexpected delivery error:',String(error?.message||error).slice(0,300));
  });
};

const broadcastCustomerEvent=(customerId,event)=>{
  const streams=customerStreams.get(Number(customerId));
  if(!streams?.size)return;
  console.log('[CUSTOMER-SSE] broadcast customer='+Number(customerId)+' type='+String(event?.type||'')+' id='+String(event?.id||'')+' clients='+streams.size);
  const payload='data: '+JSON.stringify(event)+'\n\n';
  for(const stream of streams){
    try{stream.write(payload);if(typeof stream.flush==='function')stream.flush()}catch(e){streams.delete(stream)}
  }
  if(!streams.size)customerStreams.delete(Number(customerId));
};

const broadcastCustomerOrder=order=>broadcastCustomerEvent(order.customer_id,{
  type:'order',
  id:Number(order.id),
  status:String(order.status||''),
  total:Number(order.total||0),
  created:String(order.created||'')
});

const broadcastCustomerOrderStatus=order=>broadcastCustomerEvent(order.customer_id,{
  type:'order_status',
  id:Number(order.id),
  status:String(order.status||''),
  status_message:String(order.status_message||''),
  eta:String(order.eta||''),
  driver_name:String(order.driver_name||''),
  driver_phone:String(order.driver_phone||''),
  created:String(order.created||'')
});

const broadcastCustomerMessage=(customerId,message)=>broadcastCustomerEvent(customerId,{
  type:'message',
  id:Number(message.id||0),
  inquiry_id:Number(message.inquiry_id||0),
  message:String(message.message||''),
  created:String(message.created||'')
});

const broadcastAdminOrder=order=>{
  broadcastAdminEvent({
    type:'order',
    id:Number(order.id),
    name:String(order.name||''),
    status:String(order.status||''),
    created:String(order.created||'')
  });
  queueAdminPush({key:'order:'+Number(order.id),type:'order',id:Number(order.id)});
};
const broadcastAdminInquiry=inquiry=>broadcastAdminEvent({
  type:'inquiry',
  id:Number(inquiry.id),
  customer_id:Number(inquiry.customer_id||0),
  order_id:Number(inquiry.order_id||0),
  name:String(inquiry.name||'customer'),
  created:String(inquiry.created||'')
});
const customerCursorSnapshot=customerId=>({
  orders:Number(db.prepare('SELECT COALESCE(MAX(id),0) id FROM orders WHERE customer_id=?').get(customerId).id||0),
  messages:Number(db.prepare("SELECT COALESCE(MAX(m.id),0) id FROM inquiry_messages m JOIN inquiries i ON i.id=m.inquiry_id WHERE i.customer_id=? AND m.author='admin'").get(customerId).id||0)
});
const customerEventsAfter=(customerId,cursor={})=>{
  const events=[
    ...db.prepare("SELECT id,'order' type,status,total,created FROM orders WHERE customer_id=? AND id>? ORDER BY id LIMIT 500").all(customerId,Math.max(0,+cursor.orders||0)),
    ...db.prepare("SELECT m.id,'message' type,m.message,m.created,i.id inquiry_id FROM inquiry_messages m JOIN inquiries i ON i.id=m.inquiry_id WHERE i.customer_id=? AND m.author='admin' AND m.id>? ORDER BY m.id LIMIT 500").all(customerId,Math.max(0,+cursor.messages||0))
  ];
  events.sort((a,b)=>String(a.created).localeCompare(String(b.created))||a.id-b.id);
  return events;
};
const adminCursorSnapshot=()=>({
  orders:Number(db.prepare('SELECT COALESCE(MAX(id),0) id FROM orders').get().id||0),
  inquiries:Number(db.prepare('SELECT COALESCE(MAX(id),0) id FROM inquiries').get().id||0),
  messages:Number(db.prepare("SELECT COALESCE(MAX(id),0) id FROM inquiry_messages WHERE author='customer'").get().id||0)
});
const adminEventsAfter=(cursor={})=>{
  const events=[
    ...db.prepare("SELECT id,'order' type,name,created FROM orders WHERE id>? ORDER BY id LIMIT 1000").all(Math.max(0,+cursor.orders||0)),
    ...db.prepare("SELECT id,'inquiry' type,customer_id,order_id,name,created FROM inquiries WHERE id>? ORDER BY id LIMIT 1000").all(Math.max(0,+cursor.inquiries||0)),
    ...db.prepare("SELECT m.id,'message' type,i.customer_id,i.order_id,i.name,m.created,i.id inquiry_id,m.message FROM inquiry_messages m JOIN inquiries i ON i.id=m.inquiry_id WHERE m.author='customer' AND m.id>? ORDER BY m.id LIMIT 1000").all(Math.max(0,+cursor.messages||0))
  ];
  events.sort((a,b)=>String(a.created).localeCompare(String(b.created))||a.id-b.id);
  return events;
};
const broadcastAdminMessage=(inquiry,message,messageId)=>{
  broadcastAdminEvent({
    type:'message',
    id:Number(messageId||0),
    customer_id:Number(inquiry.customer_id||0),
    order_id:Number(inquiry.order_id||0),
    name:String(inquiry.name||'customer'),
    inquiry_id:Number(inquiry.id),
    message:String(message||''),
    created:new Date().toISOString()
  });
  queueAdminPush({key:'message:'+Number(messageId||0),type:'message',id:Number(messageId||0)});
};

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
  r.set('Cache-Control','no-store');
  const st=S();
  r.json({
    ...st,
    fee:+st.fee||0,
    min_order:+st.min_order||0,
    accepting:st.accepting!=='0',
    approval_mode:st.approval_mode||'AUTO',
    payment_cod:st.payment_cod!=='0',
    payment_card:st.payment_card==='1',
    promo_enabled:st.promo_enabled!=='0',
    subscriptions_enabled:st.subscriptions_enabled!=='0'
  });
});
app.get('/api/menu',(q,r)=>{inventory.refreshDailyInventory(db,'items',kuwaitToday());r.set('Cache-Control','no-store');r.json(db.prepare('SELECT * FROM items WHERE active=1 ORDER BY id').all())});
app.get('/api/plans',(q,r)=>{
  if(S().subscriptions_enabled==='0')return r.json([]);
  r.json(db.prepare('SELECT id,name,price,descr AS "desc",includes,duration_days,img FROM plans WHERE active=1 ORDER BY rowid').all().map(p=>({...p,includes:(()=>{try{return JSON.parse(p.includes||'[]')}catch{return []}})()})));
});
app.get('/api/gallery',(q,r)=>r.json(db.prepare('SELECT * FROM gallery ORDER BY id').all()));
app.get('/api/testimonials',(q,r)=>r.json(db.prepare('SELECT * FROM testimonials WHERE approved=1 ORDER BY id DESC').all()));
app.post('/api/testimonials',lim(5),w((q,r)=>{need(q.body,'name','text');db.prepare('INSERT INTO testimonials(name,text,stars,approved) VALUES(?,?,?,0)').run(String(q.body.name).slice(0,60),String(q.body.text).slice(0,500),Math.min(5,Math.max(1,+q.body.stars||5)));r.json({ok:1})}));
app.post('/api/newsletter',lim(20),async(q,r)=>{
  const email=String(q.body.email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email))return r.status(400).json({error:'Valid email required'});
  const inserted=db.prepare('INSERT OR IGNORE INTO newsletter(email) VALUES(?)').run(email).changes>0;
  let welcomeEmailSent=true;
  if(inserted){
    try{await notifyNewsletterWelcome(email)}
    catch(error){
      welcomeEmailSent=false;
      console.error('NEWSLETTER_WELCOME_FAILED',error.message);
    }
  }
  r.json({ok:1,welcomeEmailSent,message:welcomeEmailSent?'Subscribed. Maraming Salamat po!':'Your subscription is saved, but the welcome email could not be sent. Please contact the restaurant if this continues.'});
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
  notifyInquiryReceived(inquiry);
  notifyAdminInquiry(inquiry);
  Promise.resolve(notifyAdminWhatsApp('inquiry:'+inquiry.id+':received',adminInquiryWhatsAppText(inquiry))).catch(()=>{});
  broadcastAdminInquiry(inquiry);
  queueAdminPush({key:'inquiry:'+Number(inquiry.id),type:'inquiry',id:Number(inquiry.id)});
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
    db.prepare('UPDATE customers SET name=?,phone=?,email=?,address=?,paci=?,birthday=?,nationality=?,pw=?,whatsapp_opt_in=? WHERE id=?').run(...values,hash(b.password),b.whatsapp_opt_in?1:0,customer.id);
    id=customer.id;
  }else{
    id=Number(db.prepare('INSERT INTO customers(name,phone,email,address,paci,birthday,nationality,pw,whatsapp_opt_in) VALUES(?,?,?,?,?,?,?,?,?)').run(...values,hash(b.password),b.whatsapp_opt_in?1:0).lastInsertRowid);
  }
  const registeredCustomer=one('SELECT id,name,email,phone FROM customers WHERE id=?',id);
  if(registeredCustomer?.email)Promise.resolve(notifyRegistration(registeredCustomer)).catch(error=>console.error('REGISTRATION_EMAIL_FAILED',error.message));
  if(b.whatsapp_opt_in)Promise.resolve(notificationOnce('customer:'+id+':registered',phone,restaurantName()+': Welcome, '+String(b.name).slice(0,80)+'! Your PinoyAmbula account is ready.')).catch(()=>{});
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
    try{
      await sendPasswordResetEmail({to:customer.email,name:customer.name,resetUrl});
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
  const inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE customer_id=? AND order_id=? ORDER BY id DESC LIMIT 1',q.cid,q.params.id);
  const messages=inquiry?db.prepare('SELECT id,author,message,created FROM inquiry_messages WHERE inquiry_id=? ORDER BY id').all(inquiry.id):[];
  const safeMessages=messages.length?messages:(inquiry?[{id:0,author:'customer',message:inquiry.msg,created:inquiry.created}]:[]);
  r.json({order,inquiry,messages:safeMessages});
}));
app.post('/api/customer/orders/:id/chat',lim(20),cust,w((q,r)=>{
  need(q.body,'message');
  const order=one('SELECT id,status FROM orders WHERE id=? AND customer_id=?',q.params.id,q.cid);
  if(!order)return r.status(404).json({error:'Order not found'});
  const c=one('SELECT name,email,phone FROM customers WHERE id=?',q.cid);
  const message=String(q.body.message).trim().slice(0,4000);
  if(!message)throw new Error('Message is required');
  let inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE customer_id=? AND order_id=? ORDER BY id DESC LIMIT 1',q.cid,q.params.id);
  if(!inquiry){
    const id=Number(db.prepare('INSERT INTO inquiries(customer_id,order_id,name,email,phone,type,msg,status) VALUES(?,?,?,?,?,?,?,?)').run(q.cid,q.params.id,c.name,c.email||'',c.phone||'','Order #'+q.params.id,message,'New').lastInsertRowid);
    inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE id=?',id);
  }else{
    db.prepare("UPDATE inquiries SET status='New',msg=? WHERE id=?").run(message,inquiry.id);
  }
  const messageId=Number(db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(inquiry.id,'customer',message).lastInsertRowid);
  notifyAdminCustomerMessage(inquiry,message);
  Promise.resolve(notifyAdminWhatsApp('message:'+messageId,adminMessageWhatsAppText(inquiry,message))).catch(()=>{});
  broadcastAdminMessage(inquiry,message,messageId);
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
  const messageId=Number(db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(inquiry.id,'customer',inquiry.msg).lastInsertRowid);
  notifyAdminCustomerMessage(inquiry,message);
  Promise.resolve(notifyAdminWhatsApp('message:'+messageId,adminMessageWhatsAppText(inquiry,message))).catch(()=>{});
  broadcastAdminInquiry(inquiry);
  broadcastAdminMessage(inquiry,message,messageId);
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
  Promise.resolve(notifyAdminWhatsApp('message:'+Number(id),adminMessageWhatsAppText(inquiry,message))).catch(()=>{});
  broadcastAdminMessage(inquiry,message,Number(id));
  r.json({ok:1,id:Number(id)});
}));
app.get('/api/me',cust,w((q,r)=>{
  const c=one('SELECT id,name,phone,email,address,paci,birthday,nationality FROM customers WHERE id=?',q.cid);
  const delivered=one("SELECT COUNT(*) n FROM orders WHERE customer_id=? AND status IN ('Delivered','Completed')",q.cid).n;
  const redeemed=db.prepare('SELECT threshold FROM loyalty_redemptions WHERE customer_id=?').all(q.cid).map(x=>x.threshold);
  const rewards=loyalty.availableRewards(delivered,redeemed);
  const orders=db.prepare('SELECT * FROM orders WHERE customer_id=? ORDER BY id DESC').all(q.cid).map(o=>{
    if(o.status!=='Out for delivery')return {...o,eta:'',driver_name:'',driver_phone:'',status_message:''};
    return {...o,eta:'',status_message:''};
  });
  r.json({...c,delivered,cycleProgress:loyalty.cycleProgress(delivered),rewards,orders,subs:db.prepare('SELECT * FROM subs WHERE customer_id=? ORDER BY id DESC').all(q.cid)});
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
    const rawId=String(i.id??'');
    if(rawId.startsWith('r:')){
      const rid=Number(rawId.slice(2));
      const x=one('SELECT id,name,region,price FROM regional_dishes WHERE id=? AND active=1',rid);
      if(!x)return null;
      return {id:'r:'+x.id,name:x.name,cat:'Regional',region:x.region,price:+x.price||0,regular_price:+x.price||0,qty:Math.max(1,Math.min(99,Math.trunc(+i.qty||1)))};
    }
    const x=one('SELECT id,name,cat,price,discount_price FROM items WHERE id=? AND active=1',rawId);
    if(!x)return null;
    const regular=+x.price||0,dp=+x.discount_price||0,unit=(dp>0&&dp<regular)?dp:regular;
    return {id:x.id,name:x.name,cat:x.cat,price:unit,regular_price:regular,qty:Math.max(1,Math.min(99,Math.trunc(+i.qty||1)))};
  }).filter(Boolean);

  if(!its.length)
    throw new Error('Cart is empty');

  const customerId=custId(b,q);
  const whatsappOptIn=!!(b.whatsapp_opt_in||(customerId&&one('SELECT whatsapp_opt_in FROM customers WHERE id=?',customerId)?.whatsapp_opt_in));
  const delivered=one("SELECT COUNT(*) n FROM orders WHERE customer_id=? AND status IN ('Delivered','Completed')",customerId).n;
  const rewardThreshold=+(b.loyalty_reward||0);
  if(rewardThreshold){
    if(!customerToken(q))throw new Error('Log in to redeem a loyalty reward.');
    const redeemedThresholds=db.prepare('SELECT threshold FROM loyalty_redemptions WHERE customer_id=?').all(customerId).map(x=>x.threshold);
    if(!loyalty.availableRewards(delivered,redeemedThresholds).some(reward=>reward.threshold===rewardThreshold))throw new Error('That loyalty reward is not available.');
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

  const rewardKind=loyalty.rewardKind(rewardThreshold);
  const eligibleMealPrices=its.filter(item=>['Regular','Budget'].includes(item.cat)).map(item=>item.price);
  if(rewardThreshold&&rewardKind===10&&!eligibleMealPrices.some(price=>Number(price)>0))throw new Error('Add a regular or budget meal to redeem your free meal.');
  const rewardDiscount=loyalty.calculateRewardDiscount(rewardThreshold,sub,eligibleMealPrices);
  const delivery=loyalty.deliveryFee(st.fee||0,rewardThreshold);
  discount=Math.min(sub,discount+rewardDiscount);
  const total=Math.max(0,sub-discount+delivery);
  const approval=String(st.approval_mode||'AUTO').toUpperCase();
  const status=approval==='ADMIN'?'Pending':'Confirmed';

  const saveOrder=db.transaction(()=>{
  inventory.reserveOrderInventory(db,its,kuwaitToday());
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
  db.prepare('UPDATE orders SET inventory_deducted=1 WHERE id=?').run(id);
  if(rewardThreshold)db.prepare('INSERT INTO loyalty_redemptions(customer_id,threshold,order_id) VALUES(?,?,?)').run(customerId,rewardThreshold,id);
  return Number(id);
  });
  const id=saveOrder();
  if(whatsappOptIn)db.prepare('UPDATE customers SET whatsapp_opt_in=1 WHERE id=?').run(customerId);
  db.prepare('UPDATE orders SET whatsapp_opt_in=? WHERE id=?').run(whatsappOptIn?1:0,id);
  const savedOrder=one('SELECT * FROM orders WHERE id=?',id);
  // Push immediately after the committed SQLite write. Email/WhatsApp notifications
  // must never delay the dashboard's live order delivery.
  broadcastAdminOrder(savedOrder);
  broadcastCustomerOrder(savedOrder);
  notifyOrderReceived(savedOrder);
  if(savedOrder.whatsapp_opt_in)Promise.resolve(notificationOnce('order:'+id+':received',savedOrder.phone,orderWhatsAppText(savedOrder,'received'))).catch(()=>{});
  Promise.resolve(notifyAdminWhatsApp('order:'+id+':received',adminOrderWhatsAppText(savedOrder))).catch(()=>{});
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
  if(S().subscriptions_enabled==='0')throw new Error('Subscription service is currently unavailable.');
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
  if(b.start<kuwaitToday())throw new Error('Start date cannot be in the past');
  const duration=Math.max(1,Math.min(366,+p.duration_days||26));
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+duration-1);
  const date=x=>x.toISOString().slice(0,10);
  const id=db.prepare('INSERT INTO subs(customer_id,name,nickname,phone,address,paci,plan,start,end,price,email,payment_method,payment_status,duration_days,whatsapp_opt_in) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(custId(b,q),String(b.name).slice(0,100),String(b.nickname||'').slice(0,60),String(b.phone).slice(0,40),String(b.address).slice(0,400),String(b.paci||'').slice(0,80),p.name,date(start),date(end),p.price,String(b.email).slice(0,200),payment,'Pending',duration,b.whatsapp_opt_in?1:0).lastInsertRowid;
  const savedSub=one('SELECT * FROM subs WHERE id=?',id);
  if(b.whatsapp_opt_in)db.prepare('UPDATE customers SET whatsapp_opt_in=1 WHERE id=?').run(savedSub.customer_id);
  notifySubscriptionReceived(savedSub);
  notifyAdminSubscription(savedSub);
  queueAdminPush({key:'subscription:'+Number(id),type:'subscription',id:Number(id)});
  if(savedSub.whatsapp_opt_in)Promise.resolve(notificationOnce('subscription:'+id+':received',savedSub.phone,subscriptionWhatsAppText(savedSub,'received'))).catch(()=>{});
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
  const order=one('SELECT id,customer_id,status,name,email,phone FROM orders WHERE id=?',q.params.id);
  if(!order)return r.status(404).json({error:'Order not found'});
  const inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE order_id=? ORDER BY id DESC LIMIT 1',q.params.id);
  const messages=inquiry?db.prepare('SELECT id,author,message,created FROM inquiry_messages WHERE inquiry_id=? ORDER BY id').all(inquiry.id):[];
  const safeMessages=messages.length?messages:(inquiry?[{id:0,author:'customer',message:inquiry.msg,created:inquiry.created}]:[]);
  r.json({order,inquiry,messages:safeMessages});
}));
app.post('/api/admin/orders/:id/chat',admin,w((q,r)=>{
  const order=one('SELECT id,customer_id,status,name,email,phone FROM orders WHERE id=?',q.params.id);
  if(!order)return r.status(404).json({error:'Order not found'});
  need(q.body,'message');
  const message=String(q.body.message).trim().slice(0,4000);
  if(!message)throw new Error('Message is required');
  let inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE order_id=? ORDER BY id DESC LIMIT 1',q.params.id);
  if(!inquiry){
    const result=db.prepare(
      'INSERT INTO inquiries(customer_id,order_id,name,email,phone,type,msg,status) VALUES(@customer_id,@order_id,@name,@email,@phone,@type,@msg,@status)'
    ).run({
      customer_id:order.customer_id==null?null:Number(order.customer_id),
      order_id:Number(order.id),
      name:String(order.name||''),
      email:String(order.email||''),
      phone:String(order.phone||''),
      type:'Order #'+Number(order.id),
      msg:message,
      status:'Replied'
    });
    const id=Number(result.lastInsertRowid);
    inquiry=one('SELECT id,order_id,name,email,phone,type,msg,status,created FROM inquiries WHERE id=?',id);
    db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(id,'admin',message);
  }else{
    const id=Number(db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(Number(inquiry.id),'admin',message).lastInsertRowid);
    db.prepare("UPDATE inquiries SET status='Replied',msg=? WHERE id=?").run(message,Number(inquiry.id));
    broadcastCustomerMessage(Number(order.customer_id),{id,inquiry_id:Number(inquiry.id),message,created:new Date().toISOString()});
    if(inquiry.email)Promise.resolve(notifyInquiryReply(inquiry,message)).catch(error=>console.error('ADMIN_ORDER_REPLY_EMAIL_FAILED',error.message));
    return r.json({ok:1,inquiryId:Number(inquiry.id),id,emailQueued:!!inquiry.email});
  }
  const sentRow=db.prepare('SELECT MAX(id) id FROM inquiry_messages WHERE inquiry_id=?').get(Number(inquiry.id));
  const sentId=Number(sentRow?.id||0);
  broadcastCustomerMessage(Number(order.customer_id),{id:sentId,inquiry_id:Number(inquiry.id),message,created:new Date().toISOString()});
  if(inquiry.email)Promise.resolve(notifyInquiryReply(inquiry,message)).catch(error=>console.error('ADMIN_ORDER_REPLY_EMAIL_FAILED',error.message));
  r.json({ok:1,inquiryId:Number(inquiry.id),id:sentId,emailQueued:!!inquiry.email});
}));
app.post('/api/admin/inquiries/:id/messages',admin,w((q,r)=>{
  const inquiry=one('SELECT id,customer_id,name,email,type,msg FROM inquiries WHERE id=?',q.params.id);
  if(!inquiry)return r.status(404).json({error:'Inquiry not found'});
  need(q.body,'message');
  const message=String(q.body.message).trim();
  if(message.length>4000)throw new Error('Reply must be 4000 characters or fewer');
  const id=Number(db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(q.params.id,'admin',message).lastInsertRowid);
  db.prepare("UPDATE inquiries SET status='Replied' WHERE id=?").run(q.params.id);
  broadcastCustomerMessage(inquiry.customer_id,{id,inquiry_id:Number(q.params.id),message,created:new Date().toISOString()});
  notifyInquiryReply(inquiry,message);
  r.json({ok:1,id,emailQueued:!!inquiry.email});
}));
app.post('/api/admin/customers/:id/messages',admin,w((q,r)=>{
  need(q.body,'message');
  const customer=one('SELECT id,name,email,phone FROM customers WHERE id=?',q.params.id);
  if(!customer)return r.status(404).json({error:'Customer not found'});
  const message=String(q.body.message).trim().slice(0,4000);
  if(!message)throw new Error('Message is required');
  let inquiry=one("SELECT id,name,email,phone,type,msg FROM inquiries WHERE customer_id=? ORDER BY id DESC LIMIT 1",customer.id);
  if(!inquiry){
    const id=Number(db.prepare('INSERT INTO inquiries(customer_id,name,email,phone,type,msg,status) VALUES(?,?,?,?,?,?,?)')
      .run(customer.id,customer.name,customer.email||'',customer.phone||'','Support',message,'Replied').lastInsertRowid);
    inquiry=one('SELECT id,name,email,phone,type,msg FROM inquiries WHERE id=?',id);
  }else{
    db.prepare("UPDATE inquiries SET status='Replied' WHERE id=?").run(inquiry.id);
  }
  const id=Number(db.prepare('INSERT INTO inquiry_messages(inquiry_id,author,message) VALUES(?,?,?)').run(inquiry.id,'admin',message).lastInsertRowid);
  broadcastCustomerMessage(customer.id,{id,inquiry_id:Number(inquiry.id),message,created:new Date().toISOString()});
  if(inquiry.email)notifyInquiryReply(inquiry,message);
  r.json({ok:1,inquiryId:Number(inquiry.id),id,emailQueued:!!inquiry.email});
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
  const id=tx();
  // Start the queue immediately so a broadcast does not wait for the next worker tick.
  setImmediate(processNewsletterQueue);
  r.json({ok:1,id,status:'Queued',total:subscribers.length});
}));
app.get('/api/admin/newsletter/campaigns',admin,w((q,r)=>{
  r.json(db.prepare('SELECT * FROM newsletter_campaigns ORDER BY id DESC LIMIT 20').all());
}));
app.get('/api/admin/events',(q,r)=>{
  if(rd(q)?.r!=='admin')return r.status(401).json({error:'Admin login required'});
  r.status(200).set({
    'Content-Type':'text/event-stream; charset=utf-8',
    'Cache-Control':'no-cache, no-transform',
    'Connection':'keep-alive',
    'X-Accel-Buffering':'no'
  });
  if(typeof r.flushHeaders==='function')r.flushHeaders();
  r.write('retry: 3000\n\n');
  adminOrderStreams.add(r);
  console.log('[ADMIN-SSE] connected clients='+adminOrderStreams.size);

  const hasCursor=['orders','inquiries','messages'].some(key=>q.query[key]!==undefined);
  if(hasCursor){
    const replay=adminEventsAfter({
      orders:q.query.orders,
      inquiries:q.query.inquiries,
      messages:q.query.messages
    });
    for(const event of replay){
      try{r.write('data: '+JSON.stringify(event)+'\n\n')}catch(e){break}
    }
    if(typeof r.flush==='function')r.flush();
    console.log('[ADMIN-SSE] replay events='+replay.length);
  }else{
    const cursor=adminCursorSnapshot();
    try{
      r.write('data: '+JSON.stringify({type:'ready',...cursor})+'\n\n');
      if(typeof r.flush==='function')r.flush();
    }catch(e){}
  }

  const heartbeat=setInterval(()=>{try{r.write(': heartbeat\n\n');if(typeof r.flush==='function')r.flush()}catch(e){}},15000);
  const close=()=>{
    clearInterval(heartbeat);
    adminOrderStreams.delete(r);
    console.log('[ADMIN-SSE] disconnected clients='+adminOrderStreams.size);
  };
  q.on('close',close);
  r.on('close',close);
  r.on('error',close);
});

app.get('/api/customer/events',(q,r)=>{
  const t=customerToken(q);
  if(!t)return r.status(401).json({error:'Login required'});
  const customerId=Number(t.id);
  r.status(200).set({
    'Content-Type':'text/event-stream; charset=utf-8',
    'Cache-Control':'no-cache, no-transform',
    'Connection':'keep-alive',
    'X-Accel-Buffering':'no'
  });
  if(typeof r.flushHeaders==='function')r.flushHeaders();
  r.write('retry: 3000\n\n');

  let streams=customerStreams.get(customerId);
  if(!streams){streams=new Set();customerStreams.set(customerId,streams)}
  streams.add(r);
  console.log('[CUSTOMER-SSE] connected customer='+customerId+' clients='+streams.size);

  const hasCursor=q.query.orders!==undefined||q.query.messages!==undefined;
  if(hasCursor){
    const replay=customerEventsAfter(customerId,{orders:q.query.orders,messages:q.query.messages});
    for(const event of replay){
      try{r.write('data: '+JSON.stringify(event)+'\n\n')}catch(e){break}
    }
    if(typeof r.flush==='function')r.flush();
  }else{
    const cursor=customerCursorSnapshot(customerId);
    try{
      r.write('data: '+JSON.stringify({type:'ready',...cursor})+'\n\n');
      if(typeof r.flush==='function')r.flush();
    }catch(e){}
  }

  const heartbeat=setInterval(()=>{try{r.write(': heartbeat\n\n');if(typeof r.flush==='function')r.flush()}catch(e){}},15000);
  const close=()=>{
    clearInterval(heartbeat);
    streams.delete(r);
    if(!streams.size)customerStreams.delete(customerId);
    console.log('[CUSTOMER-SSE] disconnected customer='+customerId);
  };
  q.on('close',close);
  r.on('close',close);
  r.on('error',close);
});

app.get('/api/admin/notifications',admin,w((q,r)=>{
  const hasCursor=['orders','inquiries','messages'].some(key=>q.query[key]!==undefined);
  const cursors=adminCursorSnapshot();
  if(!hasCursor)return r.json({...cursors,events:[]});
  r.json({...cursors,events:adminEventsAfter({
    orders:q.query.orders,
    inquiries:q.query.inquiries,
    messages:q.query.messages
  })});
}));
app.get('/api/admin/stats',admin,(q,r)=>{const n=s=>one(s).n;r.json({orders:n('SELECT COUNT(*) n FROM orders'),newOrders:n("SELECT COUNT(*) n FROM orders WHERE status='New'"),revenue:n("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status!='Cancelled'"),customers:n('SELECT COUNT(*) n FROM customers'),activeSubs:n("SELECT COUNT(*) n FROM subs WHERE status='Active'"),inquiries:n('SELECT COUNT(*) n FROM inquiries'),subscribers:n('SELECT COUNT(*) n FROM newsletter')})});
const buildAdminReport=(fromInput,toInput)=>{
  const kwToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
  const from=validDate(fromInput)?String(fromInput):kwToday;
  const to=validDate(toInput)?String(toInput):from;
  if(from>to)throw new Error('Report From date cannot be after To date');
  const orders=db.prepare("SELECT * FROM orders WHERE date(datetime(created,'+3 hours'))>=? AND date(datetime(created,'+3 hours'))<=? ORDER BY id").all(from,to);
  const active=orders.filter(x=>x.status!=='Cancelled');
  const paid=active.filter(x=>String(x.payment_status||'').toLowerCase()==='paid');
  const top={};
  for(const o of active){
    try{
      for(const i of JSON.parse(o.items||'[]'))top[i.name]=(top[i.name]||0)+(+i.qty||0);
    }catch{}
  }
  return {
    from,to,date:from===to?from:null,
    orders:orders.length,
    delivered:orders.filter(x=>x.status==='Delivered').length,
    newOrders:orders.filter(x=>x.status==='New').length,
    preparing:orders.filter(x=>x.status==='Preparing').length,
    outForDelivery:orders.filter(x=>x.status==='Out for delivery').length,
    cancelled:orders.filter(x=>x.status==='Cancelled').length,
    revenue:active.reduce((sum,x)=>sum+(+x.total||0),0),
    paidRevenue:paid.reduce((sum,x)=>sum+(+x.total||0),0),
    paidOrders:paid.length,
    averageOrder:active.length?active.reduce((sum,x)=>sum+(+x.total||0),0)/active.length:0,
    activeSubscriptions:one("SELECT COUNT(*) n FROM subs WHERE start<=? AND end>=? AND status!='Cancelled'",to,from).n,
    newSubscriptions:one("SELECT COUNT(*) n FROM subs WHERE date(datetime(created,'+3 hours'))>=? AND date(datetime(created,'+3 hours'))<=?",from,to).n,
    inquiries:one("SELECT COUNT(*) n FROM inquiries WHERE date(datetime(created,'+3 hours'))>=? AND date(datetime(created,'+3 hours'))<=?",from,to).n,
    newsletter:one("SELECT COUNT(*) n FROM newsletter WHERE date(datetime(created,'+3 hours'))>=? AND date(datetime(created,'+3 hours'))<=?",from,to).n,
    topItems:Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,qty])=>({name,qty})),
    ordersList:orders
  };
};
app.get('/api/admin/report',admin,w((q,r)=>r.json(buildAdminReport(q.query.date,q.query.date))));
app.get('/api/admin/report-range',admin,w((q,r)=>r.json(buildAdminReport(q.query.from,q.query.to))));

const T=['orders','customers','subs','inquiries','newsletter','testimonials','gallery','items','plans'],DEL=['items','gallery','testimonials','inquiries','newsletter','customers','plans'];
app.get('/api/admin/list/:t',admin,w((q,r)=>{
  const t=q.params.t;
  if(!T.includes(t))throw new Error('bad table');
  if(t==='items')inventory.refreshDailyInventory(db,'items',kuwaitToday());
  r.json(t==='customers'
    ?db.prepare('SELECT id,name,phone,email,created,(SELECT COUNT(*) FROM orders o WHERE o.customer_id=customers.id) orders,(SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.customer_id=customers.id) spent FROM customers ORDER BY id DESC').all()
    :db.prepare(`SELECT * FROM ${t} ORDER BY id DESC`).all());
}));
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
    db.transaction(()=>{
      if(status==='Cancelled'&&before.status!=='Cancelled'&&Number(before.inventory_deducted)===1){
        const createdDay=one("SELECT date(datetime(?,'+3 hours')) day",before.created)?.day;
        inventory.restoreCancelledOrderInventory(db,before,kuwaitToday(),createdDay);
      }
      db.prepare('UPDATE orders SET '+sets.join(',')+' WHERE id=?').run(...vals);
    })();
    const after=one('SELECT * FROM orders WHERE id=?',q.params.id);
    broadcastCustomerOrderStatus(after);
    notifyOrderStatus(after,before.status);
    if(after.whatsapp_opt_in)Promise.resolve(notificationOnce('order:'+after.id+':'+after.status,after.phone,orderWhatsAppText(after,after.status))).catch(()=>{});
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
    if(after.whatsapp_opt_in)Promise.resolve(notificationOnce('subscription:'+after.id+':'+after.status,after.phone,subscriptionWhatsAppText(after,after.status))).catch(()=>{});
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
  const allowed=['driver_name','driver_phone','cod_cash_collected'];
  const keys=Object.keys(q.body).filter(key=>allowed.includes(key));
  if(!keys.length)throw new Error('Only driver name and driver phone can be updated');
  const result=db.prepare(`UPDATE orders SET ${keys.map(key=>key+'=?').join(',')} WHERE id=?`)
    .run(...keys.map(key=>key==='cod_cash_collected'?(Number(q.body[key])?1:0):String(q.body[key]||'').slice(0,120)),q.params.id);
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
  const b=q.body,allowed=['name','email','phone','address','paci','start','end','duration_days','payment_method','payment_status','whatsapp_opt_in'];
  const keys=Object.keys(b).filter(key=>allowed.includes(key));
  if(!keys.length)throw new Error('Nothing to update');
  if((b.email!==undefined)&&b.email&&!/^\S+@\S+\.\S+$/.test(String(b.email)))throw new Error('Valid email required');
  if(b.payment_method!==undefined&&!['COD','CARD'].includes(String(b.payment_method).toUpperCase()))throw new Error('Invalid payment method');
  if(b.payment_status!==undefined&&!['Pending','Paid','Failed','Refunded'].includes(b.payment_status))throw new Error('Invalid payment status');
  for(const key of ['start','end'])if(b[key]!==undefined&&!validDate(b[key]))throw new Error('Invalid '+key+' date');
  const current=one('SELECT start,end,duration_days FROM subs WHERE id=?',q.params.id);
  if(!current)throw new Error('Subscription not found');
  const start=b.start||current.start;
  let end=b.end||current.end;
  let duration=Math.max(1,Math.min(366,Math.trunc(+b.duration_days||current.duration_days||26)));
  if((b.start!==undefined||b.duration_days!==undefined)&&b.end===undefined){
    const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+duration-1);end=d.toISOString().slice(0,10);b.end=end;
    if(!keys.includes('end'))keys.push('end');
  }
  if(b.end!==undefined&&b.duration_days===undefined&&start&&b.end){
    const a=new Date(start+'T00:00:00Z'),z=new Date(String(b.end)+'T00:00:00Z');
    duration=Math.max(1,Math.round((z-a)/86400000)+1);b.duration_days=duration;
    if(!keys.includes('duration_days'))keys.push('duration_days');
  }
  if(b.duration_days!==undefined&&b.end===undefined&&b.start===undefined){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+duration-1);end=d.toISOString().slice(0,10);b.end=end;if(!keys.includes('end'))keys.push('end');}
  if(start>end)throw new Error('End date must be on or after start date');
  const before=one('SELECT * FROM subs WHERE id=?',q.params.id);
  if(!before)throw new Error('Subscription not found');
  const result=db.prepare(`UPDATE subs SET ${keys.map(key=>key+'=?').join(',')} WHERE id=?`)
    .run(...keys.map(key=>key==='payment_method'?String(b[key]).toUpperCase():String(b[key]).slice(0,500)),q.params.id);
  if(!result.changes)throw new Error('Subscription not found');
  const after=one('SELECT * FROM subs WHERE id=?',q.params.id);
  if(keys.includes('payment_status'))notifySubscriptionPaymentStatus(after,before.payment_status);
  if(keys.includes('whatsapp_opt_in'))db.prepare('UPDATE customers SET whatsapp_opt_in=? WHERE id=?').run(after.whatsapp_opt_in?1:0,after.customer_id);
  r.json({ok:1});
}));
const validDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;
  const date=new Date(value+'T00:00:00Z');
  return Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==value?null:value;
};

const F=['cat','region','name','descr','ingredients','price','discount_price','emoji','active','stock_available','daily_restock_quantity'];
app.put('/api/admin/items/:id',admin,w((q,r)=>{
  const k=Object.keys(q.body).filter(x=>F.includes(x));
  if('price' in q.body&&!(+q.body.price>=0))throw new Error('Invalid price');
  for(const field of ['stock_available','daily_restock_quantity']){
    if(field in q.body)q.body[field]=inventory.quantity(q.body[field]);
  }
  if('stock_available' in q.body){q.body.stock_date=kuwaitToday();k.push('stock_date');}
  if(!k.length)throw new Error('nothing to update');
  db.prepare(`UPDATE items SET ${k.map(x=>x+'=?').join(',')} WHERE id=?`).run(...k.map(x=>q.body[x]),q.params.id);
  r.json({ok:1});
}));
app.post('/api/admin/items',admin,w((q,r)=>{
  const b=q.body;
  need(b,'name','price','cat');
  if(!(+b.price>=0))throw new Error('Invalid price');
  if(b.discount_price!==undefined && b.discount_price!=='' && !(+b.discount_price>=0))throw new Error('Invalid discount price');
  const stockAvailable=inventory.quantity(b.stock_available);
  const dailyRestock=inventory.quantity(b.daily_restock_quantity);
  db.prepare(
    'INSERT INTO items(cat,region,name,descr,ingredients,price,discount_price,emoji,stock_available,daily_restock_quantity,stock_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    b.cat,b.region||'Filipino',b.name,b.descr||'',b.ingredients||'',+b.price,
    b.discount_price===''?null:+b.discount_price||0,b.emoji||'🍽️',
    stockAvailable,dailyRestock,kuwaitToday()
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
  'name','phone','hours','currency','fee','min_order','accepting','subscriptions_enabled',
  'hero_title','hero_text','logo_url','whatsapp','facebook','instagram',
  'location','map_url','approval_mode','payment_cod','payment_card',
  'promo_enabled','promo_code','promo_type','promo_value','menu_default_icon','drink_default_icon','receipt_logo_url','receipt_no_refund','receipt_exchange_policy','banner_position_x','banner_position_y','theme_style',
  'content_service_regular_name','content_service_regular_description','content_service_regular_image','content_service_budget_name','content_service_budget_description','content_service_budget_image','content_service_drinks_name','content_service_drinks_description','content_service_drinks_image','content_service_sweets_name','content_service_sweets_description','content_service_sweets_image','content_service_catering_name','content_service_catering_description','content_service_catering_image','receipt_title','receipt_customer_label','receipt_delivery_label','receipt_payment_label','receipt_items_label','receipt_subtotal_label','receipt_discount_label','receipt_delivery_fee_label','receipt_total_label','receipt_tracking_label','receipt_footer','content_order_button','content_subscription_button','content_services_title','content_services_subtitle','content_menu_title','content_menu_subtitle','content_menu_search_label','content_menu_search_placeholder','content_subscription_title','content_subscription_subtitle','content_subscribe_button','content_subscribe_confirm_button','content_gallery_title','content_reviews_title','content_newsletter_title','content_newsletter_subtitle','content_newsletter_button','content_contact_title','content_contact_subtitle','content_contact_button','content_cart_title','content_checkout_button','content_footer_thanks'
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

  for(const key of ['banner_position_x','banner_position_y']){
    if(b[key]!==undefined&&(!Number.isFinite(+b[key])||+b[key]<0||+b[key]>100))
      throw new Error('Banner position must be between 0 and 100');
  }

  if(b.subscriptions_enabled!==undefined&&!['0','1'].includes(String(b.subscriptions_enabled)))
    throw new Error('Invalid subscription service setting');

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
const up=multer({storage:multer.diskStorage({destination:UP,filename:(q,f,cb)=>cb(null,crypto.randomBytes(8).toString('hex')+path.extname(f.originalname).toLowerCase())}),limits:{fileSize:5e6},fileFilter:(q,f,cb)=>/^image\/(jpe?g|png|webp|gif|svg\+xml)$/.test(f.mimetype)?cb(null,true):cb(new Error('Images only (jpg, png, webp, gif, svg)'))});
const websiteServiceImageKeys={regular:'content_service_regular_image',budget:'content_service_budget_image',drinks:'content_service_drinks_image',sweets:'content_service_sweets_image',catering:'content_service_catering_image'};
app.post('/api/admin/upload',admin,up.single('file'),w((q,r)=>{if(!q.file)throw new Error('No file');const url='/uploads/'+q.file.filename,t=q.query;
const serviceKey=t.target==='service'?websiteServiceImageKeys[t.key]:null;
const old=serviceKey?one('SELECT v x FROM settings WHERE k=?',serviceKey)?.x:t.target==='receipt-logo'?one("SELECT v x FROM settings WHERE k='receipt_logo_url'")?.x:t.target==='logo'?one("SELECT v x FROM settings WHERE k='logo_url'")?.x:t.target==='hero'?one("SELECT v x FROM settings WHERE k='hero_img'")?.x:t.target==='item'?one('SELECT img x FROM items WHERE id=?',t.id)?.x:t.target==='plan'?one('SELECT img x FROM plans WHERE id=?',t.id)?.x:t.target==='announcement'?one('SELECT image x FROM announcements WHERE id=?',t.id)?.x:t.target==='regional'?one('SELECT img x FROM regional_dishes WHERE id=?',t.id)?.x:t.target==='heritage'?one('SELECT img x FROM heritage WHERE id=?',t.id)?.x:t.id?one('SELECT img x FROM gallery WHERE id=?',t.id)?.x:null;
if(serviceKey)db.prepare('INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)').run(serviceKey,url);else if(t.target==='receipt-logo')db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('receipt_logo_url',?)").run(url);else if(t.target==='logo')db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('logo_url',?)").run(url);else if(t.target==='hero')db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('hero_img',?)").run(url);else if(t.target==='item')db.prepare('UPDATE items SET img=? WHERE id=?').run(url,t.id);else if(t.target==='plan')db.prepare('UPDATE plans SET img=? WHERE id=?').run(url,t.id);else if(t.target==='announcement')db.prepare('UPDATE announcements SET image=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(url,t.id);else if(t.target==='regional')db.prepare('UPDATE regional_dishes SET img=? WHERE id=?').run(url,t.id);else if(t.target==='heritage')db.prepare("UPDATE heritage SET img=?,media_type='image',media_url=? WHERE id=?").run(url,url,t.id);else if(t.id)db.prepare("UPDATE gallery SET img=?,media_type='image',media_url=? WHERE id=?").run(url,url,t.id);else db.prepare("INSERT INTO gallery(img,caption,media_type,media_url) VALUES(?,'','image',?)").run(url,url);
if(old&&old.startsWith('/uploads/'))fs.unlink(path.join(UP,path.basename(old)),()=>{});r.json({url})}));
app.delete('/api/admin/image',admin,w((q,r)=>{
  const {target,id}=q.body||{};
  let row,clear;
  if(target==='service'){
    const key=websiteServiceImageKeys[String(id||'')];
    if(!key)throw new Error('Invalid service image target');
    row=one('SELECT v img FROM settings WHERE k=?',key);
    clear=()=>db.prepare('INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)').run(key,'');
  }else if(target==='receipt-logo'){
    row=one("SELECT v img FROM settings WHERE k='receipt_logo_url'");
    clear=()=>db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('receipt_logo_url','')").run();
  }else if(target==='logo'){
    row=one("SELECT v img FROM settings WHERE k='logo_url'");
    clear=()=>db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('logo_url','')").run();
  }else if(target==='hero'){
    row=one("SELECT v img FROM settings WHERE k='hero_img'");
    clear=()=>db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('hero_img','')").run();
  }else if(target==='item'){
    row=one('SELECT img FROM items WHERE id=?',id);
    clear=()=>db.prepare('UPDATE items SET img=NULL WHERE id=?').run(id);
  }else if(target==='plan'){
    row=one('SELECT img FROM plans WHERE id=?',id);
    clear=()=>db.prepare("UPDATE plans SET img='' WHERE id=?").run(id);
  }else if(target==='announcement'){
    row=one('SELECT image FROM announcements WHERE id=?',id);
    clear=()=>db.prepare("UPDATE announcements SET image='',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  }else if(target==='regional'){
    row=one('SELECT img FROM regional_dishes WHERE id=?',id);
    clear=()=>db.prepare('UPDATE regional_dishes SET img="" WHERE id=?').run(id);
  }else if(target==='heritage'){
    row=one('SELECT img FROM heritage WHERE id=?',id);
    clear=()=>db.prepare("UPDATE heritage SET img='',media_type='image',media_url='' WHERE id=?").run(id);
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
const newsletterIntervalMs=Math.max(5000,+(E.NEWSLETTER_INTERVAL_MS||5000));
setInterval(processNewsletterQueue,newsletterIntervalMs).unref();
setImmediate(processNewsletterQueue);
const announcementDateTime=value=>{
  const raw=String(value??'').trim();
  if(!raw)return '';
  const normalized=raw.replace('T',' ');
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(normalized))throw new Error('Invalid announcement date/time');
  const iso=normalized.replace(' ','T')+(normalized.length===16?':00':'');
  const date=new Date(iso+'Z');
  if(Number.isNaN(date.valueOf()))throw new Error('Invalid announcement date/time');
  return date.toISOString().slice(0,19).replace('T',' ');
};
const announcementUrl=value=>{
  const url=String(value??'').trim();
  if(!url)return '';
  if(/^\/(?!\/)/.test(url)||url.startsWith('#'))return url.slice(0,500);
  try{
    const parsed=new URL(url);
    if(!['http:','https:'].includes(parsed.protocol))throw new Error();
    return parsed.toString().slice(0,500);
  }catch{throw new Error('CTA URL must be a valid http(s) URL or site path such as /#menu');}
};
const announcementPayload=(body,current={})=>{
  const title=String(body.title??current.title??'').trim().slice(0,160);
  const message=String(body.message??current.message??'').trim().slice(0,1000);
  if(!title||!message)throw new Error('Announcement title and message are required');
  const starts=body.starts_at!==undefined?announcementDateTime(body.starts_at):String(current.starts_at||'');
  const ends=body.ends_at!==undefined?announcementDateTime(body.ends_at):String(current.ends_at||'');
  if(starts&&ends&&starts>ends)throw new Error('Announcement end must be after its start');
  return {
    title,message,
    image:String(body.image??current.image??'').slice(0,500),
    cta_label:String(body.cta_label??current.cta_label??'').trim().slice(0,80),
    cta_url:announcementUrl(body.cta_url??current.cta_url??''),
    priority:Math.trunc(+(body.priority??current.priority??0)||0),
    starts_at:starts,ends_at:ends,
    active:body.active===undefined?(Number(current.active??1)?1:0):(body.active?1:0)
  };
};
app.get('/api/announcements',(q,r)=>{
  r.json(db.prepare("SELECT id,title,message,image,cta_label,cta_url,priority,starts_at,ends_at,active FROM announcements WHERE active=1 AND (starts_at='' OR starts_at IS NULL OR starts_at<=datetime('now')) AND (ends_at='' OR ends_at IS NULL OR ends_at>=datetime('now')) ORDER BY priority DESC,id DESC").all());
});
app.get('/api/regional-dishes',(q,r)=>{inventory.refreshDailyInventory(db,'regional_dishes',kuwaitToday());r.set('Cache-Control','no-store');r.json(db.prepare("SELECT id,name,region,descr,price,img,stock_available,daily_restock_quantity FROM regional_dishes WHERE active=1 ORDER BY sort_order,id").all())});
app.get('/api/heritage',(q,r)=>r.json(db.prepare("SELECT id,title,caption,media_type,img,media_url FROM heritage WHERE active=1 ORDER BY sort_order,id").all()));
app.get('/api/admin/announcements',admin,w((q,r)=>r.json(db.prepare('SELECT * FROM announcements ORDER BY priority DESC,id DESC').all())));
app.post('/api/admin/announcements',admin,w((q,r)=>{
  const b=announcementPayload(q.body);
  const id=Number(db.prepare('INSERT INTO announcements(title,message,image,cta_label,cta_url,priority,starts_at,ends_at,active) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(b.title,b.message,b.image,b.cta_label,b.cta_url,b.priority,b.starts_at,b.ends_at,b.active).lastInsertRowid);
  r.json({ok:1,id});
}));
app.put('/api/admin/announcements/:id',admin,w((q,r)=>{
  const current=one('SELECT * FROM announcements WHERE id=?',q.params.id);
  if(!current)throw new Error('Announcement not found');
  const b=announcementPayload(q.body,current);
  db.prepare('UPDATE announcements SET title=?,message=?,image=?,cta_label=?,cta_url=?,priority=?,starts_at=?,ends_at=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(b.title,b.message,b.image,b.cta_label,b.cta_url,b.priority,b.starts_at,b.ends_at,b.active,q.params.id);
  r.json({ok:1});
}));
app.delete('/api/admin/announcements/:id',admin,w((q,r)=>{
  const row=one('SELECT image FROM announcements WHERE id=?',q.params.id);
  if(!row)throw new Error('Announcement not found');
  if(row.image?.startsWith('/uploads/'))fs.unlink(path.join(UP,path.basename(row.image)),()=>{});
  db.prepare('DELETE FROM announcements WHERE id=?').run(q.params.id);
  r.json({ok:1});
}));
app.get('/api/admin/regional-dishes',admin,w((q,r)=>{inventory.refreshDailyInventory(db,'regional_dishes',kuwaitToday());r.json(db.prepare('SELECT * FROM regional_dishes ORDER BY sort_order,id').all())}));
app.post('/api/admin/regional-dishes',admin,w((q,r)=>{
  need(q.body,'name','region');
  const b=q.body;
  const stockAvailable=inventory.quantity(b.stock_available);
  const dailyRestock=inventory.quantity(b.daily_restock_quantity);
  const id=Number(db.prepare('INSERT INTO regional_dishes(name,region,descr,price,img,active,sort_order,stock_available,daily_restock_quantity,stock_date) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(String(b.name).slice(0,120),String(b.region).slice(0,120),String(b.descr||'').slice(0,600),Math.max(0,+b.price||0),String(b.img||''),b.active===0?0:1,Math.trunc(+b.sort_order||0),stockAvailable,dailyRestock,kuwaitToday()).lastInsertRowid);
  r.json({ok:1,id});
}));
app.put('/api/admin/regional-dishes/:id',admin,w((q,r)=>{
  const keys=Object.keys(q.body).filter(k=>['name','region','descr','price','img','active','sort_order','stock_available','daily_restock_quantity'].includes(k));
  if(!keys.length)throw new Error('Nothing to update');
  for(const field of ['stock_available','daily_restock_quantity']){
    if(field in q.body)q.body[field]=inventory.quantity(q.body[field]);
  }
  if('stock_available' in q.body){q.body.stock_date=kuwaitToday();keys.push('stock_date');}
  const result=db.prepare('UPDATE regional_dishes SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?')
    .run(...keys.map(k=>k==='price'?Math.max(0,+q.body[k]||0):k==='sort_order'?Math.trunc(+q.body[k]||0):q.body[k]),q.params.id);
  if(!result.changes)throw new Error('Regional dish not found');
  r.json({ok:1});
}));
app.delete('/api/admin/regional-dishes/:id',admin,w((q,r)=>{
  const row=one('SELECT img FROM regional_dishes WHERE id=?',q.params.id);
  if(row?.img?.startsWith('/uploads/'))fs.unlink(path.join(UP,path.basename(row.img)),()=>{});
  db.prepare('DELETE FROM regional_dishes WHERE id=?').run(q.params.id);
  r.json({ok:1});
}));
app.get('/api/admin/heritage',admin,w((q,r)=>r.json(db.prepare('SELECT * FROM heritage ORDER BY sort_order,id').all())));
app.post('/api/admin/heritage',admin,w((q,r)=>{need(q.body,'title');const type=['image','video'].includes(q.body.media_type)?q.body.media_type:'image';const id=Number(db.prepare('INSERT INTO heritage(title,caption,media_type,img,media_url,active,sort_order) VALUES(?,?,?,?,?,?,?)').run(String(q.body.title).slice(0,160),String(q.body.caption||'').slice(0,600),type,String(q.body.img||''),String(q.body.media_url||'').slice(0,500),q.body.active===0?0:1,Math.trunc(+q.body.sort_order||0)).lastInsertRowid);r.json({ok:1,id});}));
app.put('/api/admin/heritage/:id',admin,w((q,r)=>{const keys=Object.keys(q.body).filter(k=>['title','caption','media_type','img','media_url','active','sort_order'].includes(k));if(!keys.length)throw new Error('Nothing to update');db.prepare('UPDATE heritage SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...keys.map(k=>k==='media_type'?(['image','video'].includes(q.body[k])?q.body[k]:'image'):k==='sort_order'?Math.trunc(+q.body[k]||0):q.body[k]),q.params.id);r.json({ok:1});}));
app.delete('/api/admin/heritage/:id',admin,w((q,r)=>{const row=one('SELECT img FROM heritage WHERE id=?',q.params.id);if(row?.img?.startsWith('/uploads/'))fs.unlink(path.join(UP,path.basename(row.img)),()=>{});db.prepare('DELETE FROM heritage WHERE id=?').run(q.params.id);r.json({ok:1});}));
app.get('/api/admin/whatsapp/status',admin,(q,r)=>r.json({...whatsappStatus(),adminRecipientConfigured:Boolean(adminWhatsAppRecipient())}));
app.post('/api/admin/email/test',admin,async(q,r)=>{
  const to=String(q.body?.to||process.env.GMAIL_ADMIN_NOTIFY_TO||process.env.GMAIL_USER||'').trim();
  if(!to)return r.status(400).json({ok:false,error:'No test email recipient configured'});
  try{
    const result=await sendMail({
      to,
      subject:restaurantName()+': Email notification test',
      text:'This is a live email delivery test from '+restaurantName()+'. If you received this message, the Gmail notification route is working.',
      html:'<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Email notification test</h2><p>This is a live email delivery test from <b>'+escHtml(restaurantName())+'</b>.</p><p>If you received this message, the Gmail notification route is working.</p></div>'
    });
    console.log('EMAIL_TEST_SENT',to,result?.id||'');
    r.json({ok:true,to,messageId:result?.id||null});
  }catch(error){
    console.error('EMAIL_TEST_FAILED',to,error.message);
    r.status(503).json({ok:false,to,error:error.message});
  }
});
app.get('/api/admin/notification-status',admin,(q,r)=>r.json({
  emailConfigured:Boolean(E.GMAIL_USER&&E.GMAIL_CLIENT_ID&&E.GMAIL_CLIENT_SECRET&&E.GMAIL_REFRESH_TOKEN),
  adminEmailConfigured:Boolean(E.GMAIL_ADMIN_NOTIFY_TO||E.GMAIL_USER),
  whatsapp:{...whatsappStatus(),adminRecipientConfigured:Boolean(adminWhatsAppRecipient())}
}));
app.get('/check.html',(q,r,n)=>E.ENABLE_CHECK==='0'?r.status(404).send('Not found'):n());
app.use((q,r,n)=>{
  const host=String(q.hostname||'').toLowerCase();
  const configuredAdminHost=String(E.ADMIN_HOST||'admin.pinoyambula.com').toLowerCase();
  const isAdminHost=host===configuredAdminHost||host==='admin.localhost';
  if(isAdminHost&&q.path==='/website'){
    const publicBase=String(E.PUBLIC_BASE_URL||'').replace(/\/+$/,'');
    if(publicBase)return r.redirect(publicBase);
    if(host==='admin.localhost')return r.redirect(`http://localhost:${PORT}`);
    return r.status(503).send('Customer website URL is not configured');
  }
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
