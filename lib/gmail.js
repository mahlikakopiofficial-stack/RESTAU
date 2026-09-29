'use strict';
const tls = require('tls');

function clean(v){ return String(v ?? '').replace(/[\r\n]/g,'').trim(); }
function dotStuff(s){ return String(s).replace(/^\./gm,'..'); }

function sendCommand(socket, command, expected) {
  return new Promise((resolve,reject)=>{
    let buf='';
    const onData=chunk=>{
      buf += chunk.toString('utf8');
      const lines=buf.split(/\r?\n/);
      buf=lines.pop()||'';
      for(const line of lines){
        if(!/^\d{3}[ -]/.test(line)) continue;
        const code=Number(line.slice(0,3));
        if(line[3]==='-') continue;
        cleanup();
        if(expected.includes(code)) resolve(code); else reject(new Error(`SMTP ${code}: ${line}`));
        return;
      }
    };
    const onError=e=>{cleanup();reject(e)};
    const timer=setTimeout(()=>{cleanup();reject(new Error('SMTP timeout'))},15000);
    function cleanup(){clearTimeout(timer);socket.off('data',onData);socket.off('error',onError)}
    socket.on('data',onData);socket.on('error',onError);socket.write(command+'\r\n');
  });
}

async function sendMail({to,subject,text,html}){
  const user=clean(process.env.GMAIL_USER), pass=String(process.env.GMAIL_APP_PASSWORD||'');
  if(!user||!pass) throw new Error('GMAIL_USER/GMAIL_APP_PASSWORD not configured');
  const recipient=clean(to);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) throw new Error('Invalid recipient');
  const socket=tls.connect({host:'smtp.gmail.com',port:465,servername:'smtp.gmail.com',rejectUnauthorized:true});
  try{
    await sendCommand(socket,'',[220]);
    await sendCommand(socket,'EHLO pinoyambulakw.duckdns.org',[250]);
    await sendCommand(socket,'AUTH LOGIN',[334]);
    await sendCommand(socket,Buffer.from(user).toString('base64'),[334]);
    await sendCommand(socket,Buffer.from(pass).toString('base64'),[235]);
    await sendCommand(socket,`MAIL FROM:<${clean(user)}>`,[250]);
    await sendCommand(socket,`RCPT TO:<${recipient}>`,[250,251]);
    await sendCommand(socket,'DATA',[354]);
    const fromName=clean(process.env.GMAIL_FROM_NAME||'PinoyAmbula');
    const message=[
      `From: ${fromName} <${clean(user)}>`,
      `To: <${recipient}>`,
      `Subject: ${clean(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="pinoyambula-reset"',
      '',
      '--pinoyambula-reset',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      String(text||''),
      '',
      '--pinoyambula-reset',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      String(html||''),
      '',
      '--pinoyambula-reset--'
    ].join('\r\n');
    await sendCommand(socket,dotStuff(message)+'\r\n.',[250]);
    await sendCommand(socket,'QUIT',[221]);
  } finally { socket.end(); }
}

module.exports={sendMail};
