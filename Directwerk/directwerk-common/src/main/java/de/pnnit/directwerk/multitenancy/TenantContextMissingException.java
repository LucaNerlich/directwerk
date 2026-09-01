package de.pnnit.directwerk.multitenancy;

public class TenantContextMissingException extends RuntimeException {

    public TenantContextMissingException() {
        super("Tenant context is required for this operation");
    }
}
