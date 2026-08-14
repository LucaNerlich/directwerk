# directwerk-email

Transactional email delivery via the background queue and a pluggable `EmailSender` transport.

## Contents

| Package | Description |
|---------|-------------|
| `de.pnnit.directwerk.modules.email` | `EmailJobProducer`, `EmailJobHandler`, `TransactionalEmailService`, template registry |
| `de.pnnit.directwerk.modules.email.sender` | `EmailSender` port — `SmtpEmailSender`, `NoneEmailSender` |
| `de.pnnit.directwerk.modules.email.config` | Transport selection + Quartz cleanup wiring |

`EmailJobProducer` implements `TransactionalEmailNotifier` (defined in `directwerk-common`) and enqueues generic `EmailJobPayload` jobs onto `QueueNames.EMAIL`. `EmailJobHandler` renders templates, then `TransactionalEmailService` hands a provider-agnostic `OutboundEmail` to `EmailSender`. Swap SMTP for an HTTP ESP by adding an `EmailSender` implementation and a `DIRECTWERK_EMAIL_PROVIDER` value.

HTML templates live in `src/main/resources/email/`.

## Dependencies

- `directwerk-queue`
- `directwerk-common` (transitive)

## Used by

- `directwerk-core` — via `TransactionalEmailNotifier` port
- `directwerk-app`

## Build

```sh
./gradlew :directwerk-email:build
```

Email behaviour tests run in `directwerk-app`.
