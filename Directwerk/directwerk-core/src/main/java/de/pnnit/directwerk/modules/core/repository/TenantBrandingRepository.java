package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantBrandingRepository extends JpaRepository<TenantBranding, Long> {

    Optional<TenantBranding> findByTenantId(Long tenantId);
}
