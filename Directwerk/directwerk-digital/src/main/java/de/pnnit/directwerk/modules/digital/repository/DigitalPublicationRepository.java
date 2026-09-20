package de.pnnit.directwerk.modules.digital.repository;

import de.pnnit.directwerk.modules.digital.entity.DigitalPublication;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublicationStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DigitalPublicationRepository extends JpaRepository<DigitalPublication, Long> {

    @EntityGraph(attributePaths = {"asset", "tenant"})
    List<DigitalPublication> findByTenant_IdOrderByUpdatedAtDescIdDesc(Long tenantId);

    @EntityGraph(attributePaths = {"asset", "tenant"})
    Optional<DigitalPublication> findByIdAndTenant_Id(Long id, Long tenantId);

    boolean existsByTenant_IdAndSlug(Long tenantId, String slug);

    boolean existsByTenant_IdAndSlugAndIdNot(Long tenantId, String slug, Long id);

    @EntityGraph(attributePaths = {"asset", "tenant"})
    @Query("""
            select p from DigitalPublication p
            where p.tenant.id = :tenantId
              and p.status = :status
            order by p.publishedAt desc nulls last, p.id desc
            """)
    List<DigitalPublication> findByTenantIdAndStatus(
            @Param("tenantId") Long tenantId,
            @Param("status") DigitalPublicationStatus status
    );

    @EntityGraph(attributePaths = {"asset"})
    List<DigitalPublication> findByTenantIdAndStatusAndAssetIdIn(
            Long tenantId,
            DigitalPublicationStatus status,
            Collection<Long> assetIds
    );
}
