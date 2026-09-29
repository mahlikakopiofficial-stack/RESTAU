# PinoyAmbula: one setup for web + mobile

PinoyAmbula uses one source of truth for the restaurant.

## Single source of truth

The website, installable PWA, and future Android/iPhone package use:

- the same public/ customer interface
- the same Node.js API
- the same SQLite database
- the same Admin dashboard
- the same customer accounts
- the same menu and subscription plans
- the same orders, delivery status and chat
- the same Gmail notification system

Restaurant information is entered once in Admin.

## Shared runtime configuration

public/runtime-config.js contains the API origin used by browser and mobile clients.

When the proper production domain replaces the temporary DuckDNS hostname, update that file once and redeploy the web/PWA. A native package must then be rebuilt so its bundled runtime configuration matches the new domain.

## PWA

The web app includes:

- public/manifest.json
- public/sw.js
- public/pwa.js
- 192px and 512px app icons

The PWA is the first mobile installation target because it uses the same web client and backend.

## Native package

capacitor.config.ts is prepared for Capacitor with the existing public/ folder as the web asset directory.

Native build tooling should be installed and run on a development machine or CI environment, not on the production Droplet.

The intended native workflow is:

  npm install @capacitor/cli @capacitor/core
  npm install @capacitor/android @capacitor/ios
  npx cap add android
  npx cap add ios
  npx cap sync

The native projects use the same public/ code and therefore the same API and Admin data.

## Operational rule

Use Admin for restaurant content and daily operations.

Use GitHub for software changes.

Do not create a second mobile database, second menu, second settings system, or second order backend.
