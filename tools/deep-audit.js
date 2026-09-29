const fs=require("fs");
const path=require("path");
const Database=require("better-sqlite3");

const root=process.cwd();

function read(f){
  try{return fs.readFileSync(path.join(root,f),"utf8")}
  catch{return ""}
}

const server=read("server.js");
const index=read("public/index.html");
const account=read("public/account.html");
const admin=read("public/admin.html");
const app=read("public/app.js");
const enh=read("public/enhancements.js");
const pkg=read("package.json");

console.log("\n============================================================");
console.log(" PinoyAmbula — DEEP CROSS-WIRE AUDIT");
console.log(" READ ONLY — NO FILES MODIFIED");
console.log("============================================================\n");

function check(name,ok,detail=""){
  console.log((ok?"[PASS] ":"[FAIL] ")+name+(detail?" — "+detail:""));
}

function contains(file,text){
  return file.includes(text);
}

/* ============================================================
   1. FILE INVENTORY
   ============================================================ */

console.log("===== 1. FILE INVENTORY =====");

[
 "server.js",
 "package.json",
 "public/index.html",
 "public/account.html",
 "public/admin.html",
 "public/app.js",
 "public/enhancements.js",
 "public/style.css"
].forEach(f=>{
  check(f,fs.existsSync(path.join(root,f)));
});

/* ============================================================
   2. SYNTAX
   ============================================================ */

console.log("\n===== 2. JAVASCRIPT SYNTAX =====");

function syntax(file){
  const {spawnSync}=require("child_process");
  const r=spawnSync(process.execPath,["--check",path.join(root,file)],{
    encoding:"utf8"
  });
  return {
    ok:r.status===0,
    out:(r.stderr||r.stdout||"").trim()
  };
}

for(const f of [
 "server.js",
 "public/app.js",
 "public/enhancements.js"
]){
  const r=syntax(f);
  check(f,r.ok,r.ok?"syntax OK":r.out);
}

/* ============================================================
   3. PUBLIC NAVIGATION
   ============================================================ */

console.log("\n===== 3. PUBLIC NAVIGATION / LINKS =====");

const publicLinks=[...index.matchAll(/(?:href|onclick)\s*=\s*["']([^"']+)["']/gi)]
  .map(x=>x[1]);

console.table(publicLinks.map(x=>({link:x})));

