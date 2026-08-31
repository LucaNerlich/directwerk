# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
./gradlew :directwerk-core:build
```

Service and repository tests run in `directwerk-app` (no test sources of its own currently), e.g.:

```sh
./gradlew :directwerk-app:test --tests "de.pnnit.directwerk.architecture.MultiTenancyArchitectureTest"
```

## Architecture

The domain layer: tenants, users, memberships, invitations, and the feature-module gating system. Depends only on `directwerk-common`; it invokes email through the `TransactionalEmailNotifier` port declared there and has no compile-time dependency on the email or queue implementation. Depended on by `directwerk-subscription`, `directwerk-digital`, `directwerk-email`, and `directwerk-app`.

- `de.pnnit.directwerk.modules.core.entity` — JPA entities: `Tenant`, `User`, `TenantMembership`, `TenantDomain`, `TenantBranding`, `TenantModuleActivation`, `PlatformAdmin`, `InvitationToken`, `PasswordResetToken`, `PlatformAuditEvent`, plus status enums (`TenantStatus`, `UserStatus`, `MembershipStatus`, `InvitationType`, `Role`). `Auditable`/`LastModifiedAuditable`/`BaseEntity` are the shared base classes.
- `de.pnnit.directwerk.modules.core.repository` — Spring Data repositories, one per entity.
- `de.pnnit.directwerk.modules.core.service` — business logic: `TenantManagementService`, `TenantInvitationService`, `InvitationAcceptanceService`, `UserAccountService`, `UserProvisioningService`, `PasswordResetService`, `EmailVerificationService`, `TenantDomainService` (+ `DomainDnsLookup`/`DomainVerificationException`), `TenantBrandingService`, `PlatformAdminManagementService`, `ModuleManagementService`/`ModuleGateService`/`ModulePreset`, `PublicSiteConfigService`, `TenantUserQueryService`.
- `de.pnnit.directwerk.modules.core.audit` — `PlatformAuditService`/`PlatformAuditActions` for recording platform-admin actions.
- **Module gating**: `RequiresModule` (annotation) + `RequiresModuleAspect` (AspectJ `@Before` advice) intercept any annotated method/type and call `ModuleGateService.requireModule(key)`, which checks `TenantModuleActivationRepository` for the current `TenantContext` tenant and throws `ModuleNotEnabledException` if the feature isn't active for that tenant. Other modules (e.g. `directwerk-subscription`) apply `@RequiresModule` to gate their own write paths without depending on this aspect's internals.
- **Multitenancy** (`de.pnnit.directwerk.multitenancy`): `TenantResolver`/`CachedTenantHostResolver` resolve a request Host to a `Tenant`; `TenantOwned` marks tenant-scoped entities; `TenantWriteGuardListener` is a JPA `@PrePersist`/`@PreUpdate` listener that rejects any write of a `TenantOwned` entity whose tenant doesn't match the current `TenantContext` (platform paths clear the context first, so cross-tenant platform writes are intentionally allowed); `TenantHibernateFilterEnabler` wires the Hibernate tenant filter. Note: the servlet-layer piece that actually sets `TenantContext` per HTTP request (`TenantContextFilter`) intentionally lives in `directwerk-app`, not here — this module only provides the primitives.
- `de.pnnit.directwerk.security` (subset shared beyond `directwerk-app`) — `DirectwerkUserPrincipal`, `SecurityUtils`, `RoleConstants`, `CurrentTenantMembershipService`.

When adding a new tenant-scoped entity, implement `TenantOwned` so the write guard and Hibernate filter apply automatically; when adding a new gated capability, add a module key and check it via `@RequiresModule` rather than hand-rolling the enablement check.
