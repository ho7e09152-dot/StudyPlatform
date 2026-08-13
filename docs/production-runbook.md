# Production runbook

## Required external setup

1. Create a PostgreSQL database and retain its volume outside the application container.
2. Publish the frontend and backend behind HTTPS on fixed domains.
3. Register the exact backend callback URL in the GitLab OAuth Application: `https://API_DOMAIN/api/v1/auth/gitlab/callback`.
4. Generate a random 32-byte key, Base64 encode it, and store it as `OAUTH_TOKEN_ENCRYPTION_KEY` in a secret manager.
5. Set `FRONTEND_URL`, `FRONTEND_ORIGINS`, OAuth values, and PostgreSQL credentials in the deployment environment. Never commit the production `.env`.

The backend callback URL must exactly match `GITLAB_OAUTH_REDIRECT_URI`. `FRONTEND_ORIGINS` must contain only the public frontend origin and no wildcard.

## Start and migrate

```bash
docker compose -f compose.prod.yml config
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml ps
curl -fsS http://127.0.0.1:8080/actuator/health/readiness
```

Flyway migrations run before the application accepts traffic. Do not enable Hibernate schema creation in production.

Current application migrations end at V10. V10 adds independent Privacy/minimum-age consent fields and retention cleanup indexes. Confirm the startup log reaches V10 before sending user traffic.

## Reverse proxy

Terminate TLS at the load balancer or reverse proxy, forward `X-Forwarded-Proto: https`, and proxy the public API domain to `127.0.0.1:8080`. The backend production profile trusts framework-forwarded headers and issues a Secure, HttpOnly session cookie.

The OAuth callback carries a short-lived authorization `code` and `state` in its query string. Disable access logging for the exact `/api/v1/auth/gitlab/callback` path, or use a log format that omits the query string, at **every** proxy layer. The repository-owned sandbox gateway already disables that location's access log; verify the outer Nginx Proxy Manager/load balancer separately.

Expose `/actuator/health/readiness` to the load balancer. Keep `/actuator/prometheus` on a private monitoring network because it requires authentication by default.

## Staging release gate

Run the read-only preflight against the deployed addresses:

```bash
FRONTEND_BASE_URL=https://study.example.com \
BACKEND_BASE_URL=https://api.study.example.com \
./scripts/staging-smoke.sh
```

This verifies the public pages, readiness, unauthenticated 401 boundary, GitLab authorize redirect and request ID header. Then complete [the two-account OAuth checklist](staging-e2e-checklist.md). Do not promote to production until real GitLab commits, cross-user permissions, reconnect and conflict handling pass.

## Backup and restore

Create a PostgreSQL custom-format backup:

```bash
./ops/backup-postgres.sh
```

Copy backups only to encrypted storage and rotate them within **7 days**. This is the current Study-ing product-retention target, not a claim that backup infrastructure already exists. Verify provider-side lifecycle rules before launch. Test restoration on an isolated database at least monthly:

```bash
./ops/restore-postgres.sh /absolute/path/to/study-workspace-YYYYMMDDTHHMMSSZ.dump
```

Restore is destructive for objects already present in the target database. Stop backend writes or restore into a separate database first.

## Monitoring and incident checks

- Alert when readiness is unhealthy for more than five minutes.
- Scrape `/actuator/prometheus` and alert on elevated 5xx responses, request latency, JVM memory, and database pool exhaustion.
- Correlate backend logs with the `X-Request-ID` response header and `requestId` MDC field.
- Inspect `sync_jobs`, `in_app_notifications`, and `audit_events` when GitLab sync failures occur.
- A `429 RATE_LIMITED` response includes `Retry-After: 60`. For a multi-instance deployment, enforce a shared limit at the gateway or replace the in-process limiter with Redis.

## Log retention and redaction

- Retain application, gateway, container and aggregated logs for no more than **30 days** unless a specific incident requires a documented, access-limited preservation copy.
- Do not log OAuth code/state, access or refresh tokens, Authorization headers, session cookies, or private submission bodies.
- Verify the callback access-log exclusion at every proxy layer after each proxy change.
- Restrict log access to the operator and remove preserved incident logs when the incident purpose ends.

The repository cannot enforce an external hosting provider's logging lifecycle. Record the actual provider, region and configured retention in `docs/launch-checklist.md` before launch.

## Data retention jobs

- JDBC session timeout: 8 hours; expired-session cleanup runs every minute.
- Notifications: 90 days.
- Sync/error records: 30 days.
- Audit events: 180 days.
- Soft-deleted Workspace: 7 days.

The backend runs the database retention cleanup daily at 03:27 and the Workspace final-delete cleanup daily at 03:17. Alert on repeated scheduler failures and verify record counts during release checks.

## Security incident

Follow [the minimum incident-response procedure](security/incident-response.md). Replace all contact placeholders before production.

## Key rotation

The current encrypted OAuth rows depend on `OAUTH_TOKEN_ENCRYPTION_KEY`. Rotate it with a dual-key migration or force all users to reconnect after clearing `oauth_credentials`; replacing the key without one of these steps makes existing credentials unreadable.
