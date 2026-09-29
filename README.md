# PinoyAmbula — Filipino Restaurant Website
Node + Express + SQLite. Pages: `index.html` (site), `account.html` (customer), `admin.html` (dashboard), `check.html` (function check).

## One-command deploy (fresh Ubuntu droplet, run as root)
    curl -fsSL https://raw.githubusercontent.com/mahlikakopiofficial-stack/RESTAU/main/deploy.sh | REPO=https://github.com/mahlikakopiofficial-stack/RESTAU.git DOMAIN=pinoyambulakw.duckdns.org EMAIL=you@mail.com bash
Omit `DOMAIN`/`EMAIL` to serve over the droplet IP without HTTPS. Re-run the same command to update. Private repo: use `REPO=https://TOKEN@github.com/mahlikakopiofficial-stack/RESTAU.git` and copy `deploy.sh` to the droplet instead of curl.

## Run locally
    npm install && cp .env.example .env   # edit .env
    npm start   # http://localhost:3000  → open /check.html

## Deploy on DigitalOcean (Ubuntu 22.04 droplet)
    apt update && apt install -y build-essential python3 git nginx ufw
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs && npm i -g pm2
    ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
    git clone https://github.com/mahlikakopiofficial-stack/RESTAU.git /var/www/resto && cd /var/www/resto
    npm ci --omit=dev && cp .env.example .env && nano .env      # set SECRET + ADMIN_PASSWORD
    pm2 start server.js --name resto && pm2 save && pm2 startup

Nginx `/etc/nginx/sites-available/resto` (then `ln -s` into sites-enabled, `nginx -t && systemctl reload nginx`):

    server { listen 80; server_name YOUR_DOMAIN; client_max_body_size 6m;
      location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; } }

HTTPS: `apt install -y certbot python3-certbot-nginx && certbot --nginx -d YOUR_DOMAIN`

## Update after changes
    cd /var/www/resto && git pull && npm ci --omit=dev && pm2 restart resto

`data/` (database) and `uploads/` (photos) are git-ignored, so pulls never overwrite them. Back them up (DigitalOcean snapshots or `rsync`).

## Function check page
`/check.html` creates `__TEST__` records. Production deploys keep this route disabled (`ENABLE_CHECK=0`), including on updates. To run it, enable it only on a trusted staging deployment, restart the app, and disable it again before public use.

## Settings live in the database
`.env` values (RESTO_NAME, CURRENCY, DELIVERY_FEE) only seed the **first** run. After that change them in **Admin → Settings** (name, phone, hours, delivery fee, minimum order, open/closed switch, homepage text + banner photo). Plan names/prices: **Admin → Plans**.
With `NODE_ENV=production` the server refuses to start with a weak `SECRET` or a default admin password.

## Backups (daily, keep 14 days)
    apt install -y sqlite3 && mkdir -p /var/backups/resto
    crontab -e   # add:
    0 3 * * * sqlite3 /var/www/resto/data/resto.db ".backup '/var/backups/resto/db-$(date +\%F).db'" && tar czf /var/backups/resto/uploads-$(date +\%F).tgz -C /var/www/resto uploads && find /var/backups/resto -mtime +14 -delete
Also enable DigitalOcean droplet backups for a second copy.

## Payments
Cash on Delivery is live. Card is **off by default** (no gateway connected): turn it on in Admin → Settings only after a payment gateway is integrated.
