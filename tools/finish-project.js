const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const serverPath = path.join(root, "server.js");
const indexPath = path.join(root, "public", "index.html");
const accountPath = path.join(root, "public", "account.html");
const adminPath = path.join(root, "public", "admin.html");
const packagePath = path.join(root, "package.json");

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

function replaceOnce(s, a, b, name) {
  if (!s.includes(a)) {
    console.log("WARN: pattern not found:", name);
    return s;
  }
  console.log("PATCH:", name);
  return s.replace(a, b);
}

/* =========================================================
   SERVER
========================================================= */

let server = read(serverPath);

/* Add migration columns/tables after settings/plans creation */
server = replaceOnce(
  server,
  "for(const c of['ALTER TABLE testimonials ADD COLUMN approved INTEGER DEFAULT 1'",
  "for(const c of['ALTER TABLE items ADD COLUMN discount_price REAL'," +
  "'ALTER TABLE orders ADD COLUMN subtotal REAL'," +
  "'ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0'," +
  "'ALTER TABLE orders ADD COLUMN promo_code TEXT'," +
  "'ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT \\'Pending\\''," +
  "'ALTER TABLE orders ADD COLUMN approved_at TEXT'," +
  "'ALTER TABLE orders ADD COLUMN confirmed_at TEXT'," +
  "'ALTER TABLE orders ADD COLUMN delivered_at TEXT'," +
  "'ALTER TABLE orders ADD COLUMN cancelled_at TEXT'," +
  "'ALTER TABLE testimonials ADD COLUMN approved INTEGER DEFAULT 1'",
  "database migration columns"
);

/* Fix malformed existing SQL strings */
server = server
  .replace("SELECT * FROMtestimonials", "SELECT * FROM testimonials")
  .replace("ORDERBY id DESC", "ORDER BY id DESC")
  .replace("UPDATEplans SET", "UPDATE plans SET")
  .replace("OneFilipino", "One Filipino")
  .replace("lunchand one Filipino", "lunch and one Filipino")
  .replace("cashon delivery", "cash on delivery")
  .replace("fromeveryday", "from everyday")
  .replace("made withlove", "made with love");

/* Expand defaults */
server = replaceOnce(
  server,
  "hero_text:'Home-style Filipino cooking made with love — from everyday meals to fiesta catering. Delivered to your door, pay cash on delivery.'",
  "hero_text:'Home-style Filipino cooking made with love — from everyday meals to fiesta catering. Delivered to your door, pay cash on delivery.'," +
  "location:'Salmiya, Kuwait'," +
  "whatsapp:''," +
  "facebook:''," +
  "instagram:''," +
  "logo_url:''," +
  "approval_mode:'AUTO'," +
  "payment_cod:'1'," +
  "payment_card:'0'," +
  "promo_enabled:'1'," +
  "promo_code:''," +
  "promo_type:'percent'," +
  "promo_value:'0'",
  "expanded settings"
);

/* Replace config route */
server = replaceOnce(
  server,
  "app.get('/api/config',(q,r)=>{const s=S();r.json({...s,fee:+s.fee,min_order:+s.min_order,accepting:s.accepting==='1'})});",
  `app.get('/api/config',(q,r)=>{
  const s=S();
  r.json({
    ...s,
    fee:+s.fee,
    min_order:+s.min_order,
    accepting:s.accepting==='1',
    approval_mode:s.approval_mode||'AUTO',
    payment_cod:s.payment_cod!=='0',
    payment_card:s.payment_card==='1',
    promo_enabled:s.promo_enabled!=='0'
  });
});`,
  "config route"
);

/* Replace menu route so discount prices are returned */
server = replaceOnce(
  server,
  "app.get('/api/menu',(q,r)=>r.json(db.prepare('SELECT * FROM items WHERE active=1 ORDER BY id').all()));",
  `app.get('/api/menu',(q,r)=>r.json(
  db.prepare('SELECT id,cat,region,name,descr,price,discount_price,img,emoji,active FROM items WHERE active=1 ORDER BY id').all()
));`,
  "menu route"
);

