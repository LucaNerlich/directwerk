# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
./gradlew :directwerk-email:build
```

Email behaviour is exercised via integration tests in `directwerk-app` (no test sources of its own currently) — run those when changing anything here, e.g.:

```sh
./gradlew :directwerk-app:test --tests "*Email*"
```

## Architecture

Transactional and content email delivery, built on top of `directwerk-queue`'s background job mechanism plus a pluggable `EmailSender` (SMTP today). Depends on `directwerk-queue`, `directwerk-common`, and `directwerk-core` for tenant content templates. It implements the `TransactionalEmailNotifier` port defined in `directwerk-common`, so `core` can request transactional email without depending on this module directly.

- `EmailJobProducer` implements `TransactionalEmailNotifier` and enqueues generic `EmailJobPayload` jobs onto `QueueNames.EMAIL` — this is the module boundary: callers ask for an email to be sent, they don't touch SMTP, an ESP, or templates directly.
- `EmailJobHandler` is the `JobHandler` that consumes `QueueNames.EMAIL` jobs, resolves the template, and calls `TransactionalEmailService`.
- `EmailSender` is the transport port (`SmtpEmailSender`, `NoneEmailSender`). Select with `DIRECTWERK_EMAIL_PROVIDER`. Add a new implementation to switch ESPs without changing jobs or domain notifiers.
- `EmailTemplate` is an enum of the known transactional emails (`TENANT_INVITATION`, `PLATFORM_ADMIN_INVITATION`, `PASSWORD_RESET`, `EMAIL_VERIFICATION`), each mapping to a classpath HTML path, a subject template, and an optional `EmailTokenLink` (which page/token flow the email's call-to-action link points at). Adding a new transactional email means adding an enum constant plus its template, not new plumbing.
- `EmailTemplateSource` is the abstraction for locating template content; `ClasspathEmailTemplateSource` is the only implementation today (loads from `src/main/resources/email/`), but the seam exists so tenant-specific template overrides can be added later without touching callers.
- `EmailTemplateRenderer` fills a resolved template with variables; `EmailTokenProtector`/`EmailLinkBuilder`/`EmailTokenLink` build the tokenized links embedded in emails (invite acceptance, password reset, email verification).
- `EmailDelivery` (entity) + `EmailDeliveryRepository` + `EmailDeliveryGuard` track sent/attempted deliveries, primarily to prevent duplicate sends; `EmailDeliveryCleanupService`/`EmailDeliveryCleanupJob` purge old delivery records via Quartz.

HTML templates live under `src/main/resources/email/`.
