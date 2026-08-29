# CLAUDE.md

Stripe Connect billing for Directwerk — checkout, webhooks, Connect onboarding.

Depends on `directwerk-subscription` (writes `Subscription` rows) and `directwerk-queue` (async webhooks).

```sh
./gradlew :directwerk-stripe-billing:build
./gradlew :directwerk-app:test --tests "*Stripe*"
```

- Package: `de.pnnit.directwerk.modules.stripebilling`
- Module key: `StripeBillingModule.KEY` (`STRIPE_BILLING`)
- Port implemented here: `ExternalSubscriptionBillingGateway` (defined in subscription module)
- HTTP controllers stay in `directwerk-app`
