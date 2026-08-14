# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
./gradlew :directwerk-webhook:build
```

No test sources of its own yet; this is currently the smallest module (a `JobHandler` + a payload DTO).

## Architecture

Outbound webhook delivery, implemented as a `directwerk-queue` consumer. Depends on `directwerk-queue` and `directwerk-common`; used by `directwerk-app` only (nothing else in the module graph depends on it).

- `WebhookJobHandler` registers on `QueueNames.WEBHOOK` and is currently a **validation-only stub**: it deserializes the `WebhookJobPayload`, enforces that the target URL is well-formed HTTPS with a valid host, bounds-checks `eventType` (≤100 chars), `correlationId` (≤200 chars) and `body` (≤100,000 chars), and logs the delivery intent (host only — never the full URL, query params, or body, to avoid leaking credentials into logs). It does not yet perform the actual outbound HTTP call.
- `WebhookJobPayload` is the job payload shape: target URL, event type, optional correlation ID, optional body.

When implementing real delivery, keep the existing validation (HTTPS-only, host presence, length bounds) and the sanitized logging — those are the module's only current safeguards.
