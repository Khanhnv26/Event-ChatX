# EventChat

React/TypeScript + Java 21/Spring Boot. MySQL stores rooms and tools; MongoDB stores chat; Redis implements rate limits and presence; RabbitMQ relays STOMP.

- [Documentation](docs/README.md)
- [API contract](docs/api/openapi.json) and [API behavior](docs/api/README.md)
- [Tests and acceptance results](docs/testing.md)
- [Deployment, backup and operations](docs/deployment.md)

## Repository layout

```text
backend/             Spring Boot source, tests and Dockerfile
frontend/            React source, tests and Dockerfile
docs/                API, requirements, design, plans and guides
deploy/              Caddy and RabbitMQ configuration
scripts/acceptance/  Disposable-stack acceptance and load scripts
.github/workflows/   CI
artifacts/           Local generated files; ignored by Git
```

## Local development

Use Java 21, Maven and Node 24. Configure database/Redis/Mongo/Rabbit credentials using environment variables. Existing local credentials have been moved to the ignored `backend/application-secrets.properties.local`; Spring imports that file when started from `backend/`. It is deliberately excluded from Docker builds.

```sh
cd backend
mvn spring-boot:run
# Another terminal:
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` and `/ws` to port 8080. Allowed origins default to localhost:5173 and localhost:8080. Flyway applies immutable migrations V1–V6; Hibernate validates the schema. Do not manually edit Flyway history or use baseline/repair to hide drift. Use a backup before migrating an existing database.

## Self-hosted stack

See [deployment and operations](docs/deployment.md) for the complete Compose setup, environment configuration, backup and recovery procedure.

## Verification

```sh
cd backend
EVENTCHAT_TEST_REDIS=true mvn test
cd ../frontend
npm test
npm run lint
npm run build
```

The Redis opt-in requires an isolated/local Redis on port 6379, or set `EVENTCHAT_TEST_REDIS_HOST`/`PORT`. Tests clean only their own UUID keys. Windows/Mockito workarounds are documented in [docs/testing.md](docs/testing.md). CI runs backend tests with Redis and frontend test/lint/build. Full-stack rehearsal scripts are in [scripts/acceptance/](scripts/acceptance/README.md).
