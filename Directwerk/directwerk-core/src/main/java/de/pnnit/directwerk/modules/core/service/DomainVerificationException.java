package de.pnnit.directwerk.modules.core.service;

public class DomainVerificationException extends RuntimeException {

    /**
     * Creates an exception with the specified domain verification failure message.
     *
     * @param message the domain verification failure message
     */
    public DomainVerificationException(String message) {
        super(message);
    }
}
