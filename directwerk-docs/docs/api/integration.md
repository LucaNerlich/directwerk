---
title: API integration guide
description: Integrate with the Directwerk REST API — tenancy, auth, response envelope, and error codes.
outline: deep
---

# API integration guide

Directwerk exposes a versioned REST API at `/api/v1/**`. The OpenAPI spec is available at runtime and as a checked-in artifact for this docs site.

| Resource | Location |
|----------|----------|
| **OpenAPI JSON (checked in)** | `directwerk-docs/docs/openapi/directwerk-api.json` |
| **Export command** | `./Directwerk/gradlew :directwerk-app:exportOpenApi` |
| **Live spec** | `GET /v3/api-docs` on your API instance |
| **Swagger UI** | `/swagger-ui.html` (local, stage, docker — disabled in prod) |
| **Interactive reference** | [OpenAPI reference](/api/reference/) (this docs site) |
| **Manual test harnesses** | `Directwerk/bruno/` and `Directwerk/http/` |

Refresh the checked-in spec when controllers change:

```sh
./Directwerk/gradlew :directwerk-app:exportOpenApi
pnpm --filter directwerk-docs build
```

The spec is produced by **springdoc** from the live Spring context (controllers, security, DTOs) — the docs site cannot parse Java sources directly. The Gradle task boots a test-profile context and writes the same JSON as `/v3/api-docs`.

## Base URL and versioning

All product endpoints are under `/api/v1/`. The issuer URL (`DIRECTWERK_ISSUER`) is the OAuth2 authorization server base — typically the same host as the API in self-hosted deployments.

```
https://api.example.com/api/v1/...
```

Breaking changes require a new API version prefix. Non-breaking additions ship in-place with OpenAPI updates.

## Multi-tenancy: Host header

**Tenant identity is resolved from the verified request `Host` header** — not from `X-Tenant-Id` or a tenant field in the request body.

| Rule | Detail |
|------|--------|
| Verified domains only | Only `tenant_domains` rows with `verified=true` bind traffic |
| JWT must match Host | Token `tenant_id` claim must equal the Host-resolved tenant |
| No client tenant header | Sending `X-Tenant-Id` does not authorize access |

Example — tenant-scoped request:

```http
GET /api/v1/me/episodes
Host: podcast.example.com
Authorization: Bearer eyJ...
```

Using a token issued for tenant A against tenant B's Host returns **403** with code `TENANT_MISMATCH`.

See [Multi-tenancy](/architecture/multi-tenancy) for the full request lifecycle.

## Request scopes

Paths fall into distinct scopes (see `RequestScope` in the codebase):

| Scope | Path prefixes | Auth |
|-------|---------------|------|
| **Public** | `/api/v1/public/`, `/api/v1/auth/`, `/feeds/`, actuator, OpenAPI | No JWT required |
| **Platform** | `/api/v1/platform/`, `/api/v1/webhooks/` | Platform admin JWT |
| **Member** | `/api/v1/me/**`, `/api/v1/security/**` | Any active tenant membership |
| **Tenant admin** | `/api/v1/tenant/**` | `TENANT_ADMIN` membership |
| **Editor content** | `/api/v1/media`, `/api/v1/series`, `/api/v1/episodes`, … | `EDITOR` or `TENANT_ADMIN` |

## Authentication

Directwerk is an **OAuth2 authorization server** and **JWT resource server**.

### OAuth2 clients

| Client ID | Use |
|-----------|-----|
| `directwerk-tenant-frontend` | Subscriber/creator frontends on tenant domains |
| `directwerk-platform-admin` | Platform superadmin (`directwerk-admin`) |

Obtain tokens via the password grant (local/dev) or authorization code flow (production frontends). Issued JWTs include a `tenant_id` claim bound to the Host used at login.

### Using the token

```http
Authorization: Bearer <access_token>
```

Refresh tokens reload membership state via `StateValidatingOAuth2AuthorizationService`. Switching tenants requires obtaining a new token on the target Host.

### Local testing

With the local profile, seeded accounts are documented in [Local development](/install/local-development). Use Bruno collection `01-Auth` or `Directwerk/http/02-auth.http` for token acquisition examples.

## Response envelope

Successful responses wrap data:

```json
{
  "data": { ... },
  "errors": []
}
```

Errors use a structured envelope with machine-readable `code` fields:

```json
{
  "data": null,
  "errors": [
    {
      "code": "TENANT_MISMATCH",
      "message": "JWT tenant does not match Host tenant",
      "field": null
    }
  ]
}
```

Integrators should branch on `errors[0].code`, not HTTP status alone (though status codes are consistent).

## Common error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `TENANT_MISMATCH` | 403 | JWT `tenant_id` ≠ Host-resolved tenant |
| `PLATFORM_TENANT_ACCESS_DENIED` | 403 | Platform token on tenant-scoped route |
| `FEATURE_NOT_ENABLED` | 403 | Required module not active for tenant |
| `STRIPE_NOT_IMPLEMENTED` | 501 | Stripe env keys not configured |
| `UPLOAD_VALIDATION_FAILED` | 400 | Media confirm failed (missing staging object) |

RSS and feed endpoints may return **404** with `Cache-Control: no-store` instead of JSON when a module is off — podcatchers must not receive entitlement JSON errors on feed URLs.

## Feature modules

Capabilities are gated by tenant modules (`DIGITAL_CONTENT`, `PODCAST`, `PODCAST_RSS`, `SUBSCRIPTION`, `STRIPE_BILLING`, …). Disabled modules return **403** `FEATURE_NOT_ENABLED` on JSON API routes.

Module assignments are managed via platform admin API or `directwerk-admin`.

## Entitlements

Paid content access is evaluated per request via `EntitlementService`:

- **FREE** content — no subscription required
- **PAID** content — requires active subscription matching LEVEL or PACKAGE rules

See [Subscriptions & entitlements](/operators/subscriptions-and-entitlements).

Private asset URLs and private RSS enclosures use short-lived signed URLs after entitlement checks — never expose raw S3 credentials to clients.

## Webhooks

| Provider | Path |
|----------|------|
| Stripe | `POST /api/v1/webhooks/stripe` |

Webhook signatures must be verified server-side. Patreon/Steady webhooks are planned — see internal `docs/patreon-steady-integration.md`.

## CORS and browser clients

Tenant frontends (`directwerk-web`, custom sites) call the API from the browser on the same tenant domain or via configured CORS. Media uploads to S3/Bunny may require CDN-level CORS — see [Media upload](/operators/media-upload).

## Recommended integration workflow

1. Run the API locally ([Local development](/install/local-development))
2. Explore endpoints in Swagger UI or Bruno
3. Implement Host-aware token acquisition for your frontend
4. Handle `Response<T>` envelope and `errors[].code`
5. Export OpenAPI and pin your client generator to the release spec

## Next

- [OpenAPI reference](/api/reference/) — interactive endpoint documentation
- [Multi-tenancy](/architecture/multi-tenancy) — isolation model
- [Asset storage](/architecture/asset-storage) — media and signed URLs
