package de.pnnit.directwerk.modules.stripebilling.exception;

/**
 * Platform Stripe keys are missing. Money paths must fail closed (501), not invent access.
 */
public class StripeNotConfiguredException extends RuntimeException {

    public StripeNotConfiguredException(String message) {
        super(message);
    }
}
