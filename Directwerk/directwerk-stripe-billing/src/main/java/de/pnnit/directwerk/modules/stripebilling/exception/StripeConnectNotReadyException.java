package de.pnnit.directwerk.modules.stripebilling.exception;

/**
 * Tenant Connect account cannot take charges yet.
 */
public class StripeConnectNotReadyException extends RuntimeException {

    public StripeConnectNotReadyException(String message) {
        super(message);
    }
}
