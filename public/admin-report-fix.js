(function(){
  'use strict';

  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const parts=value=>{
    const raw=String(value??'').trim();
    if(!raw)return null;
    const sql=raw.length===19&&raw[4]==='-'&&raw[7]==='-'&&raw[10]===' '&&raw[13]===':'&&raw[16]===':';
    const d=new Date(sql?raw.replace(' ','T')+'Z':raw);
    return Number.isNaN(d.valueOf())?null:d;
  };
  const format=value=>{
    const raw=String(value??'').trim();
    if(!raw)return '';
    const d=parts(raw);
    if(!d)return raw;
    return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
  };

  if(typeof window.kuwaitToday!=='function')window.kuwaitToday=today;
  if(typeof window.kuwaitDateTime!=='function')window.kuwaitDateTime=format;
  window.adminKuwaitToday=window.kuwaitToday;
  window.adminKuwaitDateTime=window.kuwaitDateTime;

  // Keep every admin report view on the same Kuwait-date range endpoint.
  // This also prevents enhancements.js from replacing Reports with the older single-date route.
  if(typeof R==='object'){
    // Reports is owned here so later enhancement scripts cannot restore the broken legacy renderer.

    R.Report=async function(){
      const date=window._reportDate||window.kuwaitToday();
      const r=await A('/report-range?from='+encodeURIComponent(date)+'&to='+encodeURIComponent(date));
      window._lastReport=r;
      return '<div class="report-actions"><input id="reportDate" type="date" value="'+date+'" style="width:180px;margin:0"><button class="btn s" onclick="window._reportDate=document.getElementById(\'reportDate\').value;go(\'Reports\')">Refresh</button><button class="btn s o" onclick="printReport()">🖨 Print</button><button class="btn s o" onclick="exportReport()">⬇ CSV</button></div><div class="grid"><div class="card report-kpi">Sales<b>'+money(r.revenue)+'</b></div><div class="card report-kpi">Orders<b>'+r.orders+'</b></div><div class="card report-kpi">Delivered<b>'+r.delivered+'</b></div><div class="card report-kpi">Average order<b>'+money(r.averageOrder)+'</b></div><div class="card report-kpi">Cancelled<b>'+r.cancelled+'</b></div><div class="card report-kpi">Paid revenue<b>'+money(r.paidRevenue)+'</b></div><div class="card report-kpi">New subscriptions<b>'+r.newSubscriptions+'</b></div><div class="card report-kpi">Active subscriptions<b>'+r.activeSubscriptions+'</b></div><div class="card report-kpi">Inquiries<b>'+r.inquiries+'</b></div></div><h3 style="margin:24px 0 10px">Order status</h3>'+tbl([{k:'New',v:r.newOrders},{k:'Preparing',v:r.preparing},{k:'Out for delivery',v:r.outForDelivery},{k:'Delivered',v:r.delivered},{k:'Cancelled',v:r.cancelled}], [['Status',x=>x.k],['Count',x=>x.v]])+'<h3 style="margin:24px 0 10px">Top menu items</h3>'+tbl(r.topItems,[['Item',x=>esc(x.name)],['Qty sold',x=>x.qty]])+'<h3 style="margin:24px 0 10px">Orders</h3>'+tbl(r.ordersList||[],[['#',x=>x.id],['Date',x=>esc(window.kuwaitDateTime(x.created))],['Customer',x=>esc(x.name)],['Status',x=>esc(x.status)],['Total',x=>money(x.total)]])+'';
    };

    R.Reports=async function(){
      const today=window.kuwaitToday();
      const from=window._reportFrom||today;
      const to=window._reportTo||today;
      const r=await A('/report-range?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to));
      window._lastReport=r;
      return '<div class="report-actions"><label>From <input id="reportFrom" type="date" value="'+from+'"></label><label>To <input id="reportTo" type="date" value="'+to+'"></label><button class="btn s" onclick="window._reportFrom=document.getElementById(\'reportFrom\').value;window._reportTo=document.getElementById(\'reportTo\').value;go(\'Reports\')">Refresh</button><button class="btn s o" onclick="printReport()">🖨 Print</button><button class="btn s o" onclick="exportReport()">⬇ CSV</button></div><div class="grid"><div class="card report-kpi">Sales<b>'+money(r.revenue)+'</b></div><div class="card report-kpi">Orders<b>'+r.orders+'</b></div><div class="card report-kpi">Delivered<b>'+r.delivered+'</b></div><div class="card report-kpi">Cancelled<b>'+r.cancelled+'</b></div><div class="card report-kpi">Paid revenue<b>'+money(r.paidRevenue)+'</b></div><div class="card report-kpi">Average order<b>'+money(r.averageOrder)+'</b></div><div class="card report-kpi">New subscriptions<b>'+r.newSubscriptions+'</b></div><div class="card report-kpi">Active subscriptions<b>'+r.activeSubscriptions+'</b></div></div><h3>Top menu items</h3>'+tbl(r.topItems,[['Item',x=>esc(x.name)],['Qty sold',x=>x.qty]])+'<h3>Orders</h3>'+tbl(r.ordersList||[],[['#',x=>x.id],['Date',x=>esc(window.kuwaitDateTime(x.created))],['Customer',x=>esc(x.name)],['Status',x=>esc(x.status)],['Total',x=>money(x.total)]])+'';
    };

    R.Overview=async function(){
      const s=await A('/stats');
      const date=window.kuwaitToday();
      const r=await A('/report-range?from='+encodeURIComponent(date)+'&to='+encodeURIComponent(date));
      return '<div class="report-actions"><button class="btn s" onclick="go(\'Reports\')">Open full report</button><button class="btn s o" onclick="exportReport()">⬇ Today\'s CSV</button></div><h3>Today\'s summary — '+r.from+'</h3><div class="grid"><div class="card report-kpi">Today\'s sales<b>'+money(r.revenue)+'</b></div><div class="card report-kpi">Today\'s orders<b>'+r.orders+'</b></div><div class="card report-kpi">Delivered<b>'+r.delivered+'</b></div><div class="card report-kpi">Cancelled<b>'+r.cancelled+'</b></div><div class="card report-kpi">New subscriptions<b>'+r.newSubscriptions+'</b></div><div class="card report-kpi">Active subscriptions<b>'+r.activeSubscriptions+'</b></div></div><h3 style="margin:24px 0 10px">Overall</h3><div class="grid">'+[['All orders',s.orders],['All-time revenue',money(s.revenue)],['Customers',s.customers],['Inquiries',s.inquiries],['Newsletter',s.subscribers]].map(x=>'<div class="card stat">'+x[0]+'<b>'+x[1]+'</b></div>').join('')+'</div><h3 style="margin:24px 0 10px">Top items today</h3>'+tbl(r.topItems,[['Item',x=>esc(x.name)],['Qty',x=>x.qty]]);
    };
    if(typeof cur!=='undefined' && cur==='Reports' && typeof go==='function'){
      setTimeout(()=>go('Reports'),0);
    }
  }
})();
