# directwerk-common

Shared configuration and cross-cutting utilities used by every other Directwerk module.

## Contents

| Package | Description |
|---------|-------------|
| `de.pnnit.directwerk.config` | `DirectwerkProperties` (`@ConfigurationProperties`) and `DirectwerkConfig` accessor |
| `de.pnnit.directwerk.modules.core.util` | `EmailNormalizer`, `PasswordPolicy`, `SlugNormalizer`, `TokenHashUtil`, `TenantHostname` |

## Dependencies

None (library root of the module graph).

## Used by

All other Directwerk Gradle modules.

## Build

From `Directwerk/`:

```sh
./gradlew :directwerk-common:build
```

This module has no tests of its own; coverage lives in `directwerk-app`.
