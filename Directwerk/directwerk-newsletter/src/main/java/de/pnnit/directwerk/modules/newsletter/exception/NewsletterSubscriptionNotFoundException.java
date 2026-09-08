package de.pnnit.directwerk.modules.newsletter.exception;

public class NewsletterSubscriptionNotFoundException extends RuntimeException {

    public NewsletterSubscriptionNotFoundException(Long subscriptionId) {
        super("Newsletter subscription not found: " + subscriptionId);
    }

    public NewsletterSubscriptionNotFoundException(String message) {
        super(message);
    }
}
