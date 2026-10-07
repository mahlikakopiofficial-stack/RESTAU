'use strict';

const {sendMail}=require('./gmail');
const crypto=require('crypto');

function clean(v){return String(v??'').replace(/[\r\n]/g,'').trim();}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function emailOk(v){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(v));}
function restaurant(){return clean(process.env.RESTO_NAME||'PinoyAmbula');}
function adminEmail(){return clean(process.env.GMAIL_ADMIN_NOTIFY_TO||process.env.GMAIL_USER);}
function baseUrl(){return String(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,'');}
function money(v){return Number(v||0).toFixed(3)+' '+clean(process.env.CURRENCY||'KWD');}
function lineHtml(text){return esc(text).replace(/\n/g,'<br>');}

function unsubscribeUrl(email){
  const token=crypto.createHmac('sha256',clean(process.env.SECRET||'change-me'))
    .update('newsletter|'+clean(email).toLowerCase()).digest('hex');
  return baseUrl()+'/api/newsletter/unsubscribe?email='+encodeURIComponent(clean(email).toLowerCase())+'&token='+encodeURIComponent(token);
}

function fire(label,mail){
  return Promise.resolve()
    .then(()=>sendMail(mail))
    .then(result=>{console.log('EMAIL_NOTIFICATION_SENT',label,mail.to);return result;})
    .catch(error=>{
      console.error('EMAIL_NOTIFICATION_FAILED',label,error.message);
      throw error;
    });
}

function itemsText(order){
  try{
    return JSON.parse(order.items||'[]')
      .map(i=>i.qty+' x '+i.name+' — '+money(i.price*i.qty)).join('\n');
  }catch{return '';}
}

function standard({title,intro,body,footer}){
  return {
    html:'<div style="font-family:Arial,sans-serif;line-height:1.5;max-width:620px;margin:auto">'+
      '<h2>'+esc(title)+'</h2><p>'+lineHtml(intro||'')+'</p>'+
      (body||'')+
      '<p style="margin-top:24px;font-size:13px;opacity:.7">'+esc(footer||restaurant())+'</p></div>',
    text:[intro||'',body?String(body).replace(/<[^>]+>/g,' '):'',footer||restaurant()]
      .filter(Boolean).join('\n\n')
  };
}

function notifyRegistration(customer){
  if(!emailOk(customer.email))return;
  const s=standard({
    title:'Welcome to '+restaurant(),
    intro:'Hello '+(customer.name||'Customer')+',',
    body:'<p>Your '+esc(restaurant())+' account has been created successfully.</p>'+
      '<p>You can now sign in with your registered phone number and password to place orders and manage your account.</p>'
  });
  return fire('registration',{to:customer.email,subject:restaurant()+': Welcome to your account',...s});
}

function notifyInquiryReceived(inquiry){
  if(!emailOk(inquiry.email))return;
  const s=standard({
    title:'We received your inquiry',
    intro:'Hello '+(inquiry.name||'Customer')+',',
    body:'<p>Thank you for contacting '+esc(restaurant())+'. We received your '+esc(inquiry.type||'General')+' inquiry and our team will get back to you.</p><blockquote style="border-left:3px solid #ccc;padding-left:12px">'+lineHtml(inquiry.msg||'')+'</blockquote>'
  });
  return fire('inquiry-received',{to:inquiry.email,subject:restaurant()+': We received your inquiry',...s});
}

function notifyInquiryReply(inquiry,message){
  if(!emailOk(inquiry.email))return;
  const s=standard({
    title:'Reply from '+restaurant(),
    intro:'Hello '+(inquiry.name||'Customer')+',',
    body:'<p>'+lineHtml(message)+'</p><hr><p style="font-size:13px">This reply is regarding your '+esc(inquiry.type||'General')+' inquiry.</p>'
  });
  return fire('inquiry-reply',{to:inquiry.email,subject:restaurant()+': Reply to your inquiry',...s});
}