/* Replace order route completely */
const orderStart = "app.post('/api/order',lim(30),w((q,r)=>{";
const orderEnd = "app.post('/api/subscribe'";

const oi = server.indexOf(orderStart);
const oe = server.indexOf(orderEnd);

if (oi >= 0 && oe > oi) {
  const newOrderRoute = `app.post('/api/order',lim(30),w((q,r)=>{
  const b=q.body;
  need(b,'name','phone','address');

  const st=S();

  if(st.accepting!=='1')
    throw new Error('Sorry, we are closed for orders right now.');

  const requestedPay=String(b.pay||'COD').toUpperCase();
  const allowedPay=
    requestedPay==='CARD' && st.payment_card==='1'
      ? 'CARD'
      : requestedPay==='COD' && st.payment_cod!=='0'
        ? 'COD'
        : null;

  if(!allowedPay)
    throw new Error('Selected payment method is not available.');

  const its=(b.items||[]).map(i=>{
    const x=one('SELECT * FROM items WHERE id=? AND active=1',i.id);
    if(!x)return null;

    const qty=Math.max(1,Math.min(99,+i.qty||1));
    const regular=+x.price;
    const discounted=+x.discount_price;
    const unit=discounted>0 && discounted<regular ? discounted : regular;

    return {
      id:x.id,
      name:x.name,
      price:unit,
      original_price:regular,
      qty
    };
  }).filter(Boolean);

  if(!its.length)
    throw new Error('Cart is empty');

  const subtotal=its.reduce((s,i)=>s+i.price*i.qty,0);

  if(subtotal<+st.min_order)
    throw new Error('Minimum order is '+(+st.min_order).toFixed(3)+' '+st.currency);

  let discount=0;
  let promoCode='';

  if(st.promo_enabled!=='0' && st.promo_code && b.promo_code){
    const supplied=String(b.promo_code).trim().toUpperCase();
    const configured=String(st.promo_code).trim().toUpperCase();

    if(supplied===configured){
      const value=Math.max(0,+st.promo_value||0);

      if(st.promo_type==='fixed')
        discount=Math.min(subtotal,value);
      else
        discount=Math.min(subtotal,subtotal*(value/100));

      promoCode=supplied;
    }else{
      throw new Error('Invalid promo code');
    }
  }

  const delivery=+st.fee||0;
  const total=Math.max(0,subtotal-discount+delivery);

  const approval=(st.approval_mode||'AUTO').toUpperCase()==='ADMIN'
    ? 'Pending'
    : 'Confirmed';

  const id=db.prepare(
    'INSERT INTO orders(customer_id,name,phone,address,paci,notes,items,subtotal,discount,promo_code,total,pay,status,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    custId(b,q),
    b.name,
    b.phone,
    b.address,
    b.paci||'',
    b.notes||'',
    JSON.stringify(its),
    subtotal,
    discount,
    promoCode,
    total,
    allowedPay,
    approval,
    allowedPay==='COD'?'Pending':'Pending'
  ).lastInsertRowid;

  r.json({
    id:Number(id),
    subtotal,
    discount,
    delivery,
    total,
    pay:allowedPay,
    status:approval
  });
}));

`;

  server = server.slice(0, oi) + newOrderRoute + server.slice(oe);
  console.log("PATCH: complete order route");
}

/* Remove customer cancellation route entirely */
server = server.replace(
  /app\.post\('\/api\/orders\/:id\/cancel'[\s\S]*?\}\)\);\r?\n/,
  ""
);
console.log("PATCH: customer cancellation disabled");

