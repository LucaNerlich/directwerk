package de.pnnit.directwerk.modules.digital.repository;

import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {

    // Overrides the inherited findById to eagerly fetch tenant: MediaAssetQueryApi returns this
    // entity across the service boundary to AssetAccessApi, which reads tenant.slug after this
    // read-only transaction has already closed — a lazy proxy there throws
    // LazyInitializationException.
    @EntityGraph(attributePaths = "tenant")
    @Override
    Optional<MediaAsset> findById(Long id);

    /**
     * Re-selects the asset with a pessimistic write lock so concurrent confirm/delete transitions
     * cannot both pass a status check (confirmUpload TOCTOU).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "tenant")
    @Query("select m from MediaAsset m where m.id = :id")
    Optional<MediaAsset> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = "tenant")
    @Query("""
            select m from MediaAsset m
            where (:assetType is null or m.assetType = :assetType)
              and (
                    (:status is not null and m.status = :status)
                    or (:status is null and m.status not in (
                        de.pnnit.directwerk.modules.digital.entity.AssetStatus.ARCHIVED,
                        de.pnnit.directwerk.modules.digital.entity.AssetStatus.PENDING_DELETE
                    ))
                  )
            order by m.id desc
            """)
    List<MediaAsset> findFiltered(
            @Param("assetType") AssetType assetType,
            @Param("status") AssetStatus status,
            Pageable pageable
    );

    /**
     * Assets directly inside one folder. Explicitly scoped by tenant because the result
     * feeds write paths (folder delete reparenting); see {@link #archivePendingByS3Key}.
     */
    @EntityGraph(attributePaths = "tenant")
    @Query("""
            select m from MediaAsset m
            where m.tenant.id = :tenantId
              and m.folderId = :folderId
            order by m.id desc
            """)
    List<MediaAsset> findByTenantIdAndFolderId(
            @Param("tenantId") Long tenantId,
            @Param("folderId") Long folderId
    );

    /**
     * Assets directly inside the given folders. {@code folderIds} must be non-empty;
     * callers branch to {@link #findFiltered} (no folder filter) or
     * {@link #findFilteredUnassigned} instead so no null/empty collection parameter
     * ever reaches JPQL. Tenant scoping comes from the Hibernate tenant filter,
     * like {@link #findFiltered}.
     */
    @EntityGraph(attributePaths = "tenant")
    @Query("""
            select m from MediaAsset m
            where (:assetType is null or m.assetType = :assetType)
              and (
                    (:status is not null and m.status = :status)
                    or (:status is null and m.status not in (
                        de.pnnit.directwerk.modules.digital.entity.AssetStatus.ARCHIVED,
                        de.pnnit.directwerk.modules.digital.entity.AssetStatus.PENDING_DELETE
                    ))
                  )
              and m.folderId in :folderIds
            order by m.id desc
            """)
    List<MediaAsset> findFilteredInFolders(
            @Param("assetType") AssetType assetType,
            @Param("status") AssetStatus status,
            @Param("folderIds") Collection<Long> folderIds,
            Pageable pageable
    );

    /**
     * Assets at the library root ({@code folderId} null). See
     * {@link #findFilteredInFolders} for the tenant-scoping note.
     */
    @EntityGraph(attributePaths = "tenant")
    @Query("""
            select m from MediaAsset m
            where (:assetType is null or m.assetType = :assetType)
              and (
                    (:status is not null and m.status = :status)
                    or (:status is null and m.status not in (
                        de.pnnit.directwerk.modules.digital.entity.AssetStatus.ARCHIVED,
                        de.pnnit.directwerk.modules.digital.entity.AssetStatus.PENDING_DELETE
                    ))
                  )
              and m.folderId is null
            order by m.id desc
            """)
    List<MediaAsset> findFilteredUnassigned(
            @Param("assetType") AssetType assetType,
            @Param("status") AssetStatus status,
            Pageable pageable
    );

    /**
     * Bulk variant of {@link #findById(Long)}: one query, tenant eagerly fetched — same
     * LazyInitializationException rationale as the findById override.
     */
    @EntityGraph(attributePaths = "tenant")
    List<MediaAsset> findAllWithTenantByIdIn(java.util.Collection<Long> ids);

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

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update MediaAsset m
            set m.bytesTransferred = :bytesTransferred
            where m.id = :id
              and m.status = de.pnnit.directwerk.modules.digital.entity.AssetStatus.PENDING
            """)
    int updateBytesTransferred(@Param("id") Long id, @Param("bytesTransferred") long bytesTransferred);

    @EntityGraph(attributePaths = "tenant")
    Optional<MediaAsset> findFirstByTenant_IdAndImportSourceUrlAndAssetTypeAndStatusInOrderByIdDesc(
            Long tenantId,
            String importSourceUrl,
            AssetType assetType,
            Collection<AssetStatus> statuses
    );
}
