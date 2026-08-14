package de.pnnit.directwerk.modules.subscription.exception;

public class SubscriptionProductNotFoundException extends RuntimeException {

    public SubscriptionProductNotFoundException(Long productId) {
        super("Subscription product not found: " + productId);
    }

    public SubscriptionProductNotFoundException(String slug) {
        super("Subscription product not found: " + slug);
    }
}
