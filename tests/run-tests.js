
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {execFileSync}=require("child_process");
const Database=require("better-sqlite3");

const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
const index=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
const account=fs.readFileSync(path.join(root,"public","account.html"),"utf8");
const admin=fs.readFileSync(path.join(root,"public","admin.html"),"utf8");
const enh=fs.readFileSync(path.join(root,"public","enhancements.js"),"utf8");
const app=fs.readFileSync(path.join(root,"public","app.js"),"utf8");
const style=fs.readFileSync(path.join(root,"public","style.css"),"utf8");
const deploy=fs.readFileSync(path.join(root,"deploy.sh"),"utf8");

function test(name,fn){
  try{
    fn();
    console.log("PASS",name);
  }catch(e){
    console.error("FAIL",name);
    console.error("   ",e.message);
    process.exitCode=1;
  }
}

test("JavaScript syntax checks pass",()=>{
  for(const file of ["server.js","lib/gmail.js","lib/notifications.js","public/app.js","public/enhancements.js","public/admin.html","public/account.html"]){
    if(/\.js$/.test(file))execFileSync(process.execPath,["--check",path.join(root,file)],{stdio:"pipe"});
  }
});
test("server contains order API",()=>{
  assert(server.includes("app.post('/api/order'"));
});

test("server enforces accepting orders",()=>{
  assert(server.includes("st.accepting!=='1'"));
});

test("production deployment disables the function-check endpoint",()=>{
  assert(deploy.includes('ENABLE_CHECK=0'));
  assert(deploy.includes("sed -i 's/^ENABLE_CHECK=.*/ENABLE_CHECK=0/'"));
  assert(server.includes("E.ENABLE_CHECK==='0'"));
});

test("server supports admin approval mode",()=>{
  assert(server.includes("approval_mode"));
  assert(server.includes("const approval="));
  assert(server.includes("status=approval"));
});

test("customer cancellation endpoint removed",()=>{
  assert(!server.includes("app.post('/api/orders/:id/cancel'"));
});

test("server calculates discount",()=>{
  assert(server.includes("promo_code"));
  assert(server.includes("discount"));
  assert(server.includes("promo_type"));
});

test("server supports item discount price",()=>{
  assert(server.includes("discount_price"));
});

test("server supports payment methods",()=>{
  assert(server.includes("payment_card"));
  assert(server.includes("requestedPay"));
});

test("settings contain social fields",()=>{
  assert(server.includes("whatsapp"));
  assert(server.includes("facebook"));
  assert(server.includes("instagram"));
});

test("settings contain location, map and logo",()=>{
  assert(server.includes("location"));
  assert(server.includes("map_url"));
  assert(server.includes("logo_url"));
  assert(admin.includes("Google Maps URL"));
  assert(index.includes("google.com/maps/search"));
});

test("customer tracker exists",()=>{
  assert(account.includes("order-tracker"));
  assert(account.includes("orderStep"));
});

test("customer page has no cancel button",()=>{
  assert(!account.includes("Cancel this order"));
  assert(!account.includes("/cancel"));
});

test("customer payment is selectable",()=>{
  assert(index.includes('name="pay"'));
  assert(index.includes('value="CARD"'));
});

test("customer profile captures and prefills delivery details",()=>{
  assert(server.includes("'customers','address'"));
  assert(server.includes("'customers','birthday'"));
  assert(server.includes("'customers','nationality'"));
  assert(account.includes('name="birthday"'));
  assert(index.includes('async function fillCustomerDetails()'));
  assert(index.includes("addEventListener('storage'"));
  assert(index.includes('loadedCustomerToken=token'));
  assert(index.includes("if(tk('ct')!==token||loadedCustomerToken!==token)return"));
});

test("customer cart stays reachable and account errors preserve valid sessions",()=>{
  assert(index.includes('id="cart-fab"'));
  assert(index.includes("$('#cart-count-fab').textContent=count"));
  assert(account.includes("if(x.message==='Login required')localStorage.removeItem('ct')"));
});

test("customer forgot-password uses secure email reset",()=>{
  assert(account.includes('Forgot password?'));
  assert(account.includes('type="email"'));
  assert(server.includes("app.post('/api/password-reset'"));
  assert(server.includes("app.post('/api/password-reset/confirm'"));
  assert(server.includes('password_reset_tokens'));
  assert(server.includes('auth_version'));
  assert(server.includes('sendMail'));
  assert(fs.existsSync(path.join(root,'lib','gmail.js')));
  assert(fs.existsSync(path.join(root,'public','reset-password.html')));
  assert(!account.includes('staff will verify'));
  assert(!account.includes('temporary password'));
});

