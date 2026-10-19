package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenantRepository extends JpaRepository<Tenant, Long> {

    Optional<Tenant> findBySlug(String slug);

    /**
     * Estate-wide tenant search for the platform console (issue #551): name, slug or any
     * verified/unverified custom domain, case-insensitively.
     */
    @Query("""
            SELECT t FROM Tenant t
            WHERE lower(t.name) LIKE lower(concat('%', :query, '%'))
               OR lower(t.slug) LIKE lower(concat('%', :query, '%'))
               OR EXISTS (
                    SELECT 1 FROM TenantDomain d
                    WHERE d.tenant = t
                      AND lower(d.host) LIKE lower(concat('%', :query, '%'))
               )
            """)
    Page<Tenant> search(@Param("query") String query, Pageable pageable);

    long countByStatus(TenantStatus status);

    /** Loads a tenant or throws {@link TenantNotFoundException}. */
    default Tenant requireById(Long tenantId) {
        return findById(tenantId).orElseThrow(() -> new TenantNotFoundException(tenantId));
    }
}
