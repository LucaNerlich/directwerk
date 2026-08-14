# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
./gradlew :directwerk-common:build
./gradlew :directwerk-common:test
./gradlew :directwerk-common:test --tests "de.pnnit.directwerk.modules.core.util.PasswordPolicyTest"
```

## Architecture

This is the root of the module graph: it has no internal Directwerk dependencies and every other module depends on it, so anything added here becomes visible everywhere — keep it limited to genuinely shared, dependency-free concerns.

- `de.pnnit.directwerk.config` — `DirectwerkProperties` (`@ConfigurationProperties`) and the `DirectwerkConfig` accessor used to read platform-wide config from any module without each module redefining its own properties class.
- `de.pnnit.directwerk.modules.core.util` — small stateless helpers shared across modules: `EmailNormalizer`, `PasswordPolicy`, `SlugNormalizer`, `TokenHashUtil`, `TenantHostname`, `TenantAssetKeys`, `EnvelopeCipher`.
- `de.pnnit.directwerk.multitenancy.TenantContext` — the actual tenant-ID holder (thread/request-scoped). This is the one piece of multitenancy plumbing that lives here rather than in `directwerk-core`, precisely because every module (including `directwerk-queue`) needs to read/propagate it without depending on the domain layer.
- `de.pnnit.directwerk.modules.email.TransactionalEmailNotifier` — a port (interface) that lets `directwerk-core` trigger emails without depending on `directwerk-email`; the real implementation (`EmailJobProducer`) lives in `directwerk-email` and is wired in by Spring at the `directwerk-app` level. This inversion is the main reason this module exists as a separate leaf rather than folding utilities into `directwerk-core`.

Despite the README saying this module "has no tests of its own," a handful of unit tests do live directly in `src/test` (e.g. `TenantContextTest`, `PasswordPolicyTest`, `EnvelopeCipherTest`, `HumanReadableDurationTest`) — pure unit tests for the utilities above. Broader integration coverage still lives in `directwerk-app`.
