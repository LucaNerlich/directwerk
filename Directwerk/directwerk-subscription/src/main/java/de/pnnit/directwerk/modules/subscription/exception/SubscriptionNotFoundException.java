package de.pnnit.directwerk.modules.subscription.exception;

public class SubscriptionNotFoundException extends RuntimeException {

    public SubscriptionNotFoundException(Long subscriptionId) {
        super("Subscription not found: " + subscriptionId);
    }
}
