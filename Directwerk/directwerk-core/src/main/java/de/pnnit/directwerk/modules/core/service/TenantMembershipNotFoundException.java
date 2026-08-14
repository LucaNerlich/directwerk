package de.pnnit.directwerk.modules.core.service;

public class TenantMembershipNotFoundException extends RuntimeException {

    public TenantMembershipNotFoundException(Long tenantId, Long userId) {
        super("Tenant membership not found for tenant " + tenantId + " and user " + userId);
    }
}