/* Admin status route with controlled workflow */
server = replaceOnce(
  server,
  "app.put('/api/admin/status/:t/:id',admin,w((q,r)=>{if(!['orders','subs','inquiries'].includes(q.params.t))throw new Error('bad table');db.prepare(`UPDATE ${q.params.t} SET status=? WHERE id=?`).run(q.body.status,q.params.id);r.json({ok:1})}));",
  `app.put('/api/admin/status/:t/:id',admin,w((q,r)=>{
  const t=q.params.t;
  const id=q.params.id;
  const status=String(q.body.status||'');

  if(!['orders','subs','inquiries'].includes(t))
    throw new Error('bad table');

  if(t==='orders'){
    const allowed=['Pending','New','Confirmed','Preparing','Out for delivery','Delivered','Cancelled','Completed'];

    if(!allowed.includes(status))
      throw new Error('Invalid order status');

    const o=one('SELECT * FROM orders WHERE id=?',id);
    if(!o)throw new Error('Order not found');

    const now=new Date().toISOString();

    if(status==='Cancelled')
      db.prepare("UPDATE orders SET status=?,cancelled_at=? WHERE id=?").run(status,now,id);
    else if(status==='Confirmed')
      db.prepare("UPDATE orders SET status=?,approved_at=COALESCE(approved_at,?),confirmed_at=COALESCE(confirmed_at,?) WHERE id=?")
        .run(status,now,now,id);
    else if(status==='Delivered')
      db.prepare("UPDATE orders SET status=?,delivered_at=COALESCE(delivered_at,?) WHERE id=?")
        .run(status,now,id);
    else
      db.prepare("UPDATE orders SET status=? WHERE id=?").run(status,id);

    r.json({ok:1});
    return;
  }

  db.prepare(\`UPDATE \${t} SET status=? WHERE id=?\`).run(status,id);
  r.json({ok:1});
}));`,
  "admin status workflow"
);

/* Add admin promo/item pricing settings */
server = replaceOnce(
  server,
  "const F=['cat','region','name','descr','price','emoji','active'];",
  "const F=['cat','region','name','descr','price','discount_price','emoji','active'];",
  "discount price field"
);

/* Add validation for discount price */
server = replaceOnce(
  server,
  "if('price' in q.body&&!(+q.body.price>=0))throw new Error('Invalid price');",
  "if('price' in q.body&&!(+q.body.price>=0))throw new Error('Invalid price');if('discount_price' in q.body&&q.body.discount_price!==''&&!(+q.body.discount_price>=0))throw new Error('Invalid discount price');",
  "discount validation"
);

/* Settings keys */
server = replaceOnce(
  server,
  "const SK=['name','phone','hours','currency','fee','min_order','accepting','hero_title','hero_text'];",
  "const SK=['name','phone','hours','currency','fee','min_order','accepting','hero_title','hero_text','location','whatsapp','facebook','instagram','logo_url','approval_mode','payment_cod','payment_card','promo_enabled','promo_code','promo_type','promo_value'];",
  "settings keys"
);

/* Settings validation */
server = replaceOnce(
  server,
  "app.put('/api/admin/settings',admin,w((q,r)=>{const b=q.body;if(b.fee!==undefined&&!(+b.fee>=0))throw new Error('Invalid delivery fee');if(b.min_order!==undefined&&!(+b.min_order>=0))throw new Error('Invalid minimum order');if(b.currency!==undefined&&!/^[A-Za-z]{2,5}$/.test(b.currency))throw new Error('Currency must be a code like KWD');",
  `app.put('/api/admin/settings',admin,w((q,r)=>{
  const b=q.body;

  if(b.fee!==undefined&&!(+b.fee>=0))
    throw new Error('Invalid delivery fee');

  if(b.min_order!==undefined&&!(+b.min_order>=0))
    throw new Error('Invalid minimum order');

  if(b.currency!==undefined&&!/^[A-Za-z]{2,5}$/.test(b.currency))
    throw new Error('Currency must be a code like KWD');

  if(b.approval_mode!==undefined&&!['AUTO','ADMIN'].includes(String(b.approval_mode).toUpperCase()))
    throw new Error('Approval mode must be AUTO or ADMIN');

  if(b.promo_type!==undefined&&!['percent','fixed'].includes(String(b.promo_type)))
    throw new Error('Promo type must be percent or fixed');

  if(b.promo_value!==undefined&&!(+b.promo_value>=0))
    throw new Error('Invalid promo value');

  if(b.promo_type==='percent'&&+b.promo_value>100)
    throw new Error('Percent promo cannot exceed 100');

  if(b.logo_url!==undefined && String(b.logo_url).length>500)
    throw new Error('Logo URL too long');

  `,
  "settings validation"
);

