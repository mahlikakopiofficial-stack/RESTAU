# PinoyAmbula — Filipino Restaurant Website
Node + Express + SQLite. Pages: `index.html` (customer site), `account.html` (customer account), and the host-protected `admin.html` (admin dashboard).

## Current production hosts
- Customer site: `https://pinoyambulakw.duckdns.org`
- Admin portal: `https://admin-pinoy-ambula.duckdns.org`

The admin hostname is intentionally separate from the customer hostname. Keep the current DuckDNS admin hostname while testing; it can be changed later through `ADMIN_HOST` when the final domain is ready.

## One-command deploy/update
Run as root on the DigitalOcean Ubuntu droplet:

    REPO=https://github.com/mahlikakopiofficial-stack/RESTAU.git DOMAIN=pinoyambulakw.duckdns.org ADMIN_HOST=admin-pinoy-ambula.duckdns.org EMAIL=you@mail.com bash deploy.sh

The deployment script installs/keeps Node 22+, pulls `origin/main`, runs syntax checks and the regression suite, starts PM2, configures Nginx for both hosts, and attempts HTTPS when DNS resolves. Re-run it after a GitHub update to synchronize production with `main`.

## Run locally
    npm install && cp .env.example .env   # edit .env
    npm start   # http://localhost:3000

## DigitalOcean production setup
The production application runs from `/var/www/resto` under the `resto` Linux user. PM2 runs the Node/Express server on `127.0.0.1:3000`; Nginx provides the public HTTPS endpoints.

Node 22+ is required by the application and Capacitor configuration.

## Environment
`.env.example` is the safe template. Never commit the real `.env`, passwords, Gmail app passwords, or signing secrets.

Important production values include:

    RESTO_NAME=PinoyAmbula
    PUBLIC_BASE_URL=https://pinoyambulakw.duckdns.org
    ADMIN_HOST=admin-pinoy-ambula.duckdns.org
    GMAIL_FROM_NAME=PinoyAmbula

The database-backed restaurant name is also managed from **Admin → Settings** after the first initialization.

## Update after GitHub changes
Recommended production synchronization:

    cd /var/www/resto
    su - resto -c 'cd /var/www/resto && git fetch origin && git reset --hard origin/main'
    su - resto -c 'cd /var/www/resto && npm install --omit=dev'
    su - resto -c 'cd /var/www/resto && npm run check'
    su - resto -c 'cd /var/www/resto && npm test'
    systemctl restart pm2-resto.service

Then verify:

    curl -fsS https://pinoyambulakw.duckdns.org/api/health
    curl -fsS https://admin-pinoy-ambula.duckdns.org/api/health
    su - resto -c 'pm2 status'

This keeps the customer site, admin portal, server code, tests, and runtime on the same Git commit.

## Function check page
`/check.html` creates `__TEST__` records. Production deploys keep this route disabled (`ENABLE_CHECK=0`). Only enable it on a trusted staging deployment.

## Admin portal
The admin dashboard is served only when the request hostname matches `ADMIN_HOST` (or `admin.localhost` for local development). In production, `/admin.html` on the customer hostname is blocked.

Admin areas include orders, menu, gallery, customers, subscriptions, inquiries, newsletter, testimonials, plans, and settings.

## Password reset email
Customer password reset uses the Gmail provider configured through environment variables. The admin portal can request a secure password-reset email for a customer with a valid email address.

## Backups
`data/` (SQLite database) and `uploads/` (photos) are git-ignored, so GitHub deployments do not overwrite production data. Keep daily database/uploads backups and DigitalOcean droplet backups.

## Payments
Cash on Delivery is live. Card selection is stored but a real card charge requires a payment gateway integration.
