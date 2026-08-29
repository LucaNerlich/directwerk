# Directwerk API

Gradle multi-module Spring Boot backend. **Run/deploy guide:**
[`docs/build-and-deploy.md`](docs/build-and-deploy.md).

## Docker Compose

Two compose files — pick the workflow you need:

| File | When | Command (from `Directwerk/`) |
|------|------|------------------------------|
| [`docker-compose.yaml`](docker-compose.yaml) | Day-to-day dev — Postgres + Mailpit only; run API on host with `./gradlew :directwerk-app:bootRun` | `docker compose up -d` |
| Same + API in Docker | API container with infra | `docker compose --profile stack up --build` |
| [`../docker-compose.full-stack.yaml`](../docker-compose.full-stack.yaml) | Prod-like — API + all frontends + docs as containers | See below |

### Full stack (API + all apps)

From the **monorepo root**, with `Directwerk/.env` configured
(`cp Directwerk/.env.example Directwerk/.env`):

```sh
docker compose --env-file Directwerk/.env -f docker-compose.full-stack.yaml up --build
```

Stop (keeps DB data): add `down` instead of `up --build`. Wipe volumes: `down -v`.

| Service | URL |
|---------|-----|
| API | http://localhost:8080 |
| directwerk-admin | http://localhost:3001 |
| directwerk-studio | http://localhost:3003 |
| directwerk-web | http://localhost:3004 |
| homepage | http://localhost:3005 |
| directwerk-docs | http://localhost:8088 |
| Mailpit | http://127.0.0.1:8025 |

Details, seeded accounts, and `/etc/hosts` for tenant demos:
[`docs/build-and-deploy.md`](docs/build-and-deploy.md) §3.1.