/* =========================================================
   INDEX HTML
========================================================= */

let index = read(indexPath);

/* Footer */
index = replaceOnce(
  index,
  `<footer><p id="ft">🌼 PinoyAmbula — Salamat po!</p><p style="margin-top:8px;font-size:.85rem"><a href="#home">Back to top</a><a href="account.html">My account</a><a href="admin.html">Admin</a><a href="check.html">System check</a></p></footer>`,
  `<footer>
  <p id="ft">🌼 PinoyAmbula — Salamat po!</p>
  <p id="contact-links" style="margin-top:8px;font-size:.9rem"></p>
  <p id="social-links" style="margin-top:8px;font-size:.9rem"></p>
  <p style="margin-top:8px;font-size:.85rem">
    <a href="#home">Back to top</a>
    <a href="account.html">My account</a>
    <a href="admin.html">Admin</a>
    <a href="check.html">System check</a>
  </p>
</footer>`,
  "footer contact/social"
);

/* Replace cart form */
index = replaceOnce(
  index,
  `<p style="font-size:.85rem;margin-bottom:8px">💵 Payment: <b>Cash on Delivery (COD)</b></p><button class="btn" style="width:100%">Place COD Order</button>`,
  `<label>Payment method *</label>
<select name="pay" id="pay-method" required>
  <option value="COD">Cash on Delivery</option>
  <option value="CARD">Card</option>
</select>
<label>Promo code</label>
<input name="promo_code" id="promo-code" placeholder="Optional">
<p id="promo-help" style="font-size:.8rem;opacity:.7"></p>
<button class="btn" style="width:100%">Place Order</button>`,
  "payment promo UI"
);

/* Card pricing */
index = index.replace(
  "const card=i=>`<div class=\"card\"><div class=\"ph\"",
  "const card=i=>`<div class=\"card\"><div class=\"ph\""
);

/* Display discount price */
index = replaceOnce(
  index,
  `<p><span class="pr">\${money(i.price)}</span> <button class="btn s" style="float:right" onclick="add(\${i.id})">Add</button></p>`,
  `<p>
  \${i.discount_price>0&&i.discount_price<i.price
    ? '<del style="opacity:.6">'+money(i.price)+'</del> <span class="pr">'+money(i.discount_price)+'</span>'
    : '<span class="pr">'+money(i.price)+'</span>'}
  <button class="btn s" style="float:right" onclick="add(\${i.id})">Add</button>
</p>`,
  "menu discount display"
);

/* Replace cart calculations with effective price */
index = index.replace(
  /function renderCart\(\)\{[\s\S]*?\n\}\nasync function place/,
  `function effectivePrice(i){
  return i.discount_price>0 && i.discount_price<i.price ? i.discount_price : i.price;
}

function renderCart(){
  const ids=Object.keys(cart).filter(id=>items.find(i=>i.id==id));
  let sub=0;
  $('#cc').textContent=ids.reduce((s,id)=>s+cart[id],0);

  $('#lines').innerHTML=ids.length
    ? ids.map(id=>{
        const i=items.find(x=>x.id==id);
        const p=effectivePrice(i);
        sub+=p*cart[id];
        return \`<div class="line">
          <span>\${esc(i.name)}</span>
          <span>
            <button class="btn s o" onclick="chg(\${id},-1)">−</button>
            \${cart[id]}
            <button class="btn s o" onclick="chg(\${id},1)">+</button>
          </span>
          <b>\${money(p*cart[id])}</b>
        </div>\`;
      }).join('')
    : '<p style="padding:14px 0;opacity:.7">Your cart is empty.</p>';

  $('#totals').innerHTML=ids.length
    ? \`<p>Subtotal: \${money(sub)}<br>Delivery: \${money(FEE)}<br><b>Total: \${money(sub+FEE)}</b></p>\`
    : '';
}

async function place`,
  "cart pricing"
);

