package de.pnnit.directwerk.multitenancy;

public class TenantMismatchException extends RuntimeException {

    public TenantMismatchException() {
        this("Authenticated tenant membership does not match Host");
    }

    /**
     * Creates an exception with the specified message.
     *
     * @param message the detail message
     */
    public TenantMismatchException(String message) {
        super(message);
    }
}
