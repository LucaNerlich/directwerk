# Stripe advanced billing — application fees, tax, proration (planned)

Follow-up track after the live **Stripe Connect listener billing** slice documented in
[`payment.md`](payment.md). This is **creator → listener** commerce on connected accounts, not
platform SaaS billing (see [`platform-saas-billing.md`](platform-saas-billing.md)).

| | |
|---|---|
| **Status** | Not started — architecture prep only |
| **Depends on** | Shipped Connect + checkout + webhooks (`STRIPE_BILLING`) |
| **Audience** | Backend + product |

---

## Scope

### 1. Application / platform fees

Today: **direct charges** on the connected account with **no** `application_fee_amount`.

| Option | When to use | Directwerk impact |
|--------|-------------|-------------------|
| Direct charge + application fee | Platform takes % or fixed fee per payment | Add fee config per tenant/plan; pass `application_fee_amount` on PaymentIntent / Checkout; reconcile in platform Stripe dashboard |
| Destination charge | Platform is merchant of record | Larger compliance surface; not recommended for EU creator SaaS without legal review |
| Separate platform invoice | Flat SaaS fee unrelated to GMV | See [`platform-saas-billing.md`](platform-saas-billing.md) |

**Prep decisions needed**

- Fee model: % of GMV, fixed per transaction, or tiered by Directwerk plan
- Who sees fees on receipts (Stripe receipt branding on connected account stays creator-facing)
- Refund policy: partial refunds should reverse fee proportionally (`refund_application_fee`)

**Suggested implementation sketch**

1. `TenantBillingProfile` or extend `TenantStripeAccount` with optional `applicationFeeBps` / cap
2. `StripeCheckoutService` + `StripeSdkOperations.createCheckoutSession` — add fee when platform policy enabled
3. Webhook handling unchanged for entitlements; optional metadata for support dashboards
4. Studio: read-only fee disclosure on Zahlungen (no fee editing until product/pricing decided)

### 2. Stripe Tax / VAT

Explicitly **non-MVP** per [`content-platform-strategy.md`](content-platform-strategy.md).

| Phase | Work |
|-------|------|
| MVP (now) | Creators responsible for tax; prices shown excl. or incl. VAT per tenant copy |
| Phase A | Enable Stripe Tax on connected account at Checkout (`automatic_tax`) when tenant opts in |
| Phase B | Studio tax settings (default tax behavior, tax IDs collection) |
| Phase C | Invoice/export for German Kleinunternehmer vs USt-pflichtig (legal copy, not tax advice) |

**Prep:** keep Checkout creation behind `StripeOperations` so `automatic_tax` is a single flag later.

### 3. Proration, plan changes, upgrades

Not required for first paid traffic; subscribers today buy one product slug per Checkout.

| Scenario | Stripe approach | Directwerk model |
|----------|-----------------|------------------|
| LEVEL upgrade (Bronze → Gold) | Subscription update with proration | Map new Price; webhook `customer.subscription.updated` already syncs status/period |
| Downgrade at period end | `proration_behavior=none`, schedule price change | Preserve `endsAt` from Stripe period end |
| PACKAGE add-on alongside LEVEL | Second Subscription row (unique per product) | Already supported via `(tenant, user, product)` uniqueness |
| Cancel at period end vs immediate | Portal + Stripe API | Admin revoke uses immediate cancel today; document Portal behavior for self-service |

**Risks to address before enabling proration**

- Entitlement gap during incomplete upgrades (`INCOMPLETE` already fail-closed)
- Product/Price rotation when amount changes (local `stripe_price_id` cleared — already shipped)
- Studio UX: “change plan” vs new Checkout per product

**Suggested build order**

1. Self-service upgrade/downgrade via Customer Portal configuration (Stripe-side, no code)
2. Explicit `POST /me/billing/change-plan` wrapping Subscription Update API
3. Proration preview endpoint for integrators
4. Dunning / retry UX polish (`PAST_DUE` messaging on directwerk-web — partial today)

---

## Out of scope (this track)

- Multi-item carts, gift subscriptions, affiliate codes
- Patreon/Steady import — [`patreon-steady-integration.md`](patreon-steady-integration.md)
- Platform SaaS subscription — [`platform-saas-billing.md`](platform-saas-billing.md)

---

## Related

| Doc | Why |
|-----|-----|
| [`payment.md`](payment.md) | Shipped Connect MVP |
| [`content-subscriptions-and-entitlements.md`](content-subscriptions-and-entitlements.md) | Entitlement model must stay derived from `Subscription` |
| [`content-platform-strategy.md`](content-platform-strategy.md) | Tax deferral rationale |

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-29 | Initial architecture prep (fees, tax, proration) |
