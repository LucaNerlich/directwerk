# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
./gradlew :directwerk-queue:build
./gradlew :directwerk-queue:test
./gradlew :directwerk-queue:test --tests "de.pnnit.directwerk.modules.queue.QueueWorkerTenantContextTest"
```

## Architecture

PostgreSQL-backed background job queue with Quartz-driven polling and cleanup. Depends only on `directwerk-common`; consumed by `directwerk-email` (mail jobs), plus `directwerk-app` (admin HTTP API and integration tests).

- `de.pnnit.directwerk.modules.queue` — the core queue API: `QueueService` (enqueue/claim/complete), `QueueRepository`, `QueueWorker` (claims and dispatches leased jobs), `QueueJob`/`JobEnqueueMetadata`/`JobListPage`/`JobListQuery` DTOs, `JobStatus`.
- `JobHandler` is the extension point: any module implements it to consume a named queue (`queueName()` + `handle(QueueJob)`), and can override lease duration, retry delay, and max attempts via `settings()`. `JobHandlerRegistry` collects all `JobHandler` beans at startup — **the set of valid queue names is derived from whichever handlers are registered on the classpath**, not a static list, so adding a new queue means adding a new `JobHandler` bean in the owning module, not editing this module.
- `QueueNames` holds the canonical name constants for handlers that ship in this repo (`EMAIL`, `WEBHOOK`); other modules' handlers reference these or add their own constants.
- `de.pnnit.directwerk.modules.queue.config` — Quartz job/trigger wiring, active only when the queue is enabled.
- `de.pnnit.directwerk.modules.queue.quartz` — `QueuePollJob` (periodically claims and runs due jobs) and `QueueCleanupJob` (purges old completed/failed jobs via `QueueCleanupService`).

Jobs persist in the `jobs` table (Flyway migrations owned by `directwerk-app`, not this module). When running multiple app instances, each needs a distinct `DIRECTWERK_QUEUE_WORKER_ID` so leases don't collide. Application code should prefer typed producers (like `directwerk-email`'s `EmailJobProducer`) over the raw `POST /api/v1/platform/queue/jobs` admin endpoint.