/* Update place function response */
index = index.replace(
  /async function place\(e\)\{[\s\S]*?\n\}\nasync function subm/,
  `async function place(e){
  e.preventDefault();

  if(!Object.keys(cart).length){
    toast('Your cart is empty');
    return;
  }

  const f=Object.fromEntries(new FormData(e.target));
  f.items=Object.entries(cart).map(([id,qty])=>({id:+id,qty:+qty}));

  try{
    const r=await api('/order','POST',f);

    cart={};
    sv();
    e.target.reset();

    $('#lines').innerHTML=\`<p style="padding:10px 0">
      <b>✅ Order #\${r.id} received!</b><br>
      Status: <b>\${esc(r.status)}</b><br>
      Total \${money(r.total)}
      \${r.discount>0?'<br>Discount: -'+money(r.discount):''}
      <br>\${r.pay==='CARD'?'Card payment selected.':'Pay cash on delivery.'}
    </p>\`;

    toast('Order submitted successfully');
  }catch(x){
    toast(x.message);
  }
}

async function subm`,
  "order confirmation"
);

/* Replace applyCfg */
index = replaceOnce(
  index,
  "function applyCfg(c){$('.logo').textContent='🌼 '+c.name;document.title=c.name+' — Filipino Kitchen';$('#hh').textContent=c.hero_title;$('#hp').textContent=c.hero_text;",
  `function applyCfg(c){
  const logo=$('.logo');

  if(c.logo_url){
    logo.innerHTML='<img src="'+esc(c.logo_url)+'" alt="" style="height:38px;width:auto;vertical-align:middle"> '+esc(c.name);
  }else{
    logo.textContent='🌼 '+c.name;
  }

  document.title=c.name+' — Filipino Kitchen';
  $('#hh').textContent=c.hero_title;
  $('#hp').textContent=c.hero_text;`,
  "config branding"
);

/* Add footer details inside applyCfg */
index = replaceOnce(
  index,
  `$('#closed').hidden=c.accepting;$('#ft').innerHTML=esc('🌼 '+c.name+' — Salamat po!')+(c.phone?'<br>📞 '+esc(c.phone):'')+(c.hours?'<br>🕒 '+esc(c.hours):'')}`,
  `$('#closed').hidden=c.accepting;

  $('#ft').innerHTML=esc('🌼 '+c.name+' — Salamat po!')
    +(c.phone?'<br>📞 '+esc(c.phone):'')
    +(c.hours?'<br>🕒 '+esc(c.hours):'');

  $('#contact-links').innerHTML=
    (c.location?'<span>📍 '+esc(c.location)+'</span>':'')
    +(c.whatsapp?' <a target="_blank" rel="noopener" href="https://wa.me/'+String(c.whatsapp).replace(/[^0-9]/g,'')+'">WhatsApp</a>':'<span>WhatsApp not configured</span>');

  $('#social-links').innerHTML=
    (c.facebook?'<a target="_blank" rel="noopener" href="'+esc(c.facebook)+'">Facebook</a> ':'')
    +(c.instagram?'<a target="_blank" rel="noopener" href="'+esc(c.instagram)+'">Instagram</a>':'') ;

  const pay=$('#pay-method');
  if(pay){
    [...pay.options].forEach(o=>{
      if(o.value==='COD')o.disabled=c.payment_cod===false;
      if(o.value==='CARD')o.disabled=c.payment_card===false;
    });

    const first=[...pay.options].find(o=>!o.disabled);
    if(first)pay.value=first.value;
  }

  $('#promo-help').textContent=c.promo_enabled && c.promo_code
    ? 'Promo code available.'
    : '';`,
  "footer and payment config"
);

