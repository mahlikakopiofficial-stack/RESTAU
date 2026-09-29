const fs = require("fs");

const server = "server.js";
let s = fs.readFileSync(server, "utf8");

/* ============================================================
   1. DATABASE MIGRATIONS
   ============================================================ */

const migrationMarker = "/* PinoyAmbula_FINAL_MIGRATION */";

if (!s.includes(migrationMarker)) {
  const marker = "const app=express();";

  const migration = `
/* PinoyAmbula_FINAL_MIGRATION */
function addColumn(table,col,type){
  try{db.exec("ALTER TABLE "+table+" ADD COLUMN "+col+" "+type)}catch{}
}

addColumn('items','discount_price','REAL');
addColumn('orders','subtotal','REAL');
addColumn('orders','discount','REAL');
addColumn('orders','promo_code','TEXT');
addColumn('orders','payment_status','TEXT');
addColumn('orders','approved_at','TEXT');
addColumn('orders','confirmed_at','TEXT');
addColumn('orders','delivered_at','TEXT');
addColumn('orders','cancelled_at','TEXT');

[
  ['approval_mode','AUTO'],
  ['payment_cod','1'],
  ['payment_card','1'],
  ['promo_enabled','1'],
  ['promo_code','WELCOME'],
  ['promo_type','percent'],
  ['promo_value','10'],
  ['whatsapp',''],
  ['facebook',''],
  ['instagram',''],
  ['location',''],
  ['logo_url',''],
].forEach(([k,v])=>{
  db.prepare('INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)').run(k,v);
});

`;

  if (!s.includes(marker)) {
    s = s.replace(marker === "/* PinoyAmbula_FINAL_MIGRATION */" ? marker : "const app=express();",
      migration + "const app=express();");
  }
}

/* ============================================================
   2. CONFIG + MENU
   ============================================================ */

s = s.replace(
  /app\.get\('\/api\/config'.*?\}\);/,
  `app.get('/api/config',(q,r)=>{
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
});`
);

s = s.replace(
  /app\.get\('\/api\/menu'.*?\}\);/,
  `app.get('/api/menu',(q,r)=>r.json(
    db.prepare('SELECT id,cat,region,name,descr,price,discount_price,img,emoji,active FROM items WHERE active=1 ORDER BY id').all()
  ));`
);

/* ============================================================
   3. ORDER API
   ============================================================ */

const orderRegex =
  /app\.post\('\/api\/order'.*?r\.json\(\{id:Number\(id\),total,pay:'COD'\}\)\}\)\);/s;

const orderReplacement = `app.post('/api/order',lim(30),w((q,r)=>{
  const b=q.body;
  need(b,'name','phone','address');

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
      'SELECT id,name,price,discount_price FROM items WHERE id=? AND active=1',
      i.id
    );

    if(!x)return null;

    const regular=+x.price||0;
    const dp=+x.discount_price||0;
    const unit=(dp>0 && dp<regular)?dp:regular;

    return {
      id:x.id,
      name:x.name,
      price:unit,
      regular_price:regular,
      qty:Math.max(1,Math.min(99,+i.qty||1))
    };
  }).filter(Boolean);

  if(!its.length)
    throw new Error('Cart is empty');

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

  const delivery=+(st.fee||0);
  const total=Math.max(0,sub-discount+delivery);
  const approval=String(st.approval_mode||'AUTO').toUpperCase();
  const status=approval==='ADMIN'?'Pending':'Confirmed';

  const id=db.prepare(\`
    INSERT INTO orders(
      customer_id,name,phone,address,paci,notes,items,
      subtotal,discount,promo_code,total,pay,payment_status,status,
      confirmed_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  \`).run(
    custId(b,q),
    b.name,
    b.phone,
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
    status==='Confirmed'?new Date().toISOString():null
  ).lastInsertRowid;

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
}));`;

if (!orderRegex.test(s))
  throw new Error("ORDER_ROUTE_NOT_FOUND");

s=s.replace(orderRegex,orderReplacement);

/* ============================================================
   4. REMOVE CUSTOMER CANCELLATION
   ============================================================ */

s=s.replace(
  /app\.post\('\/api\/orders\/:id\/cancel'.*?\}\)\);/,
  ''
);

/* ============================================================
   5. ADMIN STATUS WORKFLOW
   ============================================================ */

s=s.replace(
  /app\.put\('\/api\/admin\/status\/:t\/:id'.*?\}\)\);/,
  `app.put('/api/admin/status/:t/:id',admin,w((q,r)=>{
  if(!['orders','subs','inquiries'].includes(q.params.t))
    throw new Error('bad table');

  const status=String(q.body.status||'');

  if(q.params.t==='orders'){
    const allowed=[
      'Pending',
      'New',
      'Confirmed',
      'Preparing',
      'Out for delivery',
      'Delivered',
      'Cancelled',
      'Completed'
    ];

    if(!allowed.includes(status))
      throw new Error('Invalid order status');

    const sets=['status=?'];
    const vals=[status];

    if(status==='Confirmed'){
      sets.push('confirmed_at=?');
      vals.push(new Date().toISOString());
    }

    if(status==='Delivered'){
      sets.push('delivered_at=?');
      vals.push(new Date().toISOString());
    }

    if(status==='Cancelled'){
      sets.push('cancelled_at=?');
      vals.push(new Date().toISOString());
    }

    vals.push(q.params.id);

    db.prepare(
      'UPDATE orders SET '+sets.join(',')+' WHERE id=?'
    ).run(...vals);

    return r.json({ok:1,status});
  }

  db.prepare(
    'UPDATE '+q.params.t+' SET status=? WHERE id=?'
  ).run(status,q.params.id);

  r.json({ok:1,status});
}));`
);

