# Contributing

Keep changes inside the existing module: controller → service interface → service/impl → repository; shared infrastructure belongs under infrastructure or common. Use DTOs at HTTP boundaries, bean validation, hashed bearer tokens, and room-scoped repository queries.

All room writes lock Room first, then the tool row, and check status/TTL. Publish notifications only after commit. Redis cache snapshots must not authorize revoked sessions. Add behavioral tests for security, concurrency and data changes; run backend tests and frontend test/lint/build before review. Add immutable Flyway migrations for schema changes. Never commit credentials or private test data.