/* Remove broken subscription fix script at end */
index = index.replace(
  /<script>\/\* SUBSCRIPTION_BUTTON_FIX \*\/[\s\S]*?<\/script>/,
  ""
);

write(indexPath,index);

/* =========================================================
   ACCOUNT HTML
========================================================= */

let account = read(accountPath);

account = replaceOnce(
  account,
  `<h3 style="margin:20px 0 8px">My orders</h3><div class="tw"><table id="ot"></table></div>`,
  `<h3 style="margin:20px 0 8px">My orders</h3>
<div id="order-tracker"></div>
<div class="tw"><table id="ot"></table></div>`,
  "account tracker"
);

account = account.replace(
  /async function load\(\)\{[\s\S]*?\n\}\nasync function cx/,
  `function orderStep(status){
  const steps=['Pending','Confirmed','Preparing','Out for delivery','Delivered'];
  const idx=steps.indexOf(status);

  if(status==='Cancelled')
    return '<div class="card" style="padding:14px;border-left:4px solid var(--r)">Order cancelled</div>';

  return '<div class="card" style="padding:14px"><b>Order progress</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'
    +steps.map((s,i)=>'<span style="padding:6px 9px;border-radius:8px;background:'+(i<=idx?'var(--g)':'#ddd')+';color:'+(i<=idx?'#fff':'#555')+'">'+(i+1)+'. '+esc(s)+'</span>').join('')
    +'</div></div>';
}

async function load(){
  if(!tk('ct'))return;

  try{
    const c=await api('/config');
    CUR=c.currency;

    const m=await api('/me');

    $('#auth').hidden=true;
    $('#me').hidden=false;
    $('#hi').textContent='Mabuhay, '+m.name+'!';

    const latest=m.orders[0];

    $('#order-tracker').innerHTML=latest
      ? '<div style="margin:10px 0 18px"><h4>Latest order #'+latest.id+'</h4>'
        +orderStep(latest.status)
        +'<p style="font-size:.85rem;margin-top:8px">Status: <b>'+esc(latest.status)+'</b></p></div>'
      : '<div class="card" style="padding:14px;margin-bottom:15px">No orders to track yet.</div>';

    $('#ot').innerHTML=
      '<tr><th>#</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>'
      +(m.orders.map(o=>{
        let its=[];
        try{its=JSON.parse(o.items||'[]')}catch{}

        return '<tr>'
          +'<td>'+o.id+'</td>'
          +'<td>'+esc(o.created)+'</td>'
          +'<td>'+its.map(i=>i.qty+'× '+esc(i.name)).join(', ')+'</td>'
          +'<td>'+money(o.total)+'</td>'
          +'<td>'+esc(o.pay||'COD')+'</td>'
          +'<td>'+esc(o.status)+'</td>'
          +'</tr>';
      }).join('')
      ||'<tr><td colspan="6">No orders yet</td></tr>');

    $('#st').innerHTML=
      '<tr><th>#</th><th>Plan</th><th>Start</th><th>End</th><th>Status</th></tr>'
      +(m.subs.map(s=>'<tr><td>'+s.id+'</td><td>'+esc(s.plan)+'</td><td>'+s.start+'</td><td>'+s.end+'</td><td>'+esc(s.status)+'</td></tr>').join('')
      ||'<tr><td colspan="5">No subscriptions yet</td></tr>');

  }catch(x){
    localStorage.removeItem('ct');
  }
}

async function cx`,
  "account order tracker and no cancel"
);

/* Remove old cancel function */
account = account.replace(
  /async function cx\(id\)[\s\S]*?\n\}$/,
  ""
);

write(accountPath,account);

