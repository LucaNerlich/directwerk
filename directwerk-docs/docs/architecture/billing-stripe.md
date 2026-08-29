---
title: Stripe billing
description: Stripe Connect billing status, checkout, webhooks, and studio payment integration.
outline: deep
---

<!-- source: docs/payment.md -->

Implementation brief for **Phase 8 / `STRIPE_BILLING`**: live Stripe Connect billing on
Directwerk. Complements the design sketch in [`../README.md`](../../../docs/platform-design.md#payments-and-billing)
and the entitlement model in [`content-subscriptions-and-entitlements.md`](/operators/subscriptions-and-entitlements).

| | |
|---|---|
| **Status** | Live Connect + checkout + webhooks + studio payment dashboard. Without `STRIPE_*` env keys, money paths still return **501** `STRIPE_NOT_IMPLEMENTED` |
| **Module** | `STRIPE_BILLING` (depends on `SUBSCRIPTION`; seeded in Flyway `V3`) |
| **Audience** | Stripe implementation agent / backend + studio + directwerk-web |
| **Related** | `README.md` Payments, `poc-alpha-setup.md` Phase H, `directwerk-studio-implementation.md` Integrations, Bruno `02-Me` + `07-Tenant-Admin/Stripe` |

---

## Executive summary

**What works today**

- LEVEL / PACKAGE products, access rules, MANUAL grant/revoke
- `EntitlementService` derives access from `Subscription` rows with `status = ACTIVE`
- Public product catalog, studio products/grants/subscribers UI, directwerk-web pricing page
- Live Stripe Connect, prices, Checkout, Customer Portal, signed webhooks
- Studio **Abos → Zahlungen**: Stripe status, membership stats (including past-due), filterable list, revoke (cancels Stripe when connected)

**What does not work / later**

- Studio promo-code management (Checkout already allows Stripe Dashboard codes)
- Application fees, email notify, DigitalPublication, custom feeds, directwerk-admin, analytics
- Without platform `STRIPE_*` keys, money paths still return **501** `STRIPE_NOT_IMPLEMENTED`

---

## Mental model (reuse, do not reinvent)

```text
Stripe payment events
        │
        ▼
Subscription row (source = STRIPE, status = ACTIVE|…)
        │
        ▼
EntitlementService  ──►  PAID episode / package scopes / private RSS
```

- **Products** (`SubscriptionProduct`) are what tenants sell.
- **Subscriptions** grant access; entitlements are **derived**, not duplicated per episode.
- **MANUAL** grants remain for comps / support; Stripe is another `SubscriptionSource`.
- `SUBSCRIBER` role ≠ paid access. Membership lets you call `/me/*`; products unlock content.

See [`content-subscriptions-and-entitlements.md`](/operators/subscriptions-and-entitlements).

---

## Current codebase inventory (as of 2026-08-29)

### Shipped domain (billing-adjacent)

| Piece | Location | Notes |
|-------|----------|-------|
| `SubscriptionProduct` | `directwerk-subscription` + `V10`, `V41` | Money fields (`price_cents`, `currency`, `billing_interval`), Stripe product/price IDs |
| `ProductAccessRule` | same | PACKAGE scopes (`FORMAT`, `CATEGORY`, `PODCAST_SERIES`, `DIGITAL_ASSET`, `ALL_PODCASTS`, …) |
| `Subscription` | same | `status`, `source`, `startedAt`, `endsAt`, `external_subscription_id`, `external_payment_id`, `stripe_customer_id`; unique `(tenant_id, user_id, product_id)` |
| `SubscriptionSource` | enum | `MANUAL`, `SEED`, `STRIPE`, `PATREON`, `IMPORT` (design README also mentions `STEADY` — code uses `IMPORT`) |
| `SubscriptionStatus` | enum | `ACTIVE`, `CANCELED`, `EXPIRED`, `PAST_DUE`, `INCOMPLETE` |
| `SubscriptionService` | grants/revokes + Stripe upsert | Manual grants write `source = MANUAL`; webhooks write `source = STRIPE` |
| `EntitlementService` | LEVEL ∪ PACKAGE | Reads `status = ACTIVE` only; Stripe-agnostic |
| `STRIPE_BILLING` feature | `V3__create_feature_modules.sql`, `ModulePreset.PRO` / `ENTERPRISE` | Gates onboard, checkout, portal |
| `StripeBillingModule.KEY` | `StripeBillingModule.java` | Used with `@RequiresModule` on money paths |

### Shipped Stripe stack

| Piece | Path | Behavior |
|-------|------|----------|
| Connect + status | `TenantStripeController` | Real Express onboarding; `tenant_stripe_accounts` (`V41`) |
| Catalog sync | `StripeCatalogSyncService` + `POST …/products/{id}/sync-stripe` | Money fields on `SubscriptionProduct`; connected-account Product/Price |
| Checkout | `MeBillingController` → `StripeCheckoutService` | `MONTH`/`YEAR`/`ONE_TIME`; `allow_promotion_codes=true`; concurrent customer-create race handled |
| Portal | `POST /api/v1/me/billing/portal` | Customer Portal on connected account |
| Webhooks | `StripeWebhookController` + `StripeWebhookService` + `stripe-webhook` queue | Signature verify at ingress; async apply via `StripeWebhookJobHandler` when queue enabled; `processed_webhook_events` idempotency |
| Revoke | `TenantSubscriptionController` | Local cancel + Stripe cancel for `source=STRIPE`; 502 `STRIPE_REQUEST_FAILED` if Stripe cancel fails |
| Dashboard | `GET /api/v1/tenant/billing/dashboard` | Studio **Abos → Zahlungen** stats + filters |
| Rate limits | `BillingRateLimitFilter` | Per IP + per authenticated user on `/me/billing/*` |
| Studio / web | `/settings/stripe`, `/pricing`, `/account` | Live redirects; **501** only when platform `STRIPE_*` keys absent |
| Harness | Bruno `07-Tenant-Admin/Stripe`, `12-Webhooks`, `02-Me`; `http/26-stripe-billing.http` | Live-path coverage |

Migrations: `V41__stripe_connect_and_prices.sql`, `V42__subscription_external_payment_id.sql`.

### Remaining gaps (post–slice 1–7)

| Area | Status |
|------|--------|
| Studio promotion-code CRUD | Deferred — codes created in Stripe Dashboard; Checkout already accepts them |
| Application / platform fee on Connect charges | Business decision; architecture supports optional fee later |
| Stripe Tax / VAT | Explicitly non-MVP (`content-platform-strategy.md`) |
| Platform SaaS billing (tenants pay Directwerk) | Separate from creator→listener Connect; post-MVP |
| Proration / plan upgrades / dunning UX polish | Follow-up after production traffic |

### Do not confuse

`directwerk-webhook` is an **outbound** job/delivery stub for tenant automation. It is **not** the inbound Stripe webhook receiver.

---

## Design vs shipped API (align when implementing)

| Design (`README.md`) | Current stub / preferred direction |
|----------------------|------------------------------------|
| `POST /api/v1/checkout/sessions` + `productId` + success/cancel URLs | Stub: `POST /api/v1/me/billing/checkout-sessions` + `productSlug` |
| `POST /api/v1/billing/portal` | Not started — keep under `/me/billing/portal` or `/billing/portal` consistently |
| `POST /api/v1/products/{id}/sync-stripe` | Live products live under `/api/v1/tenant/products` — prefer `POST /api/v1/tenant/products/{id}/sync-stripe` |
| `POST /api/v1/tenant/stripe/onboard` | Matches stub path — implement for real |
| Subscription statuses include `PAST_DUE` / `INCOMPLETE` | Add to enum + migrations when wiring invoices |
| `SubscriptionSource.STEADY` | Code has `IMPORT`; Patreon/Steady sync is a separate phase |

**Recommendation:** Prefer the **stub paths already used by directwerk-web/studio** (`/me/billing/*`, `/tenant/stripe/*`, `/tenant/products`) and update README/OpenAPI to match, rather than introducing a second parallel surface.

---

## Target Stripe Connect model

| Actor | Stripe object | Stored where |
|-------|---------------|--------------|
| Platform | Platform Stripe account | Env: secret key, webhook secret, Connect client id |
| Tenant | Connected Account `acct_…` | DB: tenant billing / Connect profile |
| End customer | Customer on **connected** account | DB: user ↔ tenant ↔ `cus_…` |
| Sellable offer | Product + Price on connected account | `SubscriptionProduct.stripe_*` columns |
| Recurring access | Subscription `sub_…` | `Subscription.external_subscription_id` + `source=STRIPE` |
| One-time | PaymentIntent / Checkout `mode=payment` | Purchase/grant mapping (see below) |

**Application fee / platform fee:** business decision (TBD in go-to-market). Architecture must support Connect destination charges or direct charges on connected accounts with optional `application_fee_amount`. Document the chosen charge type in code comments + this file when implemented.

Env vars (minimum):

```text
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=          # only if client needs it; prefer server-created Checkout
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=
# Optional later:
# STRIPE_CONNECT_WEBHOOK_SECRET=  # if Connect uses a separate endpoint
```

**Never** put secret keys in directwerk-studio / directwerk-web client bundles. Server-only via `@ConfigurationProperties`.

---

## Required product / money model

Extend `SubscriptionProduct` (names illustrative — match Flyway style):

| Field | Purpose |
|-------|---------|
| `description` | Public marketing copy |
| `price_cents` | Display + Price unit_amount |
| `currency` | Default `EUR` |
| `billing_interval` | `MONTH` \| `YEAR` \| `ONE_TIME` |
| `stripe_product_id` | Connected-account Product |
| `stripe_price_id` | Connected-account Price (active) |
| Optional: `stripe_price_ids` history | If prices are immutable and rotate on change |

Rules:

1. Changing amount/interval creates a **new** Stripe Price; archive old Price; update local pointer.
2. Sync is explicit (`sync-stripe`) or automatic on save when Connect is ready — pick one UX and stick to it.
3. Public catalog must expose price + interval (not only slug/title).
4. Checkout must resolve product in **current tenant**, `active=true`, and require Connect `charges_enabled`.

---

## Feature scope checklist

### A. Connect onboarding (tenant admin)

- [x] Persist Connect account id + capabilities (`charges_enabled`, `payouts_enabled`, `details_submitted`)
- [x] `POST /tenant/stripe/onboard` → Account Link URL (return/refresh URLs to studio)
- [x] `GET /tenant/stripe/status` → real status (`NOT_CONNECTED` \| `PENDING` \| `RESTRICTED` \| `CONNECTED`, …)
- [x] `@RequiresModule(STRIPE_BILLING)` on Stripe admin + checkout endpoints
- [x] Studio: redirect to Stripe, refresh status, clear empty-state copy
- [x] Gate SideNav “Stripe” on module (optional: still show with “module off” empty state)

### B. Catalog sync

- [x] Migration for money + Stripe id columns
- [x] Studio product editor: amount, currency, interval
- [x] `POST /tenant/products/{id}/sync-stripe`
- [x] Public products API returns price fields
- [x] Bruno + `http/` coverage for sync + public shape

### C. Checkout (subscriptions)

- [x] Ensure Stripe Customer exists for membership (create on first checkout)
- [x] `POST /me/billing/checkout-sessions`:
  - validate auth + tenant + product
  - `mode=subscription` for `MONTH`/`YEAR`
  - metadata: `tenant_id`, `user_id`, `product_id` (and slug)
  - `success_url` / `cancel_url` (body or server-derived from tenant primary domain)
  - Create on **connected account**
- [x] directwerk-web: success/cancel pages; show money on pricing
- [x] Rate-limit checkout; never trust client for entitlement

### D. Webhooks (source of truth)

- [x] `POST /api/v1/webhooks/stripe` — **no JWT**; signature verify via `Stripe-Signature`
- [x] SecurityConfig permit + dedicated filter (see `user-backend-implementation.md`)
- [x] Idempotency table `processed_webhook_events` (`event_id` unique)
- [x] Resolve tenant via Connect account id and/or metadata (never trust Host header alone)
- [x] Map events → `Subscription` with `source=STRIPE`:

| Event family | Effect |
|--------------|--------|
| `checkout.session.completed` (subscription) | Upsert ACTIVE sub; set external ids; ensure default private feed |
| `customer.subscription.updated` | Sync status / period end / product price changes |
| `customer.subscription.deleted` | CANCELED (policy: immediate vs end-of-period already reflected by Stripe) |
| `invoice.paid` | Renew period end; ensure ACTIVE |
| `invoice.payment_failed` | PAST_DUE; optional dunning UX later |

- [x] Return 200 quickly after durable processing (or enqueue via existing queue module)
- [x] **Never** log full webhook bodies / card data

### E. Cancellation & self-service

- [x] Cancel at period end vs immediate (Stripe Subscription cancel APIs)
- [x] `POST /me/billing/portal` → Customer Portal session (Stripe-sourced only)
- [x] Account UI: open portal; show Stripe vs MANUAL subs differently in studio subscribers list
- [x] On cancel/expire: entitlement drops automatically when status ≠ ACTIVE; optional feed token rotation policy (README suggests grace then invalidate)

### F. One-time purchases

Required for “buy this bonus” / non-recurring packages.

- [x] `billing_interval = ONE_TIME` (or dedicated offering flag)
- [x] Checkout `mode=payment`
- [x] Webhook: `checkout.session.completed` / `payment_intent.succeeded`
- [x] Entitlement shape (choose and document one):
  - **Permanent PACKAGE grant** (Subscription ACTIVE, `endsAt=null`), or
  - **Time-boxed grant** (`endsAt` set), or
  - **Digital download only** (PACKAGE rule `DIGITAL_ASSET`) without podcast LEVEL bump
- [ ] Studio + public copy must distinguish recurring vs one-time (copy polish)

### G. Discounts, coupons, promotion codes

Target Stripe-native:

| Stripe object | Use |
|---------------|-----|
| Coupon | % or amount off; duration `once` / `repeating` / `forever` |
| Promotion Code | Customer-facing code; max redemptions; expiry; restrictions |
| Checkout | `allow_promotion_codes: true` and/or pre-applied `discounts` |

Implementation sketch:

- [ ] Tenant-admin APIs to create/list/deactivate promotion codes (wrapping Stripe on connected account) **or** manage in Stripe Dashboard first (MVP shortcut) then add studio UI
- [x] Checkout: enable `allow_promotion_codes` for self-serve codes
- [ ] Optional: staff-applied coupon on Checkout Session for support comps (prefer MANUAL grant for pure comps — no money movement)
- [ ] Webhook/invoice line items: store discount summary on Subscription metadata if needed for support
- [ ] Decide first-invoice-only vs forever for LEVEL upgrades

**Out of scope for first Stripe slice:** complex multi-product carts, gift subscriptions, affiliate codes.

### H. Tax / VAT

Deferred: Stripe Tax or accountant-managed — **not MVP** (`content-platform-strategy.md`). Leave hooks (automatic_tax) off until explicitly scheduled.

### I. Platform SaaS billing (tenants pay us)

Separate from creator→listener Connect. Optional post-MVP (`README` Platform SaaS Billing). Do not block Connect listener billing on this.

---

## Suggested build order

Ship in this order so money never precedes access:

1. **Connect onboard + account storage + real status**
2. **Product money fields + Price sync**
3. **Checkout Session (subscription)** + success/cancel URLs
4. **Inbound webhooks → Subscription/entitlement** ← hard gate before production Checkout
5. **Cancel + Customer Portal**
6. **One-time Checkout + grant mapping**
7. **Promotion codes** (Dashboard-first acceptable; then studio CRUD)
8. Tax / proration / plan upgrades / dunning polish

Until step **4** is production-ready, keep checkout returning 501 in non-dev environments or behind a feature flag.

---

## Security requirements

1. Webhook signature verification mandatory; reject unsigned/forged events.
2. All Connect API calls scoped to the tenant’s `acct_…` — no cross-tenant Stripe objects.
3. Metadata + Connect account id must agree with `TenantContext` / stored mapping.
4. Secrets only in env / secret manager; never frontend.
5. Do not log pre-signed URLs, webhook payloads, or PANs (there should be none if Checkout is hosted).
6. Rate-limit checkout session creation per user/IP.
7. Module gate: no Stripe money paths without `STRIPE_BILLING` (+ `SUBSCRIPTION`).
8. MANUAL revoke must not silently “fix” an active Stripe sub without a clear admin action (cancel in Stripe or mark local-only) — define policy in UI copy.

---

## Frontend work

### directwerk-studio

| Area | Work |
|------|------|
| Settings → Stripe | Real onboard redirect, status badges, disconnected/restricted states |
| Products | Price, currency, interval, sync state, errors from Stripe |
| Subscribers | Show `source`, Stripe external id, period end, link to Customer in Dashboard (optional) |
| Integrations (future) | Hub for Stripe / Patreon / Steady status |

### directwerk-web

| Area | Work |
|------|------|
| Pricing | Display money; checkout redirect to Stripe-hosted page |
| Success / cancel | Clear UX; poll `/me/access` after return (webhook may lag) |
| Account | Portal button; list active levels; failed-payment messaging later |
| Auth | Checkout requires signed-in subscriber (already assumed by stub) |

---

## Testing & harnesses

**Rule (AGENTS.md):** every new/changed REST endpoint updates Bruno **and** `Directwerk/http/` in the same change.

Minimum Bruno coverage when implementing:

| Folder | Requests |
|--------|----------|
| `07-Tenant-Admin/Stripe` | status (real states), onboard (URL), connected happy path |
| `07-Tenant-Admin/Products` | create with price, sync-stripe |
| `02-Me` | checkout-sessions (201 + url), portal |
| New `Webhooks` or security folder | signed Stripe event fixtures (test clock / CLI) |
| Public | products include price fields |

Also: architecture tests (webhook path not JWT), multi-tenant isolation (tenant A Connect cannot sync tenant B products), idempotent webhook replay.

Local tooling: Stripe CLI forward to `localhost:8080/api/v1/webhooks/stripe`, test Connect accounts in Stripe test mode.

---

## Decisions (2026-08-13)

1. **Charge type:** Direct charges on the connected account (`Stripe-Account` header). No application fee in this slice.
2. **Checkout body:** keep `productSlug`; optional `successUrl` / `cancelUrl`. Missing URLs are derived from the tenant primary domain (`/checkout/success`, `/checkout/cancel`). Hosts must be a tenant domain, the studio base URL, or loopback.
3. **Price changes:** local amount/interval/currency change clears `stripe_price_id`; next sync or checkout creates a new Stripe Price and updates the pointer.
4. **Failed payment:** `invoice.payment_failed` → `PAST_DUE`. Entitlements stay **ACTIVE-only**, so PAST_DUE cuts access (fail-secure).
5. **Cancel MANUAL vs Stripe:** TENANT_ADMIN revoke marks the row `CANCELED`. For `source=STRIPE` with an external id, the API also cancels the Stripe subscription when keys and a Connect account exist. If Stripe cancel fails, the local revoke is not applied (`STRIPE_REQUEST_FAILED`).
6. **Promo MVP:** Checkout sets `allow_promotion_codes=true`. Codes are created in the Stripe Dashboard, not in studio.
7. **One-time entitlement:** `billing_interval=ONE_TIME` uses Checkout `mode=payment` and a permanent grant (`endsAt=null`).
8. **Default private feed:** first ACTIVE Stripe membership publishes `StripeMembershipActivatedEvent`; the app listener calls `ensureDefaultFeed`.

Studio owners get `GET /api/v1/tenant/billing/dashboard` (counts including past-due, estimated monthly value from local Stripe rows, up to 100 memberships) at **Abos → Zahlungen**. The page filters and revokes memberships; Stripe revoke also cancels the connected subscription.

---

## File / package sketch (for implementers)

Suggested layout (adjust to monorepo norms):

```text
directwerk-subscription/
  StripeBillingModule.java
  stripe/
    StripeProperties.java
    StripeSdkOperations.java
    StripeConnectService.java
    StripeCatalogSyncService.java
    StripeCheckoutService.java
    StripeCustomerPortalService.java
    StripeWebhookService.java
    BillingDashboardService.java
    job/
      StripeWebhookJobProducer.java
      StripeWebhookJobHandler.java

directwerk-app/
  controller/tenant/TenantStripeController.java
  controller/auth/MeBillingController.java
  controller/webhook/StripeWebhookController.java
  security/BillingRateLimitFilter.java

Flyway:
  V41__stripe_connect_and_prices.sql
  V42__subscription_external_payment_id.sql
```

Gradle: add official Stripe Java SDK; pin version in BOM/catalog if used.

---

## Related links

| Doc | Why |
|-----|-----|
| [`../README.md`](../../../docs/platform-design.md#payments-and-billing) | Original product design (Connect, checkout sequence, webhooks) |
| [`content-subscriptions-and-entitlements.md`](/operators/subscriptions-and-entitlements) | LEVEL/PACKAGE access rules (must keep working) |
| [`poc-alpha-setup.md`](/install/local-development) | HTTP harness run order |
| [`directwerk-studio-implementation.md`](directwerk-studio-implementation.md) | Studio integrations / sync-stripe UI notes |
| [`user-backend-implementation.md`](user-backend-implementation.md) | `/api/v1/webhooks/**` signature filter pattern |
| [`../Directwerk/bruno/README.md`](../Directwerk/bruno/README.md) | Bruno maintenance rule |
| [`../AGENTS.md`](../AGENTS.md) | API-first + Bruno/http lockstep |

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-13 | Email transport port (`EmailSender`) so SMTP can be swapped for an HTTP ESP later; jobs/templates unchanged. |
| 2026-08-13 | Owner UX: product copy, TENANT_ADMIN gates, subscriber Stripe ids, charge.refunded for one-time, portal + success poll + PAST_DUE on web/example-fe. |
| 2026-08-13 | Bruno + http harnesses aligned with live billing controllers (prices, dashboard stats, checkout/portal, webhook signature). |
| 2026-08-13 | Studio Zahlungen: past-due/incomplete stats, filters, revoke from the membership list. |
| 2026-08-29 | Async Stripe webhooks via `stripe-webhook` queue; billing per-user rate limit; SideNav Stripe gated on `STRIPE_BILLING`; doc inventory reconciled. |
| 2026-08-28 | Reconciled inventory + feature checklist with shipped Connect/checkout/webhooks/dashboard. Remaining: one-time copy polish, studio promo CRUD. |
| 2026-08-13 | Live Connect, prices, checkout, webhooks, studio Zahlungen dashboard. 501 without platform keys. |
| 2026-08-12 | Initial brief from gap analysis after stub controllers/UI landed; no live Stripe yet |
