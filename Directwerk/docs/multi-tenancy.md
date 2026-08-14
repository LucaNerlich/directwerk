# Directwerk — Multi-Tenancy

Shared-schema SaaS isolation for the Directwerk API. This document reflects **what is implemented**.

## Model

| Concern | Implementation |
|---------|----------------|
| Database | Single PostgreSQL schema; tenant-owned rows carry `tenant_id` |
| Users | Global `users` table; tenancy via `tenant_memberships` |
| Host routing | `tenant_domains.host` (unique, case-insensitive); **only `verified=true` binds traffic** |
| Auth membership | `DirectwerkUserPrincipal.tenantId` in Spring `SecurityContext` (set at login / JWT convert) |
| Request context | `TenantContext` (ThreadLocal) in `directwerk-common` — Host-derived, must match principal |
| ORM isolation | Hibernate `tenantFilter` on `TenantOwned` entities + write-path listener |
| Jobs | `QueueWorker` restores `TenantContext` from `QueueJob.tenantId` |

## Request lifecycle

1. Bearer JWT authenticated (when present) → `DirectwerkJwtAuthenticationConverter` builds
   `DirectwerkUserPrincipal` into Spring Security context (`tenant_id` claim → `principal.tenantId`)
2. `TenantContextFilter`
   - `/api/v1/platform/**` and `/api/v1/security/platform` → clear context
   - public/auth/feeds → optional Host → verified active tenant
   - other `/api/v1/**` → require verified active Host; **if authenticated**, SecurityContext
     `principal.tenantId` is required and must equal Host tenant (platform/no-tenant tokens denied)
3. `TenantMembershipGuardFilter` on tenant-scoped authenticated routes
   (`/api/v1/tenant/**`, `/api/v1/probes/**`, `/api/v1/me/**`, `/api/v1/security/**`)
   re-checks ACTIVE membership in DB via `CurrentTenantMembershipService`
   (SecurityContext principal + `TenantContext`)
4. Controllers/services use `SecurityUtils.requireTenantPrincipal()` /
   `TenantContext.requireTenantId()` (aligned after filters)
5. `finally` clears `TenantContext`

**Host is authoritative for which tenant the request is for.**  
**Spring Security principal is authoritative for which tenant membership the token was issued for.**  
Both must match. Client-supplied `X-Tenant-Id` / tenant headers / body tenant ids are **not**
supported for authorization.

## Multi-membership users

A user may hold ACTIVE memberships in tenant A and tenant B.

- Login on tenant A Host → principal/JWT `tenant_id = A`
- Login on tenant B Host → principal/JWT `tenant_id = B`
- Token for A used against Host B → `403 TENANT_MISMATCH`
- Switching tenants requires obtaining a token for the target Host (password grant / refresh under
  that Host). Refresh reloads membership via `StateValidatingOAuth2AuthorizationService`.

## Domain verification

| Bootstrap primary domain | `verified=true` at tenant create |
| Added domains | `verified=false` + `verification_token` |
| Challenge | `GET /api/v1/tenant/domains/{host}/verification` |
| Verify | DNS TXT value `directwerk-verify=<token>`, or token body when `directwerk.security.allow-token-domain-verification=true` (local) |
| Platform override | `POST /api/v1/platform/tenants/{id}/domains/{host}/verify` |

Unverified hosts do **not** resolve for login, public API, or tenant context.

## Data isolation layers

1. Host ↔ SecurityContext principal tenant mismatch → `403 TENANT_MISMATCH`
2. Platform/no-tenant principal on tenant-scoped path → `403 PLATFORM_TENANT_ACCESS_DENIED`
3. Fresh ACTIVE membership check (`CurrentTenantMembershipService`) on tenant-scoped routes
4. Hibernate filter `tenant_id = :tenantId` when context is set (`TenantHibernateFilterEnabler`)
5. `TenantWriteGuardListener` rejects persist/update with mismatched tenant
6. Service methods still use explicit `findByIdAndTenantId` (defense in depth)
7. ArchUnit: `TenantOwned` entities must have `@Filter`; tenant controllers must not depend on repositories
8. S3 key helper `TenantAssetKeys` enforces `{tenantSlug}/…` prefixes (use before any signed URL)

`TenantDomain` is intentionally **not** filtered — host uniqueness/resolution is global.

## Deploy / Host trust

- Tenant identity uses `HttpServletRequest.getServerName()`
- Set `server.forward-headers-strategy=framework` **only** when the app is exclusively behind trusted reverse proxies that overwrite `Host` / `Forwarded`
- Default is `none` (safe for direct local access)
- Rate limiting uses `directwerk.security.trusted-proxies` for `X-Forwarded-For` (empty by default)

## Background jobs

`QueueWorker` calls `TenantContext.runWithTenant(job.tenantId(), …)` around each handler. Handlers may use `TenantContext` and `@RequiresModule`. Prefer also threading `tenantId` in payloads for audit/consistency.

## Audit

`platform_audit_events` is written for tenant create/suspend/reactivate, module activate/deactivate, and domain add/verify/force-verify.

## Manual / automated checks

- Unit/IT: `TenantContextFilterTest`, `TenantHibernateFilterIT`, `TenantMembershipGuardFilterTest`,
  `CurrentTenantMembershipServiceTest`, `QueueWorkerTenantContextTest`, `MultiTenancyArchitectureTest`
- HTTP: `http/15-multi-tenant-isolation.http`
