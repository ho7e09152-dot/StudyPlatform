# Sandbox deployment

The public sandbox is served from `https://sandbox.withroro.com` through the
existing Nginx Proxy Manager network. The frontend runs in demo mode until a
GitLab OAuth application is configured.

```bash
docker compose --env-file .env.sandbox -f compose.sandbox.yml up -d --build
docker compose --env-file .env.sandbox -f compose.sandbox.yml ps
```

The Nginx Proxy Manager upstream is `study-platform-gateway:8080`. Only the
gateway joins the shared proxy network; PostgreSQL and the application services
remain on the private Compose network.
