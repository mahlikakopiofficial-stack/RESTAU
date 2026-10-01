# Security

## Production secrets

Never commit the production `.env`, Gmail app passwords, administrator passwords, reset tokens, signing keys, database files, or uploaded customer data.

The production deployment keeps secrets in `/var/www/resto/.env`, outside GitHub tracking.

## Reporting a security issue

Please do not publish credentials, tokens, or customer data in a public issue. Contact the repository owner privately with the affected component, reproduction steps, and relevant logs with secrets removed.

## Production safety

- Keep `ENABLE_CHECK=0` in production.
- Keep the admin portal on the dedicated admin hostname.
- Use HTTPS for both customer and admin hosts.
- Do not expose the SQLite database or upload directory through the web server.
- Review `npm audit` output before dependency upgrades that may introduce breaking changes.
