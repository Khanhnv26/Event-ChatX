# Deployment and operations

Run all commands below from the repository root. See [testing](testing.md) for rehearsal evidence.

## Self-hosted stack

Copy `.env.example` to `.env`, set the domain and matching HTTPS origin, and generate a different random hexadecimal password of at least 32 characters for each service. Hex avoids URL-escaping problems in the Mongo URI. Point DNS to the server, make ports 80/443 reachable, then run:

```sh
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
```

Caddy obtains/renews HTTPS certificates. For an isolated HTTP rehearsal, set `APP_DOMAIN=http://localhost` and `APP_ALLOWED_ORIGINS=http://localhost`. Only the proxy publishes ports; databases and backend remain on the Compose network. Existing `docker-compose.yml` is the older Redis/Rabbit development stack and uses separate volumes.

Do not use `down -v` on data you need. `docker compose -f compose.production.yaml down` preserves volumes. Keep passwords unchanged for existing volumes unless rotating credentials inside the services as well.

## Operations and recovery

`/internal/health` checks SQL, Mongo, Redis and the STOMP broker. `/internal/metrics` exposes aggregate request/error/429/latency-sum counters in Prometheus text format; these paths are blocked by the public Nginx proxy. Scrape backend:8080 inside the private network. Logs include a generated request ID, route, status and duration; request/response bodies, headers and tokens are not logged by the request filter. Disable debug/SQL logging in production. Metrics currently provide totals and latency sum, not a measured p95/SLA.

Retention runs hourly in batches of 25 rooms, only after `expiresAt + 7 days`. It deletes Mongo chat, related SQL rows, then known cache keys after commit. Mongo/SQL do not share a transaction: if SQL fails after Mongo deletion, the next run retries; already-expired chat cannot be restored without a backup. Short-lived rate-limit and presence keys expire by TTL.

Before upgrade, stop writes (`docker compose -f compose.production.yaml stop proxy frontend backend`), back up **both MySQL and Mongo** to a protected external location, record the application image IDs and verify restore in a separate Compose project. Use `mysqldump --single-transaction` and `mongodump --archive --gzip` inside their containers, passing credentials through environment/config files rather than printing them. Redis can be rebuilt except rate-limit history, presence and sequences; after a restore, rebuild sequence counters from Mongo before reopening writes, or restore Redis from the same stopped-write backup point.

Prefer restoring a complete matching snapshot for a failed schema upgrade. Do not run an older application against an incompatible new schema. Restore to new volumes first, start backend and check health/Flyway, run acceptance tests, then reopen the proxy. Backups contain private chat and tokens/hashes and need encryption/access control and a deletion policy. This repository does not configure an external backup destination or run a restore drill automatically.

## Privacy and limits

Host tokens are bearer secrets stored in the browser session. V1 has no account recovery. Kick revokes an existing session, not an anonymous person's ability to create a new identity when joins remain open. Closed/expired rooms are read-only while retained. Host exports may outlive server retention. Socket presence refreshes every 5 seconds and is shown with up to 10 seconds UI delay; process crashes expire after 30 seconds.

Public production acceptance still requires domain/TLS, backups/restore, multi-browser behavior, measured load and failure recovery on the actual deployment environment. Local tests are not a production capacity guarantee.

The Compose network uses `172.28.240.0/24`, with Nginx/Caddy at `.10`/`.11`. Those exact addresses are trusted by the backend IP resolver; incoming untrusted X-Forwarded-For is not trusted directly. If this subnet conflicts on your host, change the subnet, both static addresses and the trusted proxy list together. API responses carry `Cache-Control: no-store` and `X-Request-Id`.
