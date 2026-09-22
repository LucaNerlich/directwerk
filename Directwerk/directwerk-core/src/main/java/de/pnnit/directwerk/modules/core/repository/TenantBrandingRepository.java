package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantBrandingRepository extends JpaRepository<TenantBranding, Long> {

    Optional<TenantBranding> findByTenantId(Long tenantId);

    /**
     * Counts branding rows of <em>other</em> tenants that claim the same Umami website id.
     *
     * <p>Native SQL on purpose: Hibernate's tenant {@code @Filter} does not apply to native
     * queries, so this is the only way to detect a website id that another tenant already
     * owns — the cross-tenant read guard for {@code AnalyticsQueryService}.
     */
    @Query(
            value = """
                    SELECT COUNT(*)
                    FROM tenant_branding
                    WHERE umami_website_id = :websiteId
                      AND tenant_id <> :tenantId
                    """,
            nativeQuery = true
    )
    long countOtherTenantsWithWebsiteId(
            @Param("websiteId") String websiteId,
            @Param("tenantId") Long tenantId
    );
}
