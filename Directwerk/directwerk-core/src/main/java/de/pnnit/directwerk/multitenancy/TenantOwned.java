package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.modules.core.entity.Tenant;

/**
 * Marker for entities that carry a {@code tenant_id} discriminator.
 */
public interface TenantOwned {

    Tenant getTenant();
}
