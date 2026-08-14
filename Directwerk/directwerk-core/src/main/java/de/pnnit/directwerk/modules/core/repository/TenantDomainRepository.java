package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenantDomainRepository extends JpaRepository<TenantDomain, Long> {

    Optional<TenantDomain> findByHostIgnoreCase(String host);

    /**
     * Finds a tenant domain by host using a case-insensitive comparison and includes its tenant.
     *
     * @param host the host to match
     * @return the matching tenant domain with its tenant, or an empty {@code Optional} if no match exists
     */
    @Query("""
            select domain from TenantDomain domain
            join fetch domain.tenant
            where lower(domain.host) = lower(:host)
            """)
    Optional<TenantDomain> findByHostIgnoreCaseWithTenant(@Param("host") String host);

    /**
     * Finds a verified tenant domain by its host name, ignoring case.
     *
     * @param host the host name to search for
     * @return the matching verified tenant domain with its tenant, or an empty optional if none exists
     */
    @Query("""
            select domain from TenantDomain domain
            join fetch domain.tenant
            where lower(domain.host) = lower(:host)
              and domain.verified = true
            """)
    Optional<TenantDomain> findVerifiedByHostIgnoreCaseWithTenant(@Param("host") String host);

    /**
     * Finds a tenant domain by tenant identifier and case-insensitive host.
     *
     * @param tenantId the identifier of the tenant
     * @param host     the host to match
     * @return the matching tenant domain, or an empty optional if none exists
     */
    @Query("""
            select domain from TenantDomain domain
            where domain.tenant.id = :tenantId
              and lower(domain.host) = lower(:host)
            """)
    Optional<TenantDomain> findByTenantIdAndHostIgnoreCase(
            @Param("tenantId") Long tenantId,
            @Param("host") String host
    );

    /**
 * Retrieves all domain records associated with a tenant.
 *
 * @param tenantId the tenant identifier
 * @return the tenant's domains, or an empty list if none exist
 */
List<TenantDomain> findByTenantId(Long tenantId);
}