test("Gmail password reset uses OAuth Gmail API instead of SMTP",()=>{
  const gmail=fs.readFileSync(path.join(root,"lib","gmail.js"),"utf8");
  assert(server.includes("getAuthorizationUrl"));
  assert(server.includes("/api/gmail/oauth/start"));
  assert(server.includes("/api/gmail/oauth/callback"));
  assert(gmail.includes("gmail.send"));
  assert(gmail.includes("gmail.googleapis.com/gmail/v1/users/me/messages/send"));
  assert(gmail.includes("GMAIL_REFRESH_TOKEN"));
  assert(!gmail.includes("smtp.gmail.com"));
  assert(!gmail.includes("tls.connect"));
});
test("admin tables expose labeled mobile rows and customer access guidance",()=>{
  assert(admin.includes('data-label="${c[0]}"'));
  assert(style.includes('.tw td::before{content:attr(data-label)'));
  assert(admin.includes('Passwords cannot be viewed'));
});

test("admin order list supports text and status filtering",()=>{
  assert(enh.includes('window._orderQuery'));
  assert(enh.includes('Search orders'));
  assert(enh.includes('searchable.includes(query)'));
});

test("loyalty rewards are earned and redeemed server-side",()=>{
  assert(server.includes('loyalty_redemptions'));
  assert(server.includes('rewardThreshold===5'));
  assert(server.includes('rewardThreshold===8'));
  assert(server.includes('rewardThreshold===10'));
  assert(index.includes('id="loyalty_reward"'));
});

test("customer order chat and driver visibility are explicit",()=>{
  assert(server.includes("['inquiries','order_id','INTEGER']"));
  assert(server.includes("app.get('/api/customer/orders/:id/chat'"));
  assert(server.includes("app.post('/api/customer/orders/:id/chat'"));
  assert(server.includes("app.get('/api/admin/orders/:id/chat'"));
  assert(server.includes("['Delivered','Completed'].includes(order.status)"));
  assert(server.includes("error:'Order chat is closed'"));
  assert(server.includes("driver_name:''"));
  assert(server.includes("driver_phone:''"));
  assert(server.includes("o.status!=='Out for delivery'"));
  assert(server.includes("'/api/orders/:id/received'"));
  assert(account.includes('Chat about this order'));
  assert(account.includes('Driver name:'));
  assert(account.includes('Driver number:'));
  assert(account.includes("status==='Out for delivery'"));
  assert(account.includes("['Delivered','Completed'].includes(status)?'':"));
  assert(account.includes('order-driver'));
  assert(enh.includes('Customer chat'));
  assert(enh.includes('Open chat'));
  assert(enh.includes('Order chats are linked to their order.'));
  assert(enh.includes('openOrderChatAdmin'));
});

test("gallery accepts video embeds and reports paid totals",()=>{
  assert(server.includes("app.post('/api/admin/gallery'"));
  assert(server.includes('youtube-nocookie.com/embed/'));
  assert(index.includes('gallery-embed'));
  assert(server.includes('paidRevenue'));
  assert(enh.includes('Paid revenue'));
});

test("menu item photo controls are explicit",()=>{
  assert(admin.includes('Add or replace menu image'));
  assert(admin.includes("clearImage('item'"));
});

test("customer promo input exists",()=>{
  assert(index.includes('name="promo_code"'));
});

test("admin promo settings exist",()=>{
  assert(admin.includes("promo_code"));
  assert(admin.includes("promo_value"));
});

test("admin approval setting exists",()=>{
  assert(admin.includes("approval_mode"));
});

test("admin social settings exist",()=>{
  assert(admin.includes("facebook"));
  assert(admin.includes("instagram"));
  assert(admin.includes("whatsapp"));
});

test("database migration can create discount field",()=>{
  const db=new Database(":memory:");
  db.exec("CREATE TABLE items(id INTEGER PRIMARY KEY, price REAL)");
  try{db.exec("ALTER TABLE items ADD COLUMN discount_price REAL")}catch{}
  const cols=db.prepare("PRAGMA table_info(items)").all().map(x=>x.name);
  assert(cols.includes("discount_price"));
  db.close();
});


test("customer notification service exists",()=>{
  assert(fs.existsSync(path.join(root,"lib","notifications.js")));
  const notifications=fs.readFileSync(path.join(root,"lib","notifications.js"),"utf8");
  assert(notifications.includes("notifyInquiryReceived"));
  assert(notifications.includes("notifyInquiryReply"));
  assert(notifications.includes("notifyNewsletterWelcome"));
  assert(notifications.includes("sendNewsletterCampaign"));
  assert(notifications.includes("notifyOrderStatus"));
  assert(notifications.includes("notifySubscriptionStatus"));
  assert(notifications.includes("sendPasswordResetEmail"));
});

