package de.pnnit.directwerk.modules.subscription.event;

/**
 * Published when a user gains an active subscription membership (Stripe, manual grant, etc.).
 */
public record SubscriptionMembershipActivatedEvent(Long tenantId, Long userId) {
}
