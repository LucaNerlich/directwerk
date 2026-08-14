package de.pnnit.directwerk.multitenancy;

public class TenantSuspendedException extends RuntimeException {

    public TenantSuspendedException(String host) {
        super("Tenant is suspended: " + host);
    }
}
