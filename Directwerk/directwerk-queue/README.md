# directwerk-queue

PostgreSQL-backed background job queue with Quartz scheduling for polling and cleanup.

## Contents

| Package | Description |
|---------|-------------|
| `de.pnnit.directwerk.modules.queue` | `QueueService`, `QueueRepository`, `QueueWorker`, `JobHandlerRegistry`, job DTOs |
| `de.pnnit.directwerk.modules.queue.config` | Quartz job/trigger beans when queue is enabled |
| `de.pnnit.directwerk.modules.queue.quartz` | `QueuePollJob`, `QueueCleanupJob` |

Jobs are stored in the `jobs` table (Flyway V13, metadata V22, queued-correlation unique index in
V40). **Allowed queue names are derived from registered `JobHandler` beans** at startup — add a
handler in a module to register a new queue.

Enqueue with a `correlationId` reuses an existing `QUEUED` row for the same queue instead of
stacking duplicates. A `PROCESSING` job does not block a follow-up `QUEUED` row.

Each handler may override lease duration, retry delay, and default max attempts via `JobHandler#settings()`.

## Dependencies

- `directwerk-common`

## Used by

- `directwerk-email` — mail jobs on `QueueNames.EMAIL`
- `directwerk-webhook` — outbound webhook stub on `QueueNames.WEBHOOK`
- `directwerk-app` — HTTP admin API and integration tests

## Build

```sh
./gradlew :directwerk-queue:build
```

## Operations

- Set `DIRECTWERK_QUEUE_WORKER_ID` per instance when running multiple app pods.
- Prefer typed producers over `POST /api/v1/platform/queue/jobs` for application flows (see controller JavaDoc).
