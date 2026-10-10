# PinoyAmbula Admin Android App

This is a separate Android application for the restaurant admin dashboard. It does not replace or modify the customer APK. Its package ID is `kw.pinoyambula.admin`.

## What it does

- Opens the existing authenticated admin dashboard at `https://admin-pinoy-ambula.duckdns.org/admin.html`.
- Uses Firebase Cloud Messaging (FCM) to show Android system notifications for new orders, inquiries, customer messages, and subscriptions, including when the dashboard is closed.
- Opens the admin app from a push notification and routes to Orders, Inquiries, or Subscriptions after admin login.
- Registers the FCM device token only after a valid admin bearer token is present.
- Keeps notification previews generic; customer phone numbers, addresses, and message contents are not put in push payloads.

## Firebase configuration required

Do not commit Firebase service-account keys or Android signing keys.

1. In Firebase Console, create/select the Firebase project and add an **Android app** whose package name is exactly `kw.pinoyambula.admin`.
2. Set these **GitHub repository Actions Variables** for build configuration:
   - `ADMIN_FIREBASE_APP_ID`
   - `ADMIN_FIREBASE_API_KEY`
   - `ADMIN_FIREBASE_PROJECT_ID`
   - `ADMIN_FIREBASE_SENDER_ID`
3. Enable the Firebase Cloud Messaging API for that project and create a server service account with permission to send FCM messages.
4. Copy the service-account JSON to the VPS outside the repository, for example `/etc/pinoyambula/fcm-admin-service-account.json`. Restrict file access to the service user (normally root-owned and mode `600`).
5. Set `FCM_SERVICE_ACCOUNT_PATH=/etc/pinoyambula/fcm-admin-service-account.json` in the VPS `.env`, restart RESTAU, and use the authenticated admin endpoint `GET /api/admin/push/status` to check server configuration.
6. Configure separate Android signing secrets for a production admin APK:
   - `ADMIN_ANDROID_KEYSTORE_BASE64`
   - `ADMIN_ANDROID_KEYSTORE_PASSWORD`
   - `ADMIN_ANDROID_KEY_ALIAS`
   - `ADMIN_ANDROID_KEY_PASSWORD`

Until the Firebase variables and VPS service-account file exist, the app can compile in debug mode, but **background push delivery is not configured**. The release workflow deliberately refuses to publish an unconfigured app.

## Build and release

- The `Admin Android Build` workflow produces a debug APK artifact for CI/device testing.
- The `Admin Android Release` workflow creates a signed APK/AAB only when Firebase configuration and signing secrets are provided.
- The app should be tested on a real Android device, with notification permission granted, in foreground, background, and terminated states.

## Backend events

The server stores authorized admin-app FCM tokens in SQLite table `admin_push_tokens`. Push requests are asynchronous so FCM delays cannot hold up checkout or customer inquiry responses. FCM delivery attempts are recorded in `notification_log` without storing raw device tokens in log recipient fields.
