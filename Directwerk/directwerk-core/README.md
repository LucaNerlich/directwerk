# directwerk-core

Domain layer: tenants, users, modules, invitations, and multitenancy.

## Contents

| Package | Description |
|---------|-------------|
| `de.pnnit.directwerk.modules.core.entity` | JPA entities (`Tenant`, `User`, `TenantMembership`, …) |
| `de.pnnit.directwerk.modules.core.repository` | Spring Data repositories |
| `de.pnnit.directwerk.modules.core.service` | Business services (invitations, password reset, module gating, …) |
| `de.pnnit.directwerk.modules.core` | `@RequiresModule` annotation and aspect |
| `de.pnnit.directwerk.multitenancy` | `TenantContext`, `TenantResolver`, tenant exceptions |
| `de.pnnit.directwerk.security` | Shared security types: `DirectwerkUserPrincipal`, `SecurityUtils`, `RoleConstants` |

Servlet-coupled filters (`TenantContextFilter`) intentionally live in `directwerk-app`.

## Dependencies

- `directwerk-email`
- `directwerk-queue`, `directwerk-common` (transitive)

## Used by

- `directwerk-subscription`
- `directwerk-app`

## Build

```sh
./gradlew :directwerk-core:build
```

Service and repository tests run in `directwerk-app`.
