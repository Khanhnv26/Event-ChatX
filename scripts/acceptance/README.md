# Disposable-stack acceptance scripts

Run from the repository root with Node.js 24. These scripts create test rooms and write data; use a disposable stack, never a production database.

The default target is `http://localhost:18080`. Set `EVENTCHAT_ACCEPTANCE_URL` explicitly to use a different rehearsal URL. Start a rehearsal stack using the [deployment guide](../../docs/deployment.md); use a separate Compose project/volumes and expose its proxy on port 18080.

```sh
node scripts/acceptance/run.mjs
node scripts/acceptance/capacity.mjs
node scripts/acceptance/load-smoke.mjs
node scripts/acceptance/redis-failure.mjs
```

- `run.mjs`: REST/STOMP authorization, messages/replies, polls, wheels, decisions, export, join locking and revocation.
- `capacity.mjs`: prepares 49 sessions while respecting rate limits, races eight requests for the final slot, then checks 50 authenticated sockets/presence entries.
- `load-smoke.mjs`: 200 history reads at concurrency 10; reports latency/error metrics without claiming a production SLA.
- `redis-failure.mjs`: requires Docker access and the disposable container named `eventchat-acceptance-redis-1`. Pauses only that container, verifies write failure/read availability, then resumes it in a finally block.
- `attachments.mjs`: targets only a disposable stack on localhost:18082. Exercises multipart over 1 MiB through Caddy/Spring, 20 MiB file limits, file-only chat, retry conflicts, draft/download permissions, image signature rejection and cancellation. Creates only test rooms/files; never point it at production. The multipart version has no antivirus or image-processing worker.
- `edge.mjs`: uses that same disposable Caddy stack to verify SPA/API/SockJS routing, immutable assets, private management endpoints and the 64 KiB JSON limit.

Store reports and any local Compose/env files under `artifacts/`. See [testing results](../../docs/testing.md) for verification scope. Do not commit test credentials, screenshots or database dumps.
