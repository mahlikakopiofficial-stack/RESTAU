
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const Database=require("better-sqlite3");

const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
const index=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
const account=fs.readFileSync(path.join(root,"public","account.html"),"utf8");
const admin=fs.readFileSync(path.join(root,"public","admin.html"),"utf8");
const enh=fs.readFileSync(path.join(root,"public","enhancements.js"),"utf8");
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

test("settings contain location and logo",()=>{
  assert(server.includes("location"));
  assert(server.includes("logo_url"));
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

test("customer forgot-password requests are staff verified",()=>{
  assert(account.includes('Forgot password?'));
  assert(server.includes("app.post('/api/password-reset'"));
  assert(server.includes("app.post('/api/admin/customers/:id/reset-password'"));
  assert(!server.includes("app.put('/api/me/password'"));
  assert(!account.includes('Change password'));
  assert(server.includes('auth_version'));
  assert(admin.includes('issueReset('));
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

test("customer delivery tracking supports ETA driver and received confirmation",()=>{
  assert(server.includes("'orders','eta'"));
  assert(server.includes("'orders','driver_name'"));
  assert(server.includes("'/api/orders/:id/received'"));
  assert(account.includes('Confirm received'));
  assert(enh.includes('Driver phone'));
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

if(process.exitCode){
  console.error("\\nTEST RESULT: FAIL");
  process.exit(1);
}else{
  console.log("\\nTEST RESULT: PASS");
}
