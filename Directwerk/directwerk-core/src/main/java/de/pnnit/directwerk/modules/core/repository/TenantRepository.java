package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<Tenant, Long> {

    Optional<Tenant> findBySlug(String slug);

    long countByStatus(TenantStatus status);

    /** Loads a tenant or throws {@link TenantNotFoundException}. */
    default Tenant requireById(Long tenantId) {
        return findById(tenantId).orElseThrow(() -> new TenantNotFoundException(tenantId));
    }
}