check(
 "Account link",
 /href=["']account\.html["']/i.test(index)
);

check(
 "Admin link on public site",
 /href=["'][^"']*admin(?:\.html)?[^"']*["']/i.test(index)
);

check(
 "Cart trigger",
 /cartT\s*\(/.test(index)
);

check(
 "Order form",
 /<form[^>]+[^>]/i.test(index) && /onsubmit=["']place\(event\)["']/i.test(index)
);

check(
 "Subscription form",
 /subm\s*\(/.test(index) && /api\/subscribe/.test(index)
);

/* ============================================================
   4. CUSTOMER ORDER FORM
   ============================================================ */

console.log("\n===== 4. CUSTOMER ORDER FORM WIRING =====");

const orderFields=[
 "name",
 "phone",
 "address",
 "paci",
 "notes",
 "pay",
 "promo_code"
];

for(const f of orderFields){
  check(
    "Order field: "+f,
    new RegExp(`name=["']${f}["']`,"i").test(index),
    ""
  );
}

check(
 "COD option",
 /name=["']pay["'][^>]*>.*?COD|value=["']COD["']/is.test(index)
);

check(
 "CARD option",
 /value=["']CARD["']/i.test(index)
);

check(
 "Frontend sends order to /api/order",
 /api\(["']\/order["']\s*,\s*["']POST["']/i.test(index)
);

check(
 "Frontend sends selected payment",
 /requestedPay|f\.pay|pay-method|name=["']pay["']/i.test(index+app)
);

check(
 "Frontend sends promo code",
 /promo_code/i.test(index+app)
);

/* ============================================================
   5. CUSTOMER PRICE / DISCOUNT DISPLAY
   ============================================================ */

console.log("\n===== 5. MENU DISCOUNT WIRING =====");

check(
 "Frontend knows discount_price",
 /discount_price/i.test(index+app+enh)
);

check(
 "Frontend displays old/regular price",
 /old|regular_price|discount_price/i.test(index+app+enh)
);

check(
 "Server reads discount_price",
 /discount_price/i.test(server)
);

check(
 "Server calculates discount",
 /promo_code[\s\S]{0,300}discount/i.test(server)
);

check(
 "Server calculates promo type",
 /promo_type/i.test(server)
);

check(
 "Server calculates promo value",
 /promo_value/i.test(server)
);

/* ============================================================
   6. SOCIAL / BRANDING
   ============================================================ */

console.log("\n===== 6. BRANDING / SOCIAL / LOCATION =====");

const brandFields=[
 "logo_url",
 "whatsapp",
 "facebook",
 "instagram",
 "location"
];

for(const f of brandFields){
  check(
    f+" server support",
    server.includes(f)
  );

  check(
    f+" frontend support",
    (index+app+enh).includes(f)
  );

  check(
    f+" admin support",
    admin.includes(f)
  );
}

check(
 "Footer exists",
 /<footer/i.test(index)
);

check(
 "Social links container exists",
 /id=["']social-links["']/i.test(index)
);

check(
 "Location container exists",
 /location|address/i.test(index)
);

/* ============================================================
   7. PAYMENT UI
   ============================================================ */

console.log("\n===== 7. PAYMENT UI =====");

check(
 "Payment selector exists",
 /id=["']pay-method["']/i.test(index)
);

check(
 "Payment selector has COD",
 /value=["']COD["']/i.test(index)
);

check(
 "Payment selector has CARD",
 /value=["']CARD["']/i.test(index)
);

check(
 "Config controls payment",
 /payment_cod|payment_card/i.test(app+index)
);

check(
 "Server validates payment",
 /requestedPay/i.test(server)
);

check(
 "Server stores payment",
 /pay[,)]|payment_status/i.test(server)
);

/* ============================================================
   8. ADMIN LINK / ADMIN AUTH
   ============================================================ */

console.log("\n===== 8. ADMIN ACCESS / AUTH WIRING =====");

check(
 "Admin page exists",
 fs.existsSync(path.join(root,"public/admin.html"))
);

check(
 "Admin login endpoint",
 /\/api\/admin\/login/.test(server)
);

check(
 "Admin login frontend",
 /api\(["']\/admin\/login["']/i.test(admin)
);

check(
 "Admin token stored",
 /localStorage\.setItem\(K/i.test(admin)
);

check(
 "Admin API uses admin token",
 /api\('\/admin|api\("\/admin|A=\(/.test(admin)
);

check(
 "Admin back-to-site link",
 /href=["']index\.html["']/i.test(admin)
);

/* ============================================================
   9. ADMIN SETTINGS
   ============================================================ */

console.log("\n===== 9. ADMIN SETTINGS WIRING =====");

const settingsFields=[
 "name",
 "phone",
 "hours",
 "currency",
 "fee",
 "min_order",
 "accepting",
 "logo_url",
 "whatsapp",
 "facebook",
 "instagram",
 "location",
 "approval_mode",
 "payment_cod",
 "payment_card",
 "promo_enabled",
 "promo_code",
 "promo_type",
 "promo_value"
];

for(const f of settingsFields){
  const s=admin.includes(f);
  const b=server.includes(f);
  check(
    "Setting "+f,
    s && b,
    `admin=${s} server=${b}`
  );
}

check(
 "Admin settings GET",
 /\/api\/admin\/settings/.test(server)
);

check(
 "Admin settings PUT",
 /app\.put\(['"]\/api\/admin\/settings/.test(server)
);

/* ============================================================
   10. ORDER APPROVAL WORKFLOW
   ============================================================ */

console.log("\n===== 10. ORDER APPROVAL WORKFLOW =====");

check(
 "approval_mode exists",
 /approval_mode/.test(server+admin+index)
);

check(
 "AUTO mode exists",
 /AUTO/.test(server+admin)
);

check(
 "ADMIN mode exists",
 /ADMIN/.test(server+admin)
);

check(
 "Pending status exists",
 /Pending/.test(server+admin+account)
);

check(
 "Confirmed status exists",
 /Confirmed/.test(server+admin+account)
);

check(
 "Admin order status API",
 /\/api\/admin\/status\/:t\/:id/.test(server)
);

/* ============================================================
   11. CUSTOMER CANCELLATION
   ============================================================ */

console.log("\n===== 11. CUSTOMER CANCELLATION =====");

check(
 "Server customer cancellation removed",
 !/\/api\/orders\/:id\/cancel/.test(server)
);

check(
 "Account cancellation UI removed",
 !/Cancel this order|\/orders\/.*\/cancel/.test(account)
);

/* ============================================================
   12. CUSTOMER TRACKER
   ============================================================ */

console.log("\n===== 12. CUSTOMER ORDER TRACKER =====");

check(
 "Tracker container",
 /order-tracker/.test(account)
);

check(
 "orderStep marker",
 /orderStep/.test(account)
);

check(
 "Pending tracker step",
 /Pending/.test(account)
);

check(
 "Confirmed tracker step",
 /Confirmed/.test(account)
);

check(
 "Preparing tracker step",
 /Preparing/.test(account)
);

check(
 "Out for delivery tracker step",
 /Out for delivery/.test(account)
);

check(
 "Delivered tracker step",
 /Delivered/.test(account)
);

console.log("\n===== 12A. PROFILE / LOYALTY / DELIVERY UPDATES =====");
check("Registration stores birthday and nationality",/customers','birthday'/.test(server)&&/customers','nationality'/.test(server));
check("Checkout autofills saved customer profile",/api\('\/me'\)\.then\(m=>/.test(index));
check("Forgot password uses verified staff reset flow",/Forgot password\?/.test(account)&&/api\/password-reset/.test(server)&&/api\/admin\/customers\/:id\/reset-password/.test(server));
check("Loyalty thresholds are server-validated",/rewardThreshold===5/.test(server)&&/rewardThreshold===8/.test(server)&&/rewardThreshold===10/.test(server));
check("Customer can confirm delivery receipt",/\/api\/orders\/:id\/received/.test(server)&&/Confirm received/.test(account));
check("Admin can set ETA and driver contact",/driver_name/.test(server)&&/driver_phone/.test(server)&&/datetime-local/.test(enh));
check("Customer sees admin delivery message",/status_message/.test(server)&&/status_message/.test(account));
check("Customer account hides order numbers",!/<th>#<\/th><th>Date<\/th><th>Items/.test(account));

/* ============================================================
   13. SUBSCRIPTIONS
   ============================================================ */

console.log("\n===== 13. SUBSCRIPTIONS =====");

check(
 "Plans API",
 /\/api\/plans/.test(server)
);

check(
 "Subscribe API",
 /\/api\/subscribe/.test(server)
);

check(
 "Plan list UI",
 /plan-list/.test(index)
);

check(
 "Subscription modal",
 /id=["']subd["']/i.test(index)
);

check(
 "Subscribe button logic",
 /subOpen\s*\(/.test(index)
);

check(
 "Admin Plans tab",
 /Plans/.test(admin)
);

check(
 "Admin can edit plan inclusions",
 /includes/.test(admin+server)
);

/* ============================================================
   14. GALLERY / REVIEWS
   ============================================================ */

console.log("\n===== 14. GALLERY / REVIEWS =====");

check("Gallery API",/\/api\/gallery/.test(server));
check("Gallery UI",/id=["']gal["']/i.test(index));
check("Gallery admin",/Gallery/.test(admin));
check("Gallery supports validated social video embeds",/galleryEmbed/.test(server)&&/youtube-nocookie\.com\/embed/.test(server)&&/gallery-embed/.test(index));
check("Report separates paid orders and revenue",/paidOrders/.test(server)&&/paidRevenue/.test(server)&&/Paid revenue/.test(enh));
check("Menu item image controls are labeled",/Add or replace menu image/.test(admin)&&/Remove menu image/.test(admin));

check("Testimonials API",/\/api\/testimonials/.test(server));
check("Reviews UI",/id=["']rev["']/i.test(index));
check("Testimonials admin",/Testimonials/.test(admin));

/* ============================================================
   15. NEWSLETTER / CONTACT
   ============================================================ */

console.log("\n===== 15. CONTACT / NEWSLETTER =====");

check("Newsletter API",/\/api\/newsletter/.test(server));
check("Newsletter UI",/newsletter|nl\(/i.test(index));

check("Inquiry API",/\/api\/inquiry/.test(server));
check("Contact section",/id=["']contact["']/i.test(index));

/* ============================================================
   16. SERVER STATIC FILE ROUTING
   ============================================================ */

console.log("\n===== 16. STATIC / PAGE ROUTING =====");

check(
 "index static serving",
 /express\.static/.test(server)
);

check(
 "admin.html route",
 /\/admin/.test(server)
);

check(
 "account.html route",
 /\['admin','account','check'\]/.test(server) && /express\.static/.test(server)
);

/* ============================================================
   17. DATABASE
   ============================================================ */

console.log("\n===== 17. DATABASE SCHEMA =====");

try{
  const db=new Database(path.join(root,"data","resto.db"));

  const tables=db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `).all().map(x=>x.name);

  console.log("Tables:");
  console.log(tables.join(", "));

  const requiredTables=[
    "items",
    "customers",
    "orders",
    "subs",
    "plans",
    "settings",
    "gallery",
    "testimonials",
    "newsletter",
    "inquiries"
  ];

  for(const t of requiredTables){
    check("DB table "+t,tables.includes(t));
  }

  const schemas={};

  for(const t of ["items","orders","settings","plans"]){
    if(tables.includes(t)){
      schemas[t]=db.prepare(`PRAGMA table_info("${t}")`).all().map(x=>x.name);
      console.log("\n"+t+": "+schemas[t].join(", "));
    }
  }

  for(const f of ["discount_price"]){
    check(
      "items."+f,
      schemas.items?.includes(f)
    );
  }

  for(const f of [
    "subtotal",
    "discount",
    "promo_code",
    "payment_status",
    "confirmed_at",
    "delivered_at",
    "cancelled_at"
  ]){
    check(
      "orders."+f,
      schemas.orders?.includes(f)
    );
  }

  db.close();
}catch(e){
  console.log("[FAIL] Database audit: "+e.message);
}

/* ============================================================
   18. PACKAGE
   ============================================================ */

console.log("\n===== 18. PACKAGE =====");

try{
  const p=JSON.parse(pkg);

  check("npm test script",p.scripts?.test==="node tests/run-tests.js");
  check("npm check script",!!p.scripts?.check);
  check("npm start script",p.scripts?.start==="node server.js");
  check("Express dependency",!!p.dependencies?.express);
  check("SQLite dependency",!!p.dependencies?.["better-sqlite3"]);
  check("Multer dependency",!!p.dependencies?.multer);
}catch(e){
  check("package.json parse",false,e.message);
}

/* ============================================================
   19. BROKEN / STALE REFERENCES
   ============================================================ */

console.log("\n===== 19. POTENTIAL STALE / BROKEN REFERENCES =====");

const combined=index+"\n"+account+"\n"+admin+"\n"+app+"\n"+enh;

const suspicious=[
 ["old cancellation function",/function\s+cx\s*\(/],
 ["old cancellation endpoint",/orders\/.*\/cancel/],
 ["hardcoded COD success text",/pay cash on delivery/i],
 ["demo order wording",/demo order/i],
 ["demo data wording",/demo/i],
 ["localhost references",/localhost:\d+/i],
 ["127.0.0.1 references",/127\.0\.0\.1:\d+/i]
];

for(const [name,re] of suspicious){
  check(name,!re.test(combined));
}

/* ============================================================
   20. FINAL ROUTE MAP
   ============================================================ */

console.log("\n===== 20. SERVER ROUTE MAP =====");

const routes=server.match(/app\.(?:get|post|put|patch|delete)\(['"][^'"]+/g)||[];

routes.forEach(x=>console.log(x));

console.log("\n============================================================");
console.log(" DEEP CROSS-WIRE AUDIT COMPLETE");
console.log("============================================================\n");