test("inquiries are manually replied and customer chat is supported",()=>{
  assert(server.includes("notifyAdminInquiry(inquiry)"));
  assert(!server.includes("notifyInquiryReceived(inquiry);"));
  assert(server.includes("app.get('/api/customer/inquiries'"));
  assert(server.includes("app.get('/api/customer/inquiries/:id/messages'"));
  assert(server.includes("app.post('/api/customer/inquiries'"));
  assert(server.includes("app.post('/api/customer/inquiries/:id/messages'"));
  assert(server.includes("notifyAdminCustomerMessage"));
  assert(server.includes("notifyInquiryReply(inquiry,message)"));
  assert(account.includes("Chat with PinoyAmbula"));
  assert(account.includes("No automatic replies"));
  assert(enh.includes("Customer inquiries do not receive automatic replies"));
});

test("newsletter has welcome email, queued broadcast and unsubscribe",()=>{
  assert(server.includes("notifyNewsletterWelcome(e)"));
  assert(server.includes("newsletter_campaigns"));
  assert(server.includes("newsletter_jobs"));
  assert(server.includes("'/api/admin/newsletter/send'"));
  assert(server.includes("'/api/admin/newsletter/campaigns'"));
  assert(server.includes("processNewsletterQueue"));
  assert(server.includes("'/api/newsletter/unsubscribe'"));
  assert(server.includes("sendNewsletterCampaign"));
  assert(enh.includes("Queue broadcast to all subscribers"));
});

test("orders trigger receipt, admin, status, and payment email notifications",()=>{
  assert(server.includes("notifyOrderReceived(savedOrder)"));
  assert(server.includes("notifyAdminOrder(savedOrder)"));
  assert(server.includes("notifyOrderStatus(after,before.status)"));
  assert(server.includes("notifyPaymentStatus(after,before.payment_status)"));
});

test("subscriptions trigger confirmation and status/payment notifications",()=>{
  assert(server.includes("notifySubscriptionReceived(savedSub)"));
  assert(server.includes("notifySubscriptionStatus(after,before.status)"));
  assert(server.includes("notifySubscriptionPaymentStatus(after,before.payment_status)"));
});

test("admin customer reset uses secure email reset instead of temporary passwords",()=>{
  assert(server.includes("sendPasswordResetEmail"));
  assert(server.includes("Password reset email sent."));
  assert(!server.includes("r.json({temporaryPassword})"));
  assert(admin.includes("secure password-reset email"));
});

test("admin inquiry UI reports email delivery",()=>{
  assert(enh.includes("Reply saved and email sent"));
  assert(enh.includes("sendInquiryReply"));
});


test("subscription plans support images",()=>{
  assert(server.includes("['plans','img"));
  assert(server.includes("target==='plan'"));
  assert(server.includes("UPDATE plans SET img"));
  assert(index.includes("p.img"));
  assert(enh.includes("plan-drop"));
});

test("customer phone, WhatsApp, map and hours are configurable",()=>{
  assert(admin.includes("f('phone','Phone')"));
  assert(admin.includes("f('whatsapp','WhatsApp number')"));
  assert(admin.includes("f('map_url','Google Maps URL')"));
  assert(admin.includes('<textarea name="hours"'));
  assert(index.includes("href=\"tel:"));
  assert(index.includes("wa.me"));
  assert(index.includes("google.com/maps/search"));
});

test("web and mobile share one runtime configuration and PWA shell",()=>{
  assert(fs.existsSync(path.join(root,'public','runtime-config.js')));
  assert(fs.existsSync(path.join(root,'public','manifest.json')));
  assert(fs.existsSync(path.join(root,'public','sw.js')));
  assert(fs.existsSync(path.join(root,'public','pwa.js')));
  assert(fs.existsSync(path.join(root,'public','icons','pinoyambula-192.svg')));
  assert(fs.existsSync(path.join(root,'public','icons','pinoyambula-512.svg')));
  assert(app.includes("PINOY_RUNTIME?.apiOrigin"));
  assert(index.includes('manifest.json'));
  assert(account.includes('manifest.json'));
  assert(admin.includes('manifest.json'));
});
test("system check is hidden from public homepage but available to admin",()=>{
  assert(!index.includes('href="check.html"'));
  assert(admin.includes('href="check.html"'));
});

test("admin newsletter UI provides campaign composer and unsubscribe guidance",()=>{
  assert(enh.includes("R.Newsletter=async function()"));
  assert(enh.includes("sendNewsletterCampaign(event)"));
  assert(enh.includes("Every broadcast includes an unsubscribe link"));
});

if(process.exitCode){
  console.error("\\nTEST RESULT: FAIL");
  process.exit(1);
}else{
  console.log("\\nTEST RESULT: PASS");
}
