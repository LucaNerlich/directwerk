# Platform SaaS billing — tenants pay Directwerk (planned)

Separate billing track from **creator → listener** Stripe Connect documented in
[`payment.md`](payment.md). Here the **tenant (creator/agency)** pays Directwerk for hosting,
modules, and platform services.

| | |
|---|---|
| **Status** | Not started — architecture prep only |
| **Module** | New platform billing domain (not `STRIPE_BILLING`) |
| **Audience** | Platform product, backend, directwerk-admin |

---

## Problem statement

`STRIPE_BILLING` / Connect solves **end-customer subscriptions on the creator's connected account**.
It does **not** bill the tenant for using Directwerk (Pro/Enterprise modules, storage, seats).

Platform SaaS billing needs:

- A **platform Stripe Customer** per tenant (not the Connect `acct_*`)
- Products/plans for Directwerk tiers (modules, limits)
- Invoices, payment methods, dunning when the tenant's card fails
- Enforcement: degrade or gate features when platform subscription lapses

---

## Design options

| Approach | Pros | Cons |
|----------|------|------|
| **Stripe Billing on platform account** | Mature subscriptions, portal, tax hooks | Separate from Connect; two Stripe contexts per tenant |
| **Manual invoicing + MANUAL module flags** | Zero dev for alpha | Does not scale |
| **External billing (Chargebee, etc.)** | Feature-rich | Extra vendor, sync to `ModuleService` |

**Recommendation:** Stripe Billing on the **platform** account, similar mental model to listener billing but different Customer object and webhook handler.

```text
Platform Stripe Customer (cus_platform_*)
        │
        ▼
TenantPlatformSubscription (source = STRIPE_PLATFORM)
        │
        ▼
ModuleService / limits  ──►  PODCAST, STRIPE_BILLING, storage caps, …
```

Do **not** reuse `Subscription` / `SubscriptionProduct` rows meant for listener entitlements without clear naming — prefer `TenantPlatformPlan` or parallel tables to avoid conflating creator products with Directwerk SKUs.

---

## Entity sketch (illustrative)

| Entity | Purpose |
|--------|---------|
| `PlatformPlan` | Directwerk SKU: slug, module bundle, limits (storage GB, seats) |
| `TenantPlatformSubscription` | Tenant ↔ plan, status, Stripe subscription id on **platform** account |
| `TenantPlatformCustomer` | Tenant ↔ `cus_*` on platform account |

**Enforcement**

- `@RequiresModule` continues to gate features; platform billing job syncs enabled modules from plan
- Hard vs soft limit on lapse: read-only mode vs full suspend (product decision)
- Connect listener billing can remain active even if platform bill is overdue (avoid locking out paying subscribers) — or block new Connect checkouts only

---

## API surface (future)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/platform/tenants/{id}/billing` | Platform admin: plan, status, MRR |
| `GET /api/v1/tenant/platform-billing/status` | Tenant admin: own plan, upgrade CTA |
| `POST /api/v1/tenant/platform-billing/portal` | Stripe Customer Portal on **platform** account |
| `POST /api/v1/webhooks/stripe-platform` | Platform-account webhooks (separate secret) |

Studio: new section under Einstellungen or platform-only in `directwerk-admin`.

---

## Webhooks & secrets

Use a **separate** webhook endpoint and `STRIPE_PLATFORM_WEBHOOK_SECRET` from Connect listener webhooks.

| Event | Effect |
|-------|--------|
| `customer.subscription.updated` | Sync tenant plan status |
| `invoice.payment_failed` | Mark tenant `PAST_DUE`; optional email to TENANT_ADMIN |
| `customer.subscription.deleted` | Downgrade to free tier modules |

Reuse queue pattern from listener webhooks (`stripe-webhook` queue family or `stripe-platform-webhook`).

---

## Relationship to Connect

| Concern | Listener Connect (`STRIPE_BILLING`) | Platform SaaS |
|---------|-------------------------------------|---------------|
| Stripe account | Connected `acct_*` | Platform account |
| Customer | Listener `cus_*` on connected account | Tenant `cus_*` on platform |
| Pays | Subscriber → Creator | Creator → Directwerk |
| Entitlements | Episodes, feeds, packages | Feature modules, limits |

A tenant can have Connect **CONNECTED** while platform subscription is **PAST_DUE** — define policy explicitly in UI copy and enforcement.

---

## Implementation phases

1. **Schema + admin manual plan assignment** (MANUAL source, no Stripe) — unblocks sales
2. **Platform Checkout for new tenants** — signup selects plan
3. **Webhooks + self-service portal** — parity with listener billing ops
4. **Usage-based components** (storage, bandwidth) — optional metered billing

---

## Related

| Doc | Why |
|-----|-----|
| [`payment.md`](payment.md) | Listener Connect (shipped) |
| [`stripe-advanced-billing.md`](stripe-advanced-billing.md) | Application fees on Connect charges (different from SaaS) |
| [`directwerk-admin-implementation.md`](directwerk-admin-implementation.md) | Platform admin UX |
| [`content-platform-strategy.md`](content-platform-strategy.md) | Product packaging |

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-29 | Initial architecture prep |
