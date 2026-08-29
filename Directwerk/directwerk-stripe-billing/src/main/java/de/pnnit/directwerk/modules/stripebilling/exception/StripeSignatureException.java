package de.pnnit.directwerk.modules.stripebilling.exception;

/**
 * Inbound Stripe webhook failed signature verification.
 */
public class StripeSignatureException extends RuntimeException {

    public StripeSignatureException(String message) {
        super(message);
    }

    public StripeSignatureException(String message, Throwable cause) {
        super(message, cause);
    }
}
