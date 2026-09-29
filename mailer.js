const nodemailer=require('nodemailer');

const user=String(process.env.GMAIL_USER||'').trim();
const pass=String(process.env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'');
const fromName=String(process.env.GMAIL_FROM_NAME||'PinoyAmbula').trim();
if(!user||!pass)throw new Error('Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');

const transporter=nodemailer.createTransport({
  host:'smtp.gmail.com',
  port:587,
  secure:false,
  requireTLS:true,
  auth:{user,pass}
});

async function sendPasswordResetEmail({to,name,resetUrl}){
  const safeName=String(name||'Customer').replace(/[<>]/g,'');
  await transporter.sendMail({
    from:'"'+fromName.replace(/"/g,'')+'" <'+user+'>',
    to,
    subject:'Reset your PinoyAmbula password',
    text:'Hello '+safeName+',\n\nWe received a request to reset your PinoyAmbula account password. Use this link within 30 minutes to choose a new password:\n\n'+resetUrl+'\n\nIf you did not request this, you can ignore this email. Your password will not change unless the link is used.\n\nPinoyAmbula',
    html:'<p>Hello '+safeName+',</p><p>We received a request to reset your PinoyAmbula account password.</p><p><a href="'+resetUrl.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email.</p><p>PinoyAmbula</p>'
  });
}

module.exports={sendPasswordResetEmail};
