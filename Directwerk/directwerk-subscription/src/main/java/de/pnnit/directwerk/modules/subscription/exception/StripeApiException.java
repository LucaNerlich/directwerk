package de.pnnit.directwerk.modules.subscription.exception;

/**
 * Stripe API call failed after the platform was configured.
 */
public class StripeApiException extends RuntimeException {

    public StripeApiException(String message) {
        super(message);
    }

    public StripeApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
