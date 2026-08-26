package de.pnnit.directwerk.multitenancy;

public class TenantNotFoundException extends RuntimeException {

    public TenantNotFoundException(String host) {
        super("No tenant found for host: " + host);
    }

    public TenantNotFoundException(Long tenantId) {
        super("No tenant found for id: " + tenantId);
    }
}
