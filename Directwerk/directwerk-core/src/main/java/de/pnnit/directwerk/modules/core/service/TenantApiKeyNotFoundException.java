package de.pnnit.directwerk.modules.core.service;

public class TenantApiKeyNotFoundException extends RuntimeException {

    public TenantApiKeyNotFoundException(Long id) {
        super("Tenant API key not found: " + id);
    }
}
