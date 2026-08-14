# directwerk-app

Spring Boot application entrypoint: HTTP API, security, configuration, database migrations, and tests.

## Contents

| Area | Package / path | Description |
|------|----------------|-------------|
| Bootstrap | `DirectwerkApplication` | `@SpringBootApplication` — scans all `de.pnnit.directwerk.*` modules on the classpath |
| HTTP | `controller.*`, `api.*` | REST controllers, DTOs, global exception handler |
| Security | `security.*` | OAuth2 authorization server, JWT resource server, filters, password grant |
| Config | `config.*` | JPA auditing, dev seed data, prod property validators |
| Multitenancy | `multitenancy.TenantContextFilter` | Request-scoped tenant resolution (servlet layer) |
| Resources | `src/main/resources/` | `application*.yaml`, Flyway migrations, email templates |
| Tests | `src/test/` | Full test suite (113 tests) |

Produces the runnable fat JAR: `build/libs/directwerk-app.jar`.

## Module dependencies

```text
directwerk-common
directwerk-queue
directwerk-email
directwerk-core
directwerk-subscription
```

## Commands

From `projects/directwerk/Directwerk/`:

```sh
# Run locally (starts Compose deps when profile=local)
./gradlew :directwerk-app:bootRun

# Test + build JAR
./gradlew :directwerk-app:test :directwerk-app:bootJar

# Flyway CLI (optional; app also migrates on startup)
set -a && source .env && set +a
./gradlew :directwerk-app:flywayMigrate
```

## API testing surfaces

Controller/API changes (new endpoints, changed request/response shapes, new error codes, renamed routes)
must be reflected in [`../bruno/`](../bruno/) (Bruno collection) and [`../http/`](../http/) (JetBrains HTTP
Client harness) in the same change — both are manually maintained and don't regenerate from code.

## Docker

See [../docs/build-and-deploy.md](../docs/build-and-deploy.md) for image build and Compose stack instructions.

## Profiles

| Profile | Purpose |
|---------|---------|
| `local` | Host development with `.env` and Compose auto-start |
| `docker` | App container in Compose `stack` profile |
| `stage` / `prod` | Deployed environments (Swagger disabled in prod) |

Environment variables: [../.env.example](../.env.example).
