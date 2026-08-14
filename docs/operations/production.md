# Production 운영 절차

## 필수 외부 설정

1. Create a PostgreSQL database and retain its volume outside the application container.
2. Publish the frontend and backend behind HTTPS on fixed domains.
3. Register the exact backend callback URL in the GitLab OAuth Application: `https://API_DOMAIN/api/v1/auth/gitlab/callback`.
4. Generate a random 32-byte key, Base64 encode it, and store it as `OAUTH_TOKEN_ENCRYPTION_KEY` in a secret manager.
5. Set `FRONTEND_URL`, `FRONTEND_ORIGINS`, OAuth values, and PostgreSQL credentials in the deployment environment. Never commit the production `.env`.

The backend callback URL must exactly match `GITLAB_OAUTH_REDIRECT_URI`. `FRONTEND_ORIGINS` must contain only the public frontend origin and no wildcard.

If GitHub Connected Account linking is enabled, register the exact `GITHUB_REDIRECT_URI` as the GitHub App user authorization callback. This capability does not enable GitHub login or GitHub Repository Workspace support. App authentication additionally uses `GITHUB_APP_ID` and a read-only PEM mount; see [GitHub App configuration](../architecture/providers/github-app-configuration.md).

## 시작과 migration

```bash
docker compose -f compose.prod.yml config
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml ps
curl -fsS http://127.0.0.1:8080/actuator/health/readiness
```

Flyway migrations run before the application accepts traffic. Do not enable Hibernate schema creation in production.

현재 application migration은 V13까지다. V10은 독립적인 consent·retention index, V11은 multi-provider identity·repository 기반, V12는 GitHub account-link state, V13은 Repository Connection capability를 추가한다. 사용자 traffic을 전달하기 전에 시작 log에서 V13 적용을 확인한다.

## Reverse proxy

Terminate TLS at the load balancer or reverse proxy, forward `X-Forwarded-Proto: https`, and proxy the public API domain to `127.0.0.1:8080`. The backend production profile trusts framework-forwarded headers and issues a Secure, HttpOnly session cookie.

OAuth callbacks carry short-lived authorization `code` and `state` values in their query strings. Disable access logging for `/api/v1/auth/gitlab/callback` and `/api/v1/provider-accounts/github/callback`, or use a log format that omits query strings at **every** proxy layer. The repository-owned gateway disables these callback logs; verify the outer proxy/load balancer separately.

Expose `/actuator/health/readiness` to the load balancer. Keep `/actuator/prometheus` on a private monitoring network because it requires authentication by default.

## Staging 출시 조건

Run the read-only preflight against the deployed addresses:

```bash
FRONTEND_BASE_URL=https://study.example.com \
BACKEND_BASE_URL=https://api.study.example.com \
./scripts/staging-smoke.sh
```

This verifies the public pages, readiness, unauthenticated 401 boundary, GitLab authorize redirect and request ID header. Then complete [the two-account OAuth checklist](staging-e2e.md). Do not promote to production until real GitLab commits, cross-user permissions, reconnect and conflict handling pass.

## Sandbox 환경

The repository includes `compose.sandbox.yml`. The public gateway is the only service that should join the external proxy network; PostgreSQL and application services remain on the private Compose network.

```bash
docker compose --env-file .env.sandbox -f compose.sandbox.yml up -d --build
docker compose --env-file .env.sandbox -f compose.sandbox.yml ps
```

When App/installation authentication is enabled, mount the PEM with the optional override instead of copying it into the repository or image:

```bash
GITHUB_PRIVATE_KEY_HOST_PATH=/absolute/host/path/github-app.pem \
GITHUB_PRIVATE_KEY_UID=$(id -u) GITHUB_PRIVATE_KEY_GID=$(id -g) \
docker compose --env-file .env.sandbox \
  -f compose.sandbox.yml -f compose.github-app.yml up -d --build
```

Set `GITHUB_PRIVATE_KEY_PATH=/run/secrets/study-ing-github-app.pem` inside `backend/.env`. Keep the host PEM at mode `0600`; the optional override runs the non-root backend process as the supplied host owner UID/GID so the read-only bind remains readable without making the key world-readable. Account linking alone does not require the PEM mount while `GITHUB_REPOSITORY_ENABLED=false`. Enabling the repository flag also requires the GitHub App Setup URL and Contents read/write permission described in the [GitHub repository adapter](../architecture/providers/github-repository-adapter.md).

The default Nginx Proxy Manager upstream is `study-platform-gateway:8080`. Confirm the actual public host, TLS and outer proxy logging policy in the launch checklist.

## Backup과 restore

Create a PostgreSQL custom-format backup:

```bash
./ops/backup-postgres.sh
```

Copy backups only to encrypted storage and rotate them within **7 days**. This is the current Study-ing product-retention target, not a claim that backup infrastructure already exists. Verify provider-side lifecycle rules before launch. Test restoration on an isolated database at least monthly:

```bash
./ops/restore-postgres.sh /absolute/path/to/study-workspace-YYYYMMDDTHHMMSSZ.dump
```

Restore is destructive for objects already present in the target database. Stop backend writes or restore into a separate database first.

## Monitoring과 사고 점검

- Alert when readiness is unhealthy for more than five minutes.
- Scrape `/actuator/prometheus` and alert on elevated 5xx responses, request latency, JVM memory, and database pool exhaustion.
- Correlate backend logs with the `X-Request-ID` response header and `requestId` MDC field.
- Inspect `sync_jobs`, `in_app_notifications`, and `audit_events` when GitLab sync failures occur.
- A `429 RATE_LIMITED` response includes `Retry-After: 60`. For a multi-instance deployment, enforce a shared limit at the gateway or replace the in-process limiter with Redis.

## Log 보유와 redaction

- Retain application, gateway, container and aggregated logs for no more than **30 days** unless a specific incident requires a documented, access-limited preservation copy.
- Do not log OAuth code/state, access or refresh tokens, Authorization headers, session cookies, or private submission bodies.
- Verify the callback access-log exclusion at every proxy layer after each proxy change.
- Restrict log access to the operator and remove preserved incident logs when the incident purpose ends.

The repository cannot enforce an external hosting provider's logging lifecycle. Record the actual provider, region and configured retention in [the launch checklist](launch-checklist.md) before launch.

## 데이터 보유 job

- JDBC session timeout: 8 hours; expired-session cleanup runs every minute.
- Notifications: 90 days.
- Sync/error records: 30 days.
- Audit events: 180 days.
- Soft-deleted Workspace: 7 days.

The backend runs the database retention cleanup daily at 03:27 and the Workspace final-delete cleanup daily at 03:17. Alert on repeated scheduler failures and verify record counts during release checks.

## 보안 사고

Follow [the minimum incident-response procedure](incident-response.md). Replace all contact placeholders before production.

## Key rotation

The current encrypted OAuth rows depend on `OAUTH_TOKEN_ENCRYPTION_KEY`. Rotate it with a dual-key migration or force all users to reconnect after clearing `oauth_credentials`; replacing the key without one of these steps makes existing credentials unreadable.
