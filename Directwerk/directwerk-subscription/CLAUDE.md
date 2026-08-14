# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
./gradlew :directwerk-subscription:build
```

Tests run in `directwerk-app` (no test sources of its own), notably `EntitlementServiceTest`, `ProductSlugTest`, and controller integration tests:

```sh
./gradlew :directwerk-app:test --tests "*Entitlement*"
```

## Architecture

The optional subscription/entitlement module — subscription products, tenant subscriptions, and access-rule evaluation. Depends on `directwerk-core` (and transitively everything below it). Used by `directwerk-app`'s tenant and public HTTP controllers; nothing else in the module graph depends on it.

- `de.pnnit.directwerk.modules.subscription.entity` — `Subscription`, `SubscriptionProduct`, and enums `OfferingType`, `SubscriptionSource`, `SubscriptionStatus`.
- `de.pnnit.directwerk.modules.subscription.repository` — `SubscriptionRepository`, `SubscriptionProductRepository`.
- `de.pnnit.directwerk.modules.subscription.service` — `SubscriptionService`, `SubscriptionProductService`, and `EntitlementService` (the access-decision logic: whether a given subscriber has access to a product/asset).
- `de.pnnit.directwerk.modules.subscription.util.ProductSlug` — slug generation/validation for subscription products.
- `SubscriptionModule` defines this module's feature key constant; write operations in the service layer are guarded with `@RequiresModule(SubscriptionModule.KEY)` (enforced by the aspect in `directwerk-core`), so this module is only writable for tenants that have it enabled — read that key rather than hardcoding the module name elsewhere.

Database tables for subscriptions/products are created by Flyway migrations owned by `directwerk-app` (V10, V11), not by this module.