/* ============================================================
   6. ITEM DISCOUNT PRICE
   ============================================================ */

s=s.replace(
  /const F=\[.*?\];/,
  `const F=['cat','region','name','descr','price','discount_price','emoji','active'];`
);

s=s.replace(
  /app\.post\('\/api\/admin\/items'.*?\}\)\);/,
  `app.post('/api/admin/items',admin,w((q,r)=>{
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
}));`
);

/* ============================================================
   7. ADMIN SETTINGS
   ============================================================ */

s=s.replace(
  /const SK=\[.*?\];/,
  `const SK=[
  'name','phone','hours','currency','fee','min_order','accepting',
  'hero_title','hero_text','logo_url','whatsapp','facebook','instagram',
  'location','approval_mode','payment_cod','payment_card',
  'promo_enabled','promo_code','promo_type','promo_value'
];`
);

const settingsPutRegex =
  /app\.put\('\/api\/admin\/settings'.*?\}\)\);/s;

s=s.replace(
  settingsPutRegex,
  `app.put('/api/admin/settings',admin,w((q,r)=>{
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
}));`
);

fs.writeFileSync(server,s);
console.log("SERVER PATCH COMPLETE");

/* ============================================================
   ACCOUNT PAGE
   ============================================================ */

const accountFile="public/account.html";
let a=fs.readFileSync(accountFile,"utf8");

a=a.replace(
  /<div id="order-tracker"><\/div>/,
  `<div id="order-tracker" style="margin:15px 0"></div>`
);

a=a.replace(
  /<div class="tw"><table id="ot"><\/table><\/div>/,
  `<div class="tw"><table id="ot"></table></div>`
);

const accountScriptRegex =
  /async function load\(\)\{.*?load\(\)<\/script>/s;

const accountScript = `async function load(){
  if(!tk('ct'))return;

  try{
    const c=await api('/config');
    CUR=c.currency;

    const m=await api('/me');

    $('#auth').hidden=true;
    $('#me').hidden=false;
    $('#hi').textContent='Mabuhay, '+m.name+'!';

    const steps=[
      'Pending',
      'Confirmed',
      'Preparing',
      'Out for delivery',
      'Delivered'
    ];

    $('#ot').innerHTML=
      '<tr><th>#</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr>'+
      (
        m.orders.map(o=>{
          const status=String(o.status||'Pending');
          const current=steps.indexOf(status);

          const tracker=steps.map((x,i)=>{
            const done=current>=i;
            const here=status===x;
            return '<span style="display:inline-block;margin-right:8px;font-weight:'+
              (here?'700':'400')+
              '">'+
              (done?'✓ ':'')+
              esc(x)+
              '</span>';
          }).join('');

          return '<tr>'+
            '<td>'+o.id+'</td>'+
            '<td>'+esc(o.created)+'</td>'+
            '<td>'+JSON.parse(o.items||'[]').map(i=>
              i.qty+'× '+esc(i.name)
            ).join(', ')+'</td>'+
            '<td>'+money(o.total)+'</td>'+
            '<td>'+esc(status)+
              '<div style="font-size:.78rem;margin-top:5px">'+tracker+'</div>'+
            '</td>'+
          '</tr>';
        }).join('')||
        '<tr><td colspan="5">No orders yet</td></tr>'
      );

    $('#order-tracker').innerHTML=
      '<strong>Order tracking:</strong> '+
      'Pending → Confirmed → Preparing → Out for delivery → Delivered';

    $('#st').innerHTML=
      '<tr><th>#</th><th>Plan</th><th>Start</th><th>End</th><th>Status</th></tr>'+
      (
        m.subs.map(s=>
          '<tr><td>'+s.id+'</td>'+
          '<td>'+esc(s.plan)+'</td>'+
          '<td>'+s.start+'</td>'+
          '<td>'+s.end+'</td>'+
          '<td>'+esc(s.status)+'</td></tr>'
        ).join('')||
        '<tr><td colspan="5">No subscriptions yet</td></tr>'
      );

  }catch(x){
    localStorage.removeItem('ct');
  }
}

load()</script>`;

if(!accountScriptRegex.test(a))
  throw new Error("ACCOUNT_SCRIPT_NOT_FOUND");

a=a.replace(accountScriptRegex,accountScript);

fs.writeFileSync(accountFile,a);
console.log("ACCOUNT PATCH COMPLETE");