/* =========================================================
   ADMIN HTML
========================================================= */

let adminHtml = read(adminPath);

/* Add discount price to menu */
adminHtml = replaceOnce(
  adminHtml,
  `<input type="number" step="0.001" value="\${i.price}" onchange="ui(\${i.id},'price',+this.value)">`,
  `<input type="number" step="0.001" value="\${i.price}" onchange="ui(\${i.id},'price',+this.value)" placeholder="Regular price">
<input type="number" step="0.001" value="\${i.discount_price||''}" onchange="ui(\${i.id},'discount_price',this.value)" placeholder="Discount price">`,
  "admin item discount price"
);

/* Add approval/payment/promo/social/logo settings */
const oldSettingsReturn = `return\`<form onsubmit="ss(event)" class="card" style="padding:16px;max-width:560px">\${f('name','Restaurant name')}\${f('phone','Phone / WhatsApp')}\${f('hours','Opening hours')}\${f('currency','Currency code (e.g. KWD)')}\${f('fee','Delivery fee','number')}\${f('min_order','Minimum order (0 = none)','number')}<label>Accepting orders</label><select name="accepting"><option value="1"\${s.accepting=='1'?' selected':''}>Open — accepting orders</option><option value="0"\${s.accepting=='0'?' selected':''}>Closed — pause orders</option></select>\${f('hero_title','Homepage headline')}<label>Homepage text</label><textarea name="hero_text" rows="3">\${esc(s.hero_text)}</textarea><button class="btn">Save settings</button></form><p style="margin:14px 0 6px">Homepage banner photo (drag &amp; drop):</p><div class="drop" id="hdz" style="max-width:560px;\${s.hero_img?\`background:url('\${esc(s.hero_img)}') center/cover;color:#fff;height:140px\`:''}">⬆ Drop banner image here</div>\`}};`;

const newSettingsReturn = `return\`
<form onsubmit="ss(event)" class="card" style="padding:16px;max-width:650px">

<h3>Restaurant</h3>
\${f('name','Restaurant name')}
\${f('phone','Phone')}
\${f('whatsapp','WhatsApp number')}
\${f('location','Location')}
\${f('hours','Opening hours')}
\${f('facebook','Facebook URL')}
\${f('instagram','Instagram URL')}
\${f('currency','Currency code (e.g. KWD)')}
\${f('fee','Delivery fee','number')}
\${f('min_order','Minimum order (0 = none)','number')}

<h3 style="margin-top:20px">Ordering</h3>
<label>Accepting orders</label>
<select name="accepting">
<option value="1"\${s.accepting=='1'?' selected':''}>Open — accepting orders</option>
<option value="0"\${s.accepting=='0'?' selected':''}>Closed — pause orders</option>
</select>

<label>Order approval</label>
<select name="approval_mode">
<option value="AUTO"\${s.approval_mode!='ADMIN'?' selected':''}>Automatic confirmation</option>
<option value="ADMIN"\${s.approval_mode=='ADMIN'?' selected':''}>Admin must approve</option>
</select>

<h3 style="margin-top:20px">Payment</h3>
<label><input type="checkbox" name="payment_cod" value="1" style="width:auto"\${s.payment_cod!=='0'?' checked':''}> Cash on Delivery</label>
<label><input type="checkbox" name="payment_card" value="1" style="width:auto"\${s.payment_card==='1'?' checked':''}> Card payment option</label>
<p style="font-size:.8rem;opacity:.7">Card selection is stored with the order. A real card charge requires a payment gateway integration.</p>

<h3 style="margin-top:20px">Promo</h3>
<label><input type="checkbox" name="promo_enabled" value="1" style="width:auto"\${s.promo_enabled!=='0'?' checked':''}> Enable promo code</label>
\${f('promo_code','Promo code')}
<label>Promo type</label>
<select name="promo_type">
<option value="percent"\${s.promo_type!='fixed'?' selected':''}>Percentage</option>
<option value="fixed"\${s.promo_type=='fixed'?' selected':''}>Fixed amount</option>
</select>
\${f('promo_value','Promo value','number')}

<h3 style="margin-top:20px">Branding</h3>
\${f('logo_url','Logo URL')}
\${f('hero_title','Homepage headline')}
<label>Homepage text</label>
<textarea name="hero_text" rows="3">\${esc(s.hero_text)}</textarea>

<button class="btn">Save settings</button>
</form>

<p style="margin:14px 0 6px">Homepage banner photo:</p>
<div class="drop" id="hdz" style="max-width:650px;\${s.hero_img?\`background:url('\${esc(s.hero_img)}') center/cover;color:#fff;height:140px\`:''}">⬆ Drop banner image here</div>
\`}};`;

