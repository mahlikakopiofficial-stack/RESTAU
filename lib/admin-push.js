'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_BASE = 'https://fcm.googleapis.com/v1/projects/';

const titles = Object.freeze({
  order: 'New order',
  inquiry: 'New customer inquiry',
  message: 'New customer message',
  subscription: 'New subscription'
});

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function readServiceAccount(env = process.env) {
  const filePath = String(env.FCM_SERVICE_ACCOUNT_PATH || '').trim();
  if (!filePath) return null;

  let account;
  try {
    account = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error('FCM service account file cannot be read or parsed.');
  }

  if (!account || !account.project_id || !account.client_email || !account.private_key) {
    throw new Error('FCM service account is missing project_id, client_email, or private_key.');
  }
  return account;
}

function isConfigured(env = process.env) {
  try {
    return Boolean(readServiceAccount(env));
  } catch {
    return false;
  }
}

function buildMessage(token, event) {
  const type = Object.prototype.hasOwnProperty.call(titles, event.type) ? event.type : 'order';
  const id = String(event.id || '');
  const route = type === 'order' ? 'Orders'
    : type === 'subscription' ? 'Subscriptions'
    : 'Inquiries';

  return {
    message: {
      token,
      notification: {
        title: 'PinoyAmbula Admin: ' + titles[type],
        body: id ? (type === 'order' ? 'Order #' + id + ' received. Tap to review.'
          : type === 'inquiry' ? 'Inquiry #' + id + ' received. Tap to review.'
          : type === 'message' ? 'A customer sent a message. Tap to review.'
          : 'Subscription #' + id + ' received. Tap to review.')
          : 'Open the admin app to review.'
      },
      data: {
        eventType: type,
        recordId: id,
        adminRoute: route
      },
      android: {
        priority: 'HIGH',
        notification: {
          channel_id: 'admin_events',
          sound: 'default'
        }
      }
    }
  };
}

let cachedToken = null;
async function accessToken(account) {
  const now = Date.now();
  if (cachedToken && cachedToken.email === account.client_email &&
      cachedToken.project === account.project_id && cachedToken.expiresAt > now + 60000) {
    return cachedToken.value;
  }

  const issued = Math.floor(now / 1000);
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: issued,
    exp: issued + 3600
  });
  const signature = crypto.createSign('RSA-SHA256')
    .update(unsigned)
    .sign(account.private_key, 'base64url');
  const assertion = unsigned + '.' + signature;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error('Google OAuth token exchange failed with HTTP ' + response.status + '.');
  }

  cachedToken = {
    email: account.client_email,
    project: account.project_id,
    value: payload.access_token,
    expiresAt: now + Math.max(60, Number(payload.expires_in) || 3600) * 1000
  };
  return cachedToken.value;
}

function notificationLogKey(eventKey, token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
  return 'fcm:' + String(eventKey).slice(0, 150) + ':' + tokenHash;
}

async function sendAdminPush(db, event, env = process.env) {
  let account;
  try {
    account = readServiceAccount(env);
  } catch (error) {
    console.error('[ADMIN-PUSH] Configuration error:', error.message);
    return { skipped: true, reason: 'invalid_configuration' };
  }
  if (!account) {
    // Push remains dormant until the service-account file is configured on the VPS.
    return { skipped: true, reason: 'not_configured' };
  }

  const devices = db.prepare(
    'SELECT token FROM admin_push_tokens WHERE active=1 ORDER BY created_at'
  ).all();
  if (!devices.length) return { skipped: true, reason: 'no_registered_devices' };

  let bearer;
  try {
    bearer = await accessToken(account);
  } catch (error) {
    console.error('[ADMIN-PUSH] Authorization failed:', error.message);
    return { failed: true, reason: 'authorization_failed' };
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const device of devices) {
    const token = String(device.token || '');
    const eventKey = notificationLogKey(event.key || 'event', token);
    const existing = db.prepare(
      'SELECT status FROM notification_log WHERE event_key=?'
    ).get(eventKey);
    if (existing && ['Sent', 'Pending'].includes(existing.status)) {
      skipped++;
      continue;
    }

    if (existing) {
      db.prepare(
        "UPDATE notification_log SET recipient=?,status='Pending',error='' WHERE event_key=?"
      ).run('admin-device:' + eventKey.slice(-16), eventKey);
    } else {
      db.prepare(
        "INSERT INTO notification_log(channel,event_key,recipient,status) VALUES('fcm',?,?, 'Pending')"
      ).run(eventKey, 'admin-device:' + eventKey.slice(-16));
    }

    try {
      const response = await fetch(FCM_BASE + encodeURIComponent(account.project_id) + '/messages:send', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + bearer,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildMessage(token, event))
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        db.prepare(
          "UPDATE notification_log SET status='Sent',sent_at=CURRENT_TIMESTAMP,error='' WHERE event_key=?"
        ).run(eventKey);
        sent++;
        continue;
      }

      const errorCode = result.error?.details?.map(x => x.errorCode || '').find(Boolean) || '';
      const message = String(result.error?.message || ('FCM HTTP ' + response.status)).slice(0, 300);
      db.prepare(
        "UPDATE notification_log SET status='Failed',error=? WHERE event_key=?"
      ).run(message, eventKey);

      if (errorCode === 'UNREGISTERED' || (response.status === 404 && /not.?registered|unregistered/i.test(message))) {
        db.prepare('DELETE FROM admin_push_tokens WHERE token=?').run(token);
      }
      failed++;
      console.error('[ADMIN-PUSH] FCM send failed:', 'HTTP ' + response.status, errorCode || 'provider_error');
    } catch (error) {
      db.prepare(
        "UPDATE notification_log SET status='Failed',error=? WHERE event_key=?"
      ).run(String(error.message || error).slice(0, 300), eventKey);
      failed++;
      console.error('[ADMIN-PUSH] Delivery request failed:', error.message || error);
    }
  }
  return { sent, skipped, failed };
}

module.exports = { isConfigured, readServiceAccount, buildMessage, sendAdminPush };
