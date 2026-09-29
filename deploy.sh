#!/usr/bin/env bash
# One-command deploy/update for a fresh Ubuntu 22.04/24.04 DigitalOcean droplet. Safe to re-run (= update).
# Usage (as root):  REPO=https://github.com/YOU/filipino-resto.git DOMAIN=example.com EMAIL=you@mail.com bash deploy.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)"; exit 1; }
REPO="${REPO:-}"; DOMAIN="${DOMAIN:-_}"; EMAIL="${EMAIL:-}"; APP=/var/www/resto; PORT=3000
[ -n "$REPO" ] || [ -d "$APP/.git" ] || { echo "Set REPO=https://github.com/YOU/filipino-resto.git"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
echo "==> Installing system packages"
apt-get update -y
apt-get install -y curl git nginx ufw build-essential python3 sqlite3 ca-certificates openssl cron
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm i -g pm2
echo "==> Fetching code"
id resto >/dev/null 2>&1 || useradd -m -s /bin/bash resto
mkdir -p /var/www; [ -d "$APP" ] || mkdir "$APP"; chown resto:resto "$APP"
if [ -d "$APP/.git" ]; then su - resto -c "git -C $APP pull --ff-only"; else su - resto -c "git clone '$REPO' $APP"; fi
NEW=""
if [ ! -f "$APP/.env" ]; then
  ADMINPW=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 14)
  cat > "$APP/.env" <<ENV
PORT=$PORT
NODE_ENV=production
SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$ADMINPW
CURRENCY=${CURRENCY:-KWD}
DELIVERY_FEE=${DELIVERY_FEE:-1}
RESTO_NAME=${RESTO_NAME:-PinoyAmbula}
ENABLE_CHECK=0
ENV
  chmod 600 "$APP/.env"; NEW=1
fi
if grep -q '^ENABLE_CHECK=' "$APP/.env"; then
  sed -i 's/^ENABLE_CHECK=.*/ENABLE_CHECK=0/' "$APP/.env"
else
  printf '\nENABLE_CHECK=0\n' >> "$APP/.env"
fi
chmod 600 "$APP/.env"
chown -R resto:resto "$APP"
echo "==> Installing dependencies + starting app"
su - resto -c "cd $APP && npm install --omit=dev"
su - resto -c "cd $APP && (pm2 delete resto >/dev/null 2>&1 || true) && pm2 start server.js --name resto && pm2 save"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u resto --hp /home/resto >/dev/null 2>&1 || true
echo "==> Nginx + firewall"
cat > /etc/nginx/sites-available/resto <<NGX
server {
  listen 80; server_name $DOMAIN; client_max_body_size 6m;
  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGX
ln -sf /etc/nginx/sites-available/resto /etc/nginx/sites-enabled/resto; rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null
if [ "$DOMAIN" != "_" ] && [ -n "$EMAIL" ]; then
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos -n --redirect || echo "!! HTTPS skipped: point the domain's DNS A record to this droplet, then re-run this command."
fi
echo "==> Daily backups (03:00, keep 14 days)"
mkdir -p /var/backups/resto
cat > /etc/cron.d/resto-backup <<'CRON'
0 3 * * * root [ -f /var/www/resto/data/resto.db ] && sqlite3 /var/www/resto/data/resto.db ".backup '/var/backups/resto/db-$(date +\%F).db'" && tar czf /var/backups/resto/uploads-$(date +\%F).tgz -C /var/www/resto uploads 2>/dev/null; find /var/backups/resto -mtime +14 -delete
CRON
sleep 3
IP=$(curl -fsS -m 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || hostname -I | awk '{print $1}')
HOST=$([ "$DOMAIN" = "_" ] && echo "$IP" || echo "$DOMAIN")
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null && echo "✅ App is healthy" || echo "!! App not responding — run: su - resto -c 'pm2 logs resto --lines 30'"
echo "----------------------------------------------"
echo " Site:   http://$HOST"
echo " Admin:  http://$HOST/admin.html"
echo " Check:  disabled in production (ENABLE_CHECK=0)"
[ -n "$NEW" ] && echo " Admin password: $ADMINPW   (saved in $APP/.env)"
echo " Update later: re-run the same command."
echo "----------------------------------------------"
