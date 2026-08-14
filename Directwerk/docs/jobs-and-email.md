# Jobs and email

Directwerk uses a PostgreSQL job queue with pluggable handlers. Consumers include email, webhooks,
media lifecycle work, and durable RSS snapshot refresh.

## Architecture

```text
Domain service → TransactionalEmailNotifier (port) → EmailJobProducer → QueueService → jobs table
Quartz → QueueWorker → EmailJobHandler → TransactionalEmailService → EmailSender (smtp | none | future ESP)
```

Domain modules never call SMTP, Mailgun, or `QueueService` for mail. To switch providers, implement
`EmailSender` and add a `case` in `EmailSenderConfig`. Jobs, templates, and notifiers stay the same.

| `DIRECTWERK_EMAIL_PROVIDER` | Behaviour |
|-----------------------------|-----------|
| `smtp` (default) | Spring Mail — Mailpit locally, Mailgun SMTP or any relay in stage/prod |
| `none` | Templates and queue code stay; enqueue/send stay off even if `ENABLED=true` |

HTTP ESPs (Mailgun API, Resend, …) are not wired yet. Add an `EmailSender` implementation and extend
the `none|smtp` allow-list when one is chosen. Do not put API keys in frontend or logs.

## Adding a new queue

1. Add a constant to `QueueNames` (optional, for discoverability).
2. Implement `JobHandler` in a module and register it as a Spring `@Component`.
3. The queue name is allowed automatically via `JobHandlerRegistry` — no YAML allow-list.

Optional per-queue tuning: override `JobHandler#settings()` for lease, retry delay, or max attempts.

Registered queues today: `email`, `webhook`, and `rss-feed-refresh`, plus `media-s3-delete` and
`media-cdn-purge` when storage is enabled. Media delete is authorized on the HTTP path
(`PENDING_DELETE`), then S3 removal and CDN purge run as separate jobs. RSS refresh is requested
after content or entitlement transactions commit and preserves the previous XML on failure.
Queued RSS refresh jobs with the same tenant correlation id are coalesced; an in-flight rebuild
still accepts one follow-up job.

## Adding a new transactional email

1. Add an `EmailTemplate` enum entry and HTML under `directwerk-email/src/main/resources/email/`.
2. Add a method to `TransactionalEmailNotifier` and a facade on `EmailJobProducer`.
3. Domain code calls the notifier — not `QueueService` directly.

Payload shape:

```json
{
  "template": "PASSWORD_RESET",
  "to": "user@example.com",
  "variables": { "expiresIn": "1 hour" },
  "token": "enc:v1:…"
}
```

Token-bearing templates encrypt bearer tokens before queue persistence. URLs are built at send time in `EmailJobHandler`.

## Platform admin enqueue API

`POST /api/v1/platform/queue/jobs` is for operational recovery only. It bypasses typed producer validation and token encryption — use typed producers in application code.

## Horizontal scaling

Run multiple app instances against the same database. Set a stable `DIRECTWERK_QUEUE_WORKER_ID` per pod if you need predictable worker names in logs/admin UI.

## Retention

- Terminal jobs: `directwerk.queue.retention-days` (default 7)
- Email delivery dedup records: `directwerk.email.delivery-retention-days` (default 7)
