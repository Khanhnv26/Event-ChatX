# Deployment and operations

Run all commands below from the repository root. See [testing](testing.md) for rehearsal evidence.

## Self-hosted stack

Copy `.env.example` to `.env`, set the domain and matching HTTPS origin, and generate a different random hexadecimal password of at least 32 characters for each service. Hex avoids URL-escaping problems in the Mongo URI. Point DNS to the server, make ports 80/443 reachable, then run:

```sh
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml up -d --build --remove-orphans
docker compose -f compose.production.yaml ps
```

Caddy in the frontend container obtains/renews HTTPS certificates. For an isolated HTTP rehearsal, set `APP_DOMAIN=http://localhost` and `APP_ALLOWED_ORIGINS=http://localhost`. Only frontend publishes application ports 80/443; databases, backend and management port 9090 remain on the Compose network. Grafana separately publishes port 3000; restrict that port to your administrative network. Existing `docker-compose.yml` is the older Redis/Rabbit development stack and uses separate volumes.

Do not use `down -v` on data you need. `docker compose -f compose.production.yaml down` preserves volumes. Keep passwords unchanged for existing volumes unless rotating credentials inside the services as well.

## Operations and recovery

`/internal/health` checks SQL, Mongo, Redis and the STOMP broker. Actuator exposes `/actuator/prometheus` on private port 9090; Prometheus scrapes backend:9090 without publishing that port on the host. Only the prometheus actuator endpoint is exposed. Caddy blocks both `/internal/*` and `/actuator/*`. Micrometer supplies HTTP counters/histograms, JVM, CPU and connection-pool metrics; Grafana computes p50/p95/p99 from HTTP histogram buckets over five minutes. Logs retain generated request IDs, route, status and duration without bodies, headers or tokens. Disable debug/SQL logging in production. Histograms make latency measurable; they are not a measured capacity/SLA guarantee.

Retention runs hourly in batches of 25 rooms, only after `expiresAt + 7 days`. It deletes Mongo chat, related SQL rows, then known cache keys after commit. Mongo/SQL do not share a transaction: if SQL fails after Mongo deletion, the next run retries; already-expired chat cannot be restored without a backup. Short-lived rate-limit and presence keys expire by TTL.

Before upgrade, stop writes (`docker compose -f compose.production.yaml stop frontend backend`), back up **both MySQL and Mongo** to a protected external location, record the application image IDs and verify restore in a separate Compose project. Use `mysqldump --single-transaction` and `mongodump --archive --gzip` inside their containers, passing credentials through environment/config files rather than printing them. Redis can be rebuilt except rate-limit history, presence and sequences; after a restore, rebuild sequence counters from Mongo before reopening writes, or restore Redis from the same stopped-write backup point.

Prefer restoring a complete matching snapshot for a failed schema upgrade. Do not run an older application against an incompatible new schema. Restore to new volumes first, start backend and check health/Flyway, run acceptance tests, then reopen the proxy. Backups contain private chat and tokens/hashes and need encryption/access control and a deletion policy. This repository does not configure an external backup destination or run a restore drill automatically.

## Privacy and limits

Host tokens are bearer secrets stored in the browser session. V1 has no account recovery. Kick revokes an existing session, not an anonymous person's ability to create a new identity when joins remain open. Closed/expired rooms are read-only while retained. Host exports may outlive server retention. Socket presence refreshes every 5 seconds; CONNECT and presence-change notifications trigger an immediate UI refresh, with polling every 10 seconds as fallback. Process crashes expire after 30 seconds. Before a successful presence response, the UI shows an unknown/updating state rather than claiming offline.

Public production acceptance still requires domain/TLS, backups/restore, multi-browser behavior, measured load and failure recovery on the actual deployment environment. Local tests are not a production capacity guarantee.

The frontend image now contains Caddy and the React build: browser → Caddy → backend. There is no separate proxy container. Build it from the repository root with `docker build -f frontend/Dockerfile .`; Compose and CI use this context. `APP_DOMAIN` selects the public domain; use `:80` only for disposable local rehearsal. Deploy with `docker compose -f compose.production.yaml up -d --build --remove-orphans` so the old proxy container releases ports 80/443. Existing caddy_data/caddy_config volumes remain in use for certificates. For prebuilt images use --no-build instead of --build.

The Compose network uses `172.28.240.0/24`, with only Caddy at `.10`. Only this exact address is trusted by the backend IP resolver; Caddy replaces untrusted incoming X-Forwarded-For. If this subnet conflicts, change the subnet, Caddy static address and trusted proxy list together. API responses retain `Cache-Control: no-store` and `X-Request-Id`. JSON/WebSocket HTTP request bodies are limited to 64 KiB; multipart uploads to 21 MiB, with Spring still limiting files to 20 MiB (images 5 MiB). Fingerprinted assets have immutable caching; SPA routes fall back to index.html and API/WS routes never do.
