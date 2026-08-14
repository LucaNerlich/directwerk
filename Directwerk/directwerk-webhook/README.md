# directwerk-webhook

Outbound webhook delivery jobs (retry queue consumer).

## Contents

| Package | Description |
|---------|-------------|
| `de.pnnit.directwerk.modules.webhook` | `WebhookJobHandler`, payload DTO |

Registers on `QueueNames.WEBHOOK`. The handler is a stub that validates payloads and logs delivery intent until outbound HTTP is implemented.

## Dependencies

- `directwerk-queue`

## Used by

- `directwerk-app`

## Build

```sh
./gradlew :directwerk-webhook:build
```