function notifyAdminCustomerMessage(inquiry,message){
  if(!emailOk(adminEmail()))return;
  const order=Number(inquiry.order_id||0);
  const s=standard({
    title:'New customer message',
    intro:'A customer sent a new message from the PinoyAmbula account chat.',
    body:'<p><b>Customer:</b> '+esc(inquiry.name)+'<br><b>Email:</b> '+esc(inquiry.email||'—')+'<br><b>Phone:</b> '+esc(inquiry.phone||'—')+'<br><b>Topic:</b> '+esc(inquiry.type||'Support')+(order?'<br><b>Order:</b> #'+order:'')+'</p><blockquote>'+lineHtml(message)+'</blockquote>'
  });
  return fire('admin-customer-message',{to:adminEmail(),subject:restaurant()+': New customer message from '+inquiry.name+(order?' for order #'+order:''),...s});
}
function notifyAdminInquiry(inquiry){
  if(!emailOk(adminEmail()))return;
  const s=standard({
    title:'New customer inquiry',
    intro:'A new inquiry was received.',
    body:'<p><b>Customer:</b> '+esc(inquiry.name)+'<br><b>Email:</b> '+esc(inquiry.email||'—')+'<br><b>Phone:</b> '+esc(inquiry.phone||'—')+'<br><b>Topic:</b> '+esc(inquiry.type||'General')+'</p><blockquote>'+lineHtml(inquiry.msg||'')+'</blockquote>'
  });
  return fire('admin-inquiry',{to:adminEmail(),subject:restaurant()+': New customer inquiry #'+inquiry.id,...s});
}

async function notifyNewsletterWelcome(email){
  if(!emailOk(email))return {skipped:true};
  const url=unsubscribeUrl(email);
  const s=standard({
    title:'Welcome to '+restaurant(),
    intro:'Thank you for subscribing to our newsletter.',
    body:'<p>We will send you occasional updates about new dishes, promotions, subscriptions and restaurant news.</p><p><a href="'+esc(url)+'">Unsubscribe from this newsletter</a></p>'
  });
  await fire('newsletter-welcome',{to:email,subject:restaurant()+': You are subscribed',...s});
  return {sent:true};
}

async function sendNewsletterCampaign(subscribers,subject,message){
  const subjectClean=clean(subject);
  const text=String(message||'').trim();
  if(!subjectClean)throw new Error('Newsletter subject is required');
  if(!text)throw new Error('Newsletter message is required');

  const recipients=subscribers.filter(x=>emailOk(x.email));
  let sent=0,failed=0;
  const failures=[];

  for(const subscriber of recipients){
    try{
      await sendMail({
        to:subscriber.email,
        subject:subjectClean,
        text:text,
        html:'<div style="font-family:Arial,sans-serif;line-height:1.5;max-width:620px;margin:auto">'+
          '<h2>'+esc(subjectClean)+'</h2><p>'+lineHtml(text)+'</p></div>'
      });
      sent++;
    }catch(error){
      failed++;
      failures.push({email:subscriber.email,error:error.message});
      console.error('NEWSLETTER_SEND_FAILED',subscriber.email,error.message);
    }
  }

  return {sent,failed,failures};
}

function notifyOrderReceived(order){
  if(!emailOk(order.email))return;
  const s=standard({
    title:'Order #'+order.id+' received',
    intro:'Hello '+(order.name||'Customer')+',',
    body:'<p>Thank you for your order. Your current order status is <b>'+esc(order.status)+'</b>.</p>'+
      '<pre style="white-space:pre-wrap">'+esc(itemsText(order))+'</pre>'+
      '<p><b>Total:</b> '+esc(money(order.total))+'</p>'
  });
  return fire('order-received',{to:order.email,subject:restaurant()+': Order #'+order.id+' received',...s});
}

function notifyAdminOrder(order){
  if(!emailOk(adminEmail()))return;
  const s=standard({
    title:'New order #'+order.id,
    intro:'A new order was placed.',
    body:'<p><b>Customer:</b> '+esc(order.name)+'<br><b>Phone:</b> '+esc(order.phone)+
      '<br><b>Email:</b> '+esc(order.email||'—')+'<br><b>Payment:</b> '+esc(order.pay||'COD')+
      '<br><b>Total:</b> '+esc(money(order.total))+'</p>'+
      '<pre style="white-space:pre-wrap">'+esc(itemsText(order))+'</pre>'
  });
  return fire('admin-order',{to:adminEmail(),subject:restaurant()+': New order #'+order.id,...s});
}

