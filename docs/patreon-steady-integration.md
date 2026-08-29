# Patreon & Steady sync — status, gaps, and implementation plan

Implementation brief for **Phase 6 / `PATREON_SYNC` + `STEADY_SYNC`**: import creators
migrating from Patreon or Steady, dual-run billing alongside Stripe, and shadow-user claim.
Complements [`../README.md`](platform-design.md#patreon-and-steady-onboarding),
[`payment.md`](payment.md) (Stripe Connect — already shipped), and
[`content-subscriptions-and-entitlements.md`](content-subscriptions-and-entitlements.md).

| | |
|---|---|
| **Status** | **Not started** — module keys seeded; `SubscriptionSource.PATREON` exists; no OAuth, webhooks, or sync jobs |
| **Modules** | `PATREON_SYNC`, `STEADY_SYNC` (both depend on `SUBSCRIPTION`; seeded in Flyway `V3`) |
| **Audience** | Backend + studio integrations UI + optional directwerk-web claim flow |
| **Related** | `README.md` Patreon section, `poc-alpha-setup.md` Phase H.2, `user-backend-implementation.md` shadow claim |

---

## Executive summary

**What works today (reuse)**

- LEVEL / PACKAGE products, `EntitlementService`, MANUAL + Stripe grants
- `Subscription.source` enum includes `PATREON`; `IMPORT` reserved for CSV / Steady until `STEADY` is added
- Module catalog + `PATREON_MIGRATOR` preset includes `PATREON_SYNC`
- Private RSS + feed builder; entitlements are **source-agnostic**

**What does not exist**

- Patreon OAuth, token storage, campaign/tier/member import
- Patreon webhook receiver + signature verification
- Steady OAuth/API token + subscription sync
- Shadow users (`User` without password) + `POST /api/v1/auth/claim`
- External product mapping (`SubscriptionProduct.external_product_id`)
- Periodic reconciliation job (6h drift check per README)
- Studio **Monetization → Integrations** connect flows
- `GET /api/v1/tenant/integrations/status` (TBD in studio doc)

**Strategic goal**

Creators stay on Patreon/Steady during **Phase A–B** (import + dual-run), move new members to
Stripe, then disconnect external billing in **Phase C**. Entitlements must union all active
`Subscription` rows regardless of `source`.

---

## Mental model (reuse, do not reinvent)

```text
Patreon/Steady membership events
        │
        ▼
Subscription row (source = PATREON | STEADY, status = ACTIVE|…)
        │
        ▼
EntitlementService  ──►  PAID episodes / PACKAGE scopes / private RSS
        │
        ▼
(same path as MANUAL and STRIPE — no parallel entitlement table)
```

- **Products** map external tier/plan ids → internal `SubscriptionProduct` via `external_product_id`.
- **Shadow users** get `Subscription` rows before they claim an account; claim links Patreon email → password.
- **Dual-run** means one user may hold `STRIPE` + `PATREON` subs simultaneously; entitlements union.
- **`SUBSCRIBER` role** ≠ paid access — imported members need membership + product grant.

See [`content-subscriptions-and-entitlements.md`](content-subscriptions-and-entitlements.md).

---

## Migration phases (product contract)

| Phase | Billing | Membership source | Creator action |
|-------|---------|-------------------|----------------|
| **A — Import** | Patreon/Steady only | OAuth import + webhooks | Distribute private feed URLs manually |
| **B — Dual-run** | Patreon/Steady + Stripe | Both synced | New members → Stripe Checkout |
| **C — Owned** | Stripe Connect only | Stripe webhooks | Revoke Patreon/Steady OAuth |

Platform must support **A indefinitely** — some creators never leave Patreon community features.

---

## Current codebase inventory

### Shipped (billing-adjacent)

| Piece | Location | Notes |
|-------|----------|-------|
| `PATREON_SYNC`, `STEADY_SYNC` | `V3__create_feature_modules.sql` | Inactive by default; `PATREON_MIGRATOR` preset activates Patreon |
| `SubscriptionSource.PATREON` | enum | No `STEADY` — add enum value or map Steady → `IMPORT` (prefer adding `STEADY`) |
| `Subscription.external_subscription_id` | `V41` (Stripe) | Reuse for Patreon member id / Steady sub id |
| `EntitlementService` | `directwerk-subscription` | Already Stripe-agnostic |
| Stripe dual-run | [`payment.md`](payment.md) | Production-ready; Patreon subs must coexist |

### Explicitly missing

| Area | Status |
|------|--------|
| `PatreonSyncModule` / `SteadySyncModule` Java constants | Absent (mirror `StripeBillingModule`) |
| OAuth token tables (`tenant_patreon_connections`, …) | Absent |
| `SubscriptionProduct.external_product_id` | Absent in schema |
| `User.status` / shadow-user flag | Design in README; verify shipped `User` entity |
| `POST /api/v1/auth/claim` | Absent |
| Webhook endpoints `/api/v1/webhooks/patreon`, `/webhooks/steady` | Absent |
| Import / reconcile queue jobs | Absent |
| Studio integrations UI | Spec only in `directwerk-studio-implementation.md` |
| Env vars (`PATREON_CLIENT_ID`, `STEADY_API_*`, …) | Absent from `.env.example` |

---

## Target data model

Flyway `V45+` (numbers illustrative):

### Tenant connection (Patreon)

```sql
CREATE TABLE tenant_patreon_connections (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    patreon_campaign_id VARCHAR(64) NOT NULL,
    access_token        TEXT NOT NULL,          -- encrypt at rest
    refresh_token       TEXT,
    token_expires_at    TIMESTAMPTZ,
    scopes              TEXT NOT NULL,
    last_sync_at        TIMESTAMPTZ,
    last_sync_status    VARCHAR(32),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tenant connection (Steady)

Mirror pattern: `tenant_steady_connections` with publication id + API token or OAuth pair.

### Product mapping

```sql
ALTER TABLE subscription_products
    ADD COLUMN external_product_id VARCHAR(128),
    ADD COLUMN external_platform VARCHAR(16);

ALTER TABLE subscription_products
    ADD CONSTRAINT subscription_products_external_platform_check
        CHECK (external_platform IS NULL OR external_platform IN ('PATREON', 'STEADY'));
```

Rules:

1. One internal product may map to **one** external tier/plan id per platform.
2. Import creates **inactive** duplicate products if slug collision — prefer mapping existing LEVEL ladder.
3. PACKAGE products: map when Patreon tier maps 1:1; otherwise manual rule setup post-import.

### Shadow users

Extend `users` (if not present):

| Column | Purpose |
|--------|---------|
| `status` | `ACTIVE`, `PENDING_CLAIM` (shadow) |
| `external_platform` | `PATREON` / `STEADY` nullable |
| `external_user_id` | Patreon user id / Steady member id |

Unique `(tenant_id, email)` still holds; claim flow sets password + `ACTIVE`.

### Webhook idempotency

Reuse pattern from Stripe:

```sql
CREATE TABLE processed_integration_events (
    id              BIGSERIAL PRIMARY KEY,
    platform        VARCHAR(16) NOT NULL,
    event_id        VARCHAR(128) NOT NULL,
    event_type      VARCHAR(128) NOT NULL,
    tenant_id       BIGINT REFERENCES tenants(id),
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform, event_id)
);
```

---

## API contract (preferred paths)

Align with studio spec in [`directwerk-studio-implementation.md`](directwerk-studio-implementation.md).

### Tenant admin — Patreon

| Method | Path | Module | Behavior |
|--------|------|--------|----------|
| GET | `/api/v1/tenant/integrations/patreon/authorize` | `PATREON_SYNC` | 302 to Patreon OAuth |
| GET | `/api/v1/tenant/integrations/patreon/callback` | — | Code exchange; store tokens; enqueue initial import |
| GET | `/api/v1/tenant/integrations/patreon/status` | `PATREON_SYNC` | Connected?, campaign name, last sync, member count |
| POST | `/api/v1/tenant/integrations/patreon/sync` | `PATREON_SYNC` | Manual resync (rate-limited) |
| DELETE | `/api/v1/tenant/integrations/patreon` | `PATREON_SYNC` | Revoke tokens; **do not** auto-cancel local subs (creator policy) |

### Tenant admin — Steady

Same shape under `/api/v1/tenant/integrations/steady/*` with `STEADY_SYNC`.

### Aggregated status

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/v1/tenant/integrations/status` | Stripe + Patreon + Steady snapshot for studio hub |

### Auth — shadow claim

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/v1/auth/claim` | Body: `{ "email", "token", "password" }` — activates shadow user; issues tokens |

Token delivered via import email (future `EMAIL_NOTIFY`) or creator communicates Patreon post link.

### Webhooks (no JWT)

| Method | Path | Verification |
|--------|------|--------------|
| POST | `/api/v1/webhooks/patreon` | Patreon signature header |
| POST | `/api/v1/webhooks/steady` | Steady shared secret |

SecurityConfig: permitAll + dedicated filters (mirror Stripe webhook pattern in `user-backend-implementation.md`).

---

## External platform mapping

### Patreon (API v2)

| Patreon object | Internal mapping |
|----------------|------------------|
| Campaign | Stored on connection; one campaign per tenant (v1) |
| Tier (`tier.id`) | `SubscriptionProduct.external_product_id` + LEVEL `sortOrder` from tier amount |
| Member (`member.id`) | `Subscription.external_subscription_id` |
| `currently_entitled_tiers` | Determines active product |
| Webhooks | `members:pledge:create`, `members:pledge:update`, `members:pledge:delete` |

Member email → find or create shadow `User` + `TenantMembership` (`SUBSCRIBER`).

### Steady

| Steady object | Internal mapping |
|---------------|------------------|
| Publication | Connection scope |
| Plan | `SubscriptionProduct.external_product_id` |
| Subscription | `Subscription.external_subscription_id`, `source=STEADY` |
| Webhooks | subscription created / cancelled / renewed (exact names per Steady API doc) |

Confirm Steady auth model (OAuth vs long-lived API token) before slice 4.

---

## Feature scope checklist

### A. Module constants + gating

- [ ] `PatreonSyncModule.KEY`, `SteadySyncModule.KEY`
- [ ] `@RequiresModule` on all integration endpoints
- [ ] Deactivate cascade: turning off `PATREON_SYNC` stops sync jobs; existing `PATREON` subs remain until manually revoked (document policy)

### B. Patreon OAuth + token lifecycle

- [ ] Env: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `PATREON_WEBHOOK_SECRET`
- [ ] OAuth authorize + callback with CSRF `state` bound to tenant admin session
- [ ] Encrypt tokens at rest (or use platform secret manager)
- [ ] Refresh token rotation before expiry

### C. Initial import job

- [ ] Queue job `patreon-initial-import` (after OAuth)
- [ ] Pull tiers → upsert/match `SubscriptionProduct`
- [ ] Pull active members → shadow users + `Subscription` rows (`source=PATREON`, `ACTIVE`)
- [ ] Studio progress: last sync time, counts, errors

### D. Patreon webhooks

- [ ] Signature verification
- [ ] Idempotency via `processed_integration_events`
- [ ] Map pledge events → upsert/cancel `Subscription`
- [ ] Resolve tenant via stored campaign id (never Host header alone)
- [ ] Enqueue private RSS refresh on membership change (reuse existing listener pattern)

### E. Steady integration

- [ ] Connection storage + import job + webhooks (parallel to Patreon)
- [ ] Add `SubscriptionSource.STEADY` enum + migration (replace `IMPORT` for Steady rows)

### F. Shadow user claim

- [ ] `User.status = PENDING_CLAIM` + claim token (email table or signed JWT)
- [ ] `POST /api/v1/auth/claim` with rate limit
- [ ] After claim: subscriber can use `/me/*`, feed builder, streams

### G. Reconciliation

- [ ] Scheduled job every 6h: poll Patreon/Steady for drift vs local `Subscription`
- [ ] Admin surfacing: desync count on integrations status
- [ ] Manual “force resync” enqueues full reconcile

### H. Studio UI

- [ ] **Monetization → Integrations** hub (`integrations/status`)
- [ ] Patreon connect / disconnect / last sync / resync
- [ ] Steady connect (same)
- [ ] Product mapping UI: link external tier → internal product (or confirm auto-map)

### I. Dual-run with Stripe

- [ ] Document: creator may have Patreon + Stripe products simultaneously
- [ ] Studio subscribers list: show `source` badge (`PATREON`, `STRIPE`, `MANUAL`)
- [ ] Revoke MANUAL must not silently fix Patreon/Stripe — same policy as [`payment.md`](payment.md) § Decisions

---

## Suggested build order

Ship in this order so imports never precede entitlements infrastructure:

1. **Schema + module constants** — connections, `external_product_id`, shadow user columns
2. **Patreon OAuth + status API** — no import yet; prove token storage
3. **Initial import job** — tiers + members → products + subscriptions + shadow users
4. **Patreon webhooks** — incremental updates; hard gate before telling creators to rely on sync
5. **Shadow claim API** + minimal directwerk-web “Account aktivieren” page
6. **Reconciliation job** + manual resync
7. **Steady parallel track** (slices 2–6)
8. **Studio integrations hub** — can start after slice 2 with Patreon-only

Until step **4** is production-ready, treat imports as **batch/manual** only (operator-triggered).

---

## Security requirements

1. Webhook signatures mandatory for Patreon and Steady.
2. OAuth `state` parameter prevents CSRF; bind to tenant + initiating admin user.
3. Tokens encrypted at rest; never log access tokens or webhook bodies.
4. Import creates users only within the connection’s tenant — cross-tenant member ids rejected.
5. Claim tokens single-use, short TTL; rate-limit claim endpoint.
6. Module gate: no Patreon API calls without `PATREON_SYNC` (+ `SUBSCRIPTION`).
7. Disconnect OAuth does not delete historical `Subscription` rows without explicit admin confirm.

---

## Frontend work

### directwerk-studio

| Area | Work |
|------|------|
| Integrations hub | Status cards: Stripe (existing), Patreon, Steady |
| Patreon | Connect button → OAuth redirect; disconnect confirm |
| Mapping | Optional tier → product review after first import |
| Subscribers | `source` column; filter by Patreon vs Stripe |

### directwerk-web

| Area | Work |
|------|------|
| `/claim` or `/accept-invite` extension | Shadow user sets password |
| Account | Show active sources; link to Patreon-managed vs Stripe portal |

---

## Testing & harnesses

**Rule ([`AGENTS.md`](../AGENTS.md)):** every new/changed REST endpoint updates Bruno **and** `Directwerk/http/` in the same change.

| Folder | Requests |
|--------|----------|
| `07-Tenant-Admin/Integrations/Patreon` | authorize (redirect URL), status, sync, disconnect |
| `07-Tenant-Admin/Integrations/Steady` | same |
| `14-Webhooks/Patreon` | signed fixture events |
| `14-Webhooks/Steady` | signed fixture events |
| `01-Auth` | claim happy path + expired token |

Also: multi-tenant isolation (tenant A token cannot import into tenant B), idempotent webhook replay, entitlement union tests (Patreon + Stripe same user).

Local tooling: Patreon webhook simulator / recorded fixtures; Steady sandbox if available.

---

## File / package sketch

```text
directwerk-subscription/
  PatreonSyncModule.java
  SteadySyncModule.java
  patreon/
    PatreonProperties.java
    PatreonOAuthService.java
    PatreonImportService.java
    PatreonWebhookService.java
    PatreonApiClient.java
  steady/
    SteadyProperties.java
    SteadyConnectionService.java
    SteadyImportService.java
    SteadyWebhookService.java

directwerk-app/
  controller/tenant/TenantPatreonIntegrationController.java
  controller/tenant/TenantSteadyIntegrationController.java
  controller/tenant/TenantIntegrationsStatusController.java
  controller/webhook/PatreonWebhookController.java
  controller/webhook/SteadyWebhookController.java
  controller/auth/ClaimController.java
  security/… webhook filters

Flyway:
  V45__patreon_steady_connections.sql
  V46__subscription_external_product_mapping.sql
  V47__processed_integration_events.sql
  V48__user_shadow_claim.sql
```

Gradle: HTTP client for Patreon/Steady (Java 21 `HttpClient` or Spring `RestClient` — match existing Stripe style).

---

## Decisions to lock before coding

1. **`STEADY` vs `IMPORT`:** Add `SubscriptionSource.STEADY` (recommended) vs overload `IMPORT`.
2. **One Patreon campaign per tenant** for v1, or multi-campaign selector.
3. **Shadow user email collisions:** Patreon email already registered → merge subs onto existing user vs reject import row.
4. **Disconnect policy:** Keep entitlements until period end vs immediate revoke.
5. **Tier → LEVEL ordering:** Auto-assign `sortOrder` from Patreon amount vs manual ladder edit post-import.
6. **Claim delivery:** Email invite (needs `EMAIL_NOTIFY`) vs creator-hosted magic link only for v1.

---

## Related links

| Doc | Why |
|-----|-----|
| [`../README.md`](platform-design.md#patreon-and-steady-onboarding) | Product design + dual-run narrative |
| [`payment.md`](payment.md) | Stripe Connect (shipped) — dual-run target |
| [`content-subscriptions-and-entitlements.md`](content-subscriptions-and-entitlements.md) | LEVEL/PACKAGE rules import must preserve |
| [`directwerk-studio-implementation.md`](directwerk-studio-implementation.md) | Integrations screen API TBD list |
| [`user-backend-implementation.md`](user-backend-implementation.md) | Shadow claim + webhook filter pattern |
| [`poc-alpha-setup.md`](poc-alpha-setup.md) | Phase H.2 |

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-28 | Initial brief — Phase 6 plan; no Patreon/Steady code beyond module seeds and `SubscriptionSource.PATREON` |
