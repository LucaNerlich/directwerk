package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

/**
 * Rejects writes that assign a different tenant than the current {@link TenantContext}.
 * Platform paths clear context, so cross-tenant platform writes are allowed.
 */
public class TenantWriteGuardListener {

    /**
     * Enforces that a tenant-owned entity targets the tenant in the current context.
     *
     * @param entity the entity being persisted or updated
     * @throws TenantMismatchException if the entity has no tenant identity or targets a different tenant
     */
    @PrePersist
    @PreUpdate
    public void enforceTenant(Object entity) {
        if (!(entity instanceof TenantOwned owned)) {
            return;
        }
        Long contextTenantId = TenantContext.getTenantId();
        if (contextTenantId == null) {
            return;
        }
        Tenant tenant = owned.getTenant();
        if (tenant == null || tenant.getId() == null) {
            throw new TenantMismatchException("Tenant-owned entity requires tenant matching context");
        }
        if (!contextTenantId.equals(tenant.getId())) {
            throw new TenantMismatchException("Cannot write entity for a different tenant than context");
        }
    }
}
