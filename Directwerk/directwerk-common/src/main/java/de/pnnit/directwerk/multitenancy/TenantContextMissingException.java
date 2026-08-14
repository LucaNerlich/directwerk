package de.pnnit.directwerk.multitenancy;

public class TenantContextMissingException extends RuntimeException {

    /**
     * Creates an exception indicating that tenant context is required for the operation.
     */
    public TenantContextMissingException() {
        super("Tenant context is required for this operation");
    }
}
