# directwerk-subscription

Optional subscription product and entitlement module.

## Contents

| Package | Description |
|---------|-------------|
| `de.pnnit.directwerk.modules.subscription.entity` | `Subscription`, `SubscriptionProduct`, enums |
| `de.pnnit.directwerk.modules.subscription.repository` | JPA repositories |
| `de.pnnit.directwerk.modules.subscription.service` | `SubscriptionService`, `SubscriptionProductService`, `EntitlementService` |
| `de.pnnit.directwerk.modules.subscription` | `SubscriptionModule` feature key constant |

Write operations are guarded by `@RequiresModule(SubscriptionModule.KEY)` in the core aspect.

Database tables are created by Flyway migrations in `directwerk-app` (V10, V11).

## Dependencies

- `directwerk-core`

## Used by

- `directwerk-app` — tenant and public HTTP controllers

## Build

```sh
./gradlew :directwerk-subscription:build
```

Tests run in `directwerk-app` (`EntitlementServiceTest`, `ProductSlugTest`, controller integration tests).
