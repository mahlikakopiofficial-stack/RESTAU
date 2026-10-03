from pathlib import Path

root = Path(__file__).resolve().parents[1]

# 1) Customer-chat admin email notifier was implemented but not exported.
p = root / 'lib' / 'notifications.js'
s = p.read_text()
old = "module.exports={\n  notifyInquiryReceived,\n  notifyInquiryReply,\n  notifyAdminInquiry,"
new = "module.exports={\n  notifyInquiryReceived,\n  notifyInquiryReply,\n  notifyAdminCustomerMessage,\n  notifyAdminInquiry,"
if old not in s:
    raise SystemExit('notifications export marker not found')
p.write_text(s.replace(old, new, 1))

# 2) Failed/skipped WhatsApp notifications must be retryable after a transient
# provider/configuration problem. Previously INSERT OR IGNORE permanently
# suppressed later retries for the same event key.
p = root / 'server.js'
s = p.read_text()
old = '''const notificationOnce=async(eventKey,recipient,text)=>{\n  if(!eventKey||!recipient||!whatsappConfigured())return {skipped:true};\n  const inserted=db.prepare("INSERT OR IGNORE INTO notification_log(channel,event_key,recipient,status) VALUES('whatsapp',?,?,?)").run(eventKey,recipient,'Pending');\n  if(!inserted.changes)return {duplicate:true};'''
new = '''const notificationOnce=async(eventKey,recipient,text)=>{\n  if(!eventKey||!recipient||!whatsappConfigured())return {skipped:true,reason:'WhatsApp provider is not configured'};\n  const existing=one("SELECT status FROM notification_log WHERE event_key=?",eventKey);\n  if(existing&&['Sent','Pending'].includes(existing.status))return {duplicate:true,status:existing.status};\n  if(existing){\n    db.prepare("UPDATE notification_log SET recipient=?,status='Pending',error='' WHERE event_key=?").run(recipient,eventKey);\n  }else{\n    db.prepare("INSERT INTO notification_log(channel,event_key,recipient,status) VALUES('whatsapp',?,?,?)").run('whatsapp',eventKey,recipient,'Pending');\n  }'''
if old not in s:
    raise SystemExit('notificationOnce marker not found')
p.write_text(s.replace(old, new, 1))

# 3) Add regression coverage for the actual runtime defects fixed here and
# preserve the already-present feature coverage for sweets/banner/heritage,
# subscription gating, chat and newsletter.
p = root / 'tests' / 'final-regression.js'
s = p.read_text()
old = "t('notifications',()=>{assert(notifications.includes('notifyOrderReceived'));assert(notifications.includes('notifyOrderStatus'));assert(notifications.includes('notifySubscriptionStatus'));assert(notifications.includes('sendPasswordResetEmail'))});"
new = "t('notifications',()=>{assert(notifications.includes('notifyOrderReceived'));assert(notifications.includes('notifyOrderStatus'));assert(notifications.includes('notifySubscriptionStatus'));assert(notifications.includes('notifyAdminCustomerMessage'));assert(notifications.includes('sendPasswordResetEmail'));assert(/notifyAdminCustomerMessage,/.test(notifications));assert(server.includes(\"SELECT status FROM notification_log WHERE event_key=?\"));assert(server.includes(\"['Sent','Pending']\"))});"
if old not in s:
    raise SystemExit('notification regression marker not found')
p.write_text(s.replace(old, new, 1))

print('FINAL_FIX_APPLIED')
