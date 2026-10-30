package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.TenantApiKey;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenantApiKeyRepository extends JpaRepository<TenantApiKey, Long> {

    List<TenantApiKey> findByTenantIdAndRevokedAtIsNullOrderByCreatedAtDesc(Long tenantId);

    Optional<TenantApiKey> findByTenantIdAndId(Long tenantId, Long id);

    /**
     * Global hash lookup for Bearer auth (runs before {@code TenantContext} is set, so the
     * Hibernate tenant filter is not enabled).
     */
    @Query("""
            SELECT k FROM TenantApiKey k
            JOIN FETCH k.tenant
            JOIN FETCH k.createdBy
            WHERE k.tokenHash = :tokenHash
            """)
    Optional<TenantApiKey> findByTokenHashWithTenant(@Param("tokenHash") String tokenHash);

    boolean existsByTokenHash(String tokenHash);
}
