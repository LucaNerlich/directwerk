package de.pnnit.directwerk.modules.email.sender;

/**
 * Transport failure. Jobs retry. Do not put recipient addresses in the message.
 */
public class EmailDeliveryException extends RuntimeException {

    public EmailDeliveryException(String message) {
        super(message);
    }

    public EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
