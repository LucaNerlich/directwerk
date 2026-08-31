package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenantDomainRepository extends JpaRepository<TenantDomain, Long> {

    Optional<TenantDomain> findByHostIgnoreCase(String host);

    @Query("""
            select domain from TenantDomain domain
            join fetch domain.tenant
            where lower(domain.host) = lower(:host)
            """)
    Optional<TenantDomain> findByHostIgnoreCaseWithTenant(@Param("host") String host);

    @Query("""
            select domain from TenantDomain domain
            join fetch domain.tenant
            where lower(domain.host) = lower(:host)
              and domain.verified = true
            """)
    Optional<TenantDomain> findVerifiedByHostIgnoreCaseWithTenant(@Param("host") String host);

    @Query("""
            select domain from TenantDomain domain
            where domain.tenant.id = :tenantId
              and lower(domain.host) = lower(:host)
            """)
    Optional<TenantDomain> findByTenantIdAndHostIgnoreCase(
            @Param("tenantId") Long tenantId,
            @Param("host") String host
    );

    List<TenantDomain> findByTenantId(Long tenantId);

    @Query("""
            select domain from TenantDomain domain
            where domain.tenant.id = :tenantId
              and domain.verified = true
            order by domain.primary desc, domain.id asc
            """)
    List<TenantDomain> findVerifiedByTenantIdOrderByPrimaryDescIdAsc(@Param("tenantId") Long tenantId);
}
