---
title: Email & background jobs
description: Postgres job queue, transactional email, and worker scaling for operators.
outline: deep
---

<!-- source: Directwerk/docs/jobs-and-email.md -->

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

Registered queues today: `email`, `content-notify`, `stripe-webhook`, `podcast-rss-feed-refresh`,
`article-rss-feed-refresh`, plus `media-s3-delete`, `media-cdn-purge`, `media-staging-cleanup`, and
`remote-asset-ingest` when storage is enabled. Media delete is authorized on the HTTP path
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

## Content notify (`EMAIL_NOTIFY`)

Publish with `notifySubscribers: true` (studio checkbox when `emailNotifyAvailable`) goes through:

```text
PublicationWorkflow → ContentPublishedNotifier → content-notify job
  → ContentNotifyJobHandler
      EPISODE → opted-in ACTIVE members → CONTENT_EPISODE_PUBLISHED email jobs
      ARTICLE → ACTIVE newsletter lists → NEWSLETTER_ARTICLE_PUBLISHED email jobs
```

Gates (any miss = no send, first-publish claim not burned for article empty/ARCHIVED-only lists):

1. Platform email delivery enabled (`DIRECTWERK_EMAIL_PROVIDER=smtp` and transport configured)
2. Tenant module `EMAIL_NOTIFY`
3. Episode: membership `emailNotificationsEnabled`; article: at least one **ACTIVE** attached newsletter list
4. One-shot `email_notified_at` claim (retries use per-recipient markers)

### Deep links

`PublicContentUrlResolver` builds absolute `contentUrl` / preferences / unsubscribe URLs with the
default locale prefix (`/de/...`, matching `directwerk-web` `app/[lang]`). RSS item links stay
unprefixed via `PublicContentPaths.episodePath` / `articlePath`. Prefer a verified primary host;
without one, content URLs fall back to `DIRECTWERK_EMAIL_STUDIO_BASE_URL` (point that at the
**public web** origin when testing notify without a custom domain). Loopback hosts use `http://`.

Template variables:

| Template | Deep link | Footer |
|----------|-----------|--------|
| `CONTENT_EPISODE_PUBLISHED` | `{{contentUrl}}` | `{{preferencesUrl}}` |
| `NEWSLETTER_ARTICLE_PUBLISHED` | `{{contentUrl}}` | `{{unsubscribeUrl}}` (token injected at send) |

Local verification: Mailpit (`http://127.0.0.1:8025`) — do not send real Mailgun from agents. Bruno
`11-Articles/6b` / `09-Podcast-Content/.../8b` plus `http/24-articles.http` cover the publish body;
attach an ACTIVE newsletter list before article notify.

### Studio notify preview & recovery

Creators see audience size and last-send status before checking notify-on-publish:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/episodes/{id}/notify-preview` | Opted-in member count, `emailNotifiedAt`, latest `content-notify` job |
| `GET /api/v1/articles/{id}/notify-preview` | Deduped ACTIVE-list recipients + same job fields |
| `POST /api/v1/episodes/{id}/notify` | Send/retry for a **PUBLISHED** episode (clears one-shot claim; markers keep addresses unique) |
| `POST /api/v1/articles/{id}/notify` | Same for articles (requires ≥1 ACTIVE list) |

`canRetry` is true when EMAIL_NOTIFY is available, the item is published, audience exists, and the
latest content-notify job is not in flight — and either never sent, claim orphaned, or job
`FAILED`. Studio surfaces this under the publish checkbox (draft) and as status + retry when
published. Bruno `8c`/`8d` and `6c`/`6d`; http names `notifyPreview*` / `notify*Subscribers`.

## Platform admin enqueue API

`POST /api/v1/platform/queue/jobs` is for operational recovery only. It bypasses typed producer validation and token encryption — use typed producers in application code.

## Horizontal scaling

Run multiple app instances against the same database. Set a stable `DIRECTWERK_QUEUE_WORKER_ID` per pod if you need predictable worker names in logs/admin UI.

## Retention

- Terminal jobs: `directwerk.queue.retention-days` (default 7)
- Email delivery dedup records: `directwerk.email.delivery-retention-days` (default 7)