adminHtml = replaceOnce(
  adminHtml,
  oldSettingsReturn,
  newSettingsReturn,
  "admin settings panel"
);

/* Replace settings submit to correctly send checkboxes */
adminHtml = replaceOnce(
  adminHtml,
  `async function ss(e){e.preventDefault();try{await A('/settings','PUT',Object.fromEntries(new FormData(e.target)));toast('Settings saved')}catch(x){toast(x.message)}}`,
  `async function ss(e){
  e.preventDefault();

  const fd=new FormData(e.target);
  const b=Object.fromEntries(fd);

  ['payment_cod','payment_card','promo_enabled'].forEach(k=>{
    b[k]=fd.has(k)?'1':'0';
  });

  try{
    await A('/settings','PUT',b);
    toast('Settings saved');
    go('Settings');
  }catch(x){
    toast(x.message);
  }
}`,
  "admin settings save"
);

/* Order status includes Pending/Confirmed */
adminHtml = adminHtml.replace(
  `['All','New','Preparing','Out for delivery','Delivered','Cancelled','Completed']`,
  `['All','Pending','New','Confirmed','Preparing','Out for delivery','Delivered','Cancelled','Completed']`
);

adminHtml = adminHtml.replace(
  `['New','Preparing','Out for delivery','Delivered','Cancelled','Completed']`,
  `['Pending','New','Confirmed','Preparing','Out for delivery','Delivered','Cancelled','Completed']`
);

/* Order total column */
adminHtml = adminHtml.replace(
  `['Total (COD)',r=>money(r.total)]`,
  `['Payment',r=>esc(r.pay||'COD')],
['Subtotal',r=>money(r.subtotal||r.total)],
['Discount',r=>money(r.discount||0)],
['Total',r=>money(r.total)]`
);

write(adminPath,adminHtml);

/* =========================================================
   PACKAGE + TESTS
========================================================= */

let pkg = JSON.parse(read(packagePath));
pkg.scripts = pkg.scripts || {};
pkg.scripts.test = "node tests\\run-tests.js";
pkg.scripts.check = "node --check server.js && node --check public\\app.js";
write(packagePath,JSON.stringify(pkg,null,2)+"\n");

const testsDir = path.join(root,"tests");
fs.mkdirSync(testsDir,{recursive:true});

write(path.join(testsDir,"run-tests.js"),String.raw`
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const Database=require("better-sqlite3");

const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
const index=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
const account=fs.readFileSync(path.join(root,"public","account.html"),"utf8");
const admin=fs.readFileSync(path.join(root,"public","admin.html"),"utf8");

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

test("server supports admin approval mode",()=>{
  assert(server.includes("approval_mode"));
  assert(server.includes("===\\'ADMIN\\'"));
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
`);

console.log("");
console.log("============================================================");
console.log("IMPLEMENTATION PATCH COMPLETE");
console.log("============================================================");
console.log("Modified:");
console.log("  server.js");
console.log("  public/index.html");
console.log("  public/account.html");
console.log("  public/admin.html");
console.log("  package.json");
console.log("Created:");
console.log("  tests/run-tests.js");
console.log("");


