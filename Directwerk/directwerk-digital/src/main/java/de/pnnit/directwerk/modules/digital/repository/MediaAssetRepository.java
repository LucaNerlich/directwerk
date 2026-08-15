package de.pnnit.directwerk.modules.digital.repository;

import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {

    // Overrides the inherited findById to eagerly fetch tenant: MediaAssetQueryApi returns this
    // entity across the service boundary to AssetAccessApi, which reads tenant.slug after this
    // read-only transaction has already closed — a lazy proxy there throws
    // LazyInitializationException.
    @EntityGraph(attributePaths = "tenant")
    @Override
    Optional<MediaAsset> findById(Long id);

    @EntityGraph(attributePaths = "tenant")
    @Query("""
            select m from MediaAsset m
            where (:assetType is null or m.assetType = :assetType)
              and (:status is null or m.status = :status)
            order by m.id desc
            """)
    List<MediaAsset> findFiltered(
            @Param("assetType") AssetType assetType,
            @Param("status") AssetStatus status,
            Pageable pageable
    );

    /**
     * Tombstones a {@code PENDING} asset whose staging object was purged. Explicitly scoped by
     * tenant because Hibernate filters do not apply to bulk updates.
     */
    @Modifying
    @Query("""
            update MediaAsset m
            set m.status = de.pnnit.directwerk.modules.digital.entity.AssetStatus.ARCHIVED
            where m.tenant.id = :tenantId
              and m.s3Key = :s3Key
              and m.status = de.pnnit.directwerk.modules.digital.entity.AssetStatus.PENDING
            """)
    int archivePendingByS3Key(@Param("tenantId") Long tenantId, @Param("s3Key") String s3Key);
}