function notifyOrderStatus(order,oldStatus){
  if(!emailOk(order.email)||oldStatus===order.status)return;
  const message=order.status==='Out for delivery'?'Your order is on the way.':
    order.status==='Delivered'?'Your order has been marked delivered.':
    order.status==='Cancelled'?'Your order has been cancelled.':
    'Your order status is now '+order.status+'.';
  const extra=[order.eta?'Estimated arrival: '+order.eta:'',
    order.driver_name?'Driver: '+order.driver_name:'',
    order.status_message||''].filter(Boolean).join('\n');

  const s=standard({
    title:'Order #'+order.id+' update',
    intro:'Hello '+(order.name||'Customer')+',',
    body:'<p>'+esc(message)+'</p>'+(extra?'<p>'+lineHtml(extra)+'</p>':'')
  });
  return fire('order-status',{to:order.email,subject:restaurant()+': Order #'+order.id+' is now '+order.status,...s});
}

function notifyPaymentStatus(order,oldStatus){
  if(!emailOk(order.email)||oldStatus===order.payment_status)return;
  const s=standard({
    title:'Payment update for order #'+order.id,
    intro:'Hello '+(order.name||'Customer')+',',
    body:'<p>Your payment status is now <b>'+esc(order.payment_status)+'</b>.</p>'+
      '<p>Order total: <b>'+esc(money(order.total))+'</b></p>'
  });
  return fire('order-payment',{to:order.email,subject:restaurant()+': Payment status for order #'+order.id+' — '+order.payment_status,...s});
}

function notifySubscriptionReceived(sub){
  if(!emailOk(sub.email))return;
  const s=standard({
    title:'Subscription request received',
    intro:'Hello '+(sub.name||'Customer')+',',
    body:'<p>We received your <b>'+esc(sub.plan)+'</b> subscription request.</p>'+
      '<p>Schedule: '+esc(sub.start)+' → '+esc(sub.end)+
      '<br>Price: <b>'+esc(money(sub.price))+'</b>'+
      '<br>Payment: '+esc(sub.payment_method||'COD')+' · '+esc(sub.payment_status||'Pending')+'</p>'
  });
  return fire('subscription-received',{to:sub.email,subject:restaurant()+': Subscription request received',...s});
}

function notifySubscriptionStatus(sub,oldStatus){
  if(!emailOk(sub.email)||oldStatus===sub.status)return;
  const s=standard({
    title:'Subscription update',
    intro:'Hello '+(sub.name||'Customer')+',',
    body:'<p>Your <b>'+esc(sub.plan)+'</b> subscription is now <b>'+esc(sub.status)+'</b>.</p>'+
      '<p>Schedule: '+esc(sub.start)+' → '+esc(sub.end)+'</p>'
  });
  return fire('subscription-status',{to:sub.email,subject:restaurant()+': Subscription is now '+sub.status,...s});
}

function notifySubscriptionPaymentStatus(sub,oldStatus){
  if(!emailOk(sub.email)||oldStatus===sub.payment_status)return;
  const s=standard({
    title:'Subscription payment update',
    intro:'Hello '+(sub.name||'Customer')+',',
    body:'<p>Your subscription payment status is now <b>'+esc(sub.payment_status)+'</b>.</p>'+
      '<p>Plan: '+esc(sub.plan)+'<br>Price: '+esc(money(sub.price))+'</p>'
  });
  return fire('subscription-payment',{to:sub.email,subject:restaurant()+': Subscription payment — '+sub.payment_status,...s});
}

function sendPasswordResetEmail({to,name:customerName,resetUrl}){
  if(!emailOk(to))throw new Error('Customer does not have a valid email address.');
  const s=standard({
    title:'Reset your '+restaurant()+' password',
    intro:'Hello '+(customerName||'Customer')+',',
    body:'<p>We received a request to reset your account password.</p>'+
      '<p><a href="'+esc(resetUrl)+'" style="display:inline-block;padding:10px 16px;background:#222;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p>'+
      '<p>This link expires in 30 minutes and can only be used once.</p>'+
      '<p>If you did not request this, you can ignore this email.</p>'
  });
  return sendMail({to,subject:restaurant()+': Reset your password',...s});
}

module.exports={
  notifyRegistration,
  notifyInquiryReceived,
  notifyInquiryReply,
  notifyAdminCustomerMessage,
  notifyAdminInquiry,
  notifyNewsletterWelcome,
  sendNewsletterCampaign,
  notifyOrderReceived,
  notifyAdminOrder,
  notifyOrderStatus,
  notifyPaymentStatus,
  notifySubscriptionReceived,
  notifySubscriptionStatus,
  notifySubscriptionPaymentStatus,
  sendPasswordResetEmail
};
