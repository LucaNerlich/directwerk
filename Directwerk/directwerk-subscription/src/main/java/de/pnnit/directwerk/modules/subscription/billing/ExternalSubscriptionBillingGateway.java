package de.pnnit.directwerk.modules.subscription.billing;

import de.pnnit.directwerk.modules.subscription.entity.Subscription;

/**
 * Port for canceling externally billed subscriptions (Stripe today; Patreon/Steady later).
 * Implemented in {@code directwerk-stripe-billing}; optional at runtime when that module is absent.
 */
public interface ExternalSubscriptionBillingGateway {

    /**
     * Cancels the provider-side subscription when applicable. No-op for non-external sources.
     * Implementations may throw when the provider API fails — callers should not apply local
     * revocation afterward.
     */
    void cancelExternalSubscriptionIfNeeded(Long tenantId, Subscription subscription);
}
