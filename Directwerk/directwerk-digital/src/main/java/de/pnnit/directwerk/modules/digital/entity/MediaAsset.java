package de.pnnit.directwerk.modules.digital.entity;

import de.pnnit.directwerk.modules.core.entity.BaseEntity;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.multitenancy.TenantFilters;
import de.pnnit.directwerk.multitenancy.TenantOwned;
import de.pnnit.directwerk.multitenancy.TenantWriteGuardListener;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Entity
@Table(
        name = "media_assets",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "s3_key"})
)
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class MediaAsset extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "s3_key", nullable = false, length = 512)
    private String s3Key;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AssetVisibility visibility = AssetVisibility.PRIVATE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AssetScope scope = AssetScope.CONTENT;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", nullable = false, length = 16)
    private AssetType assetType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AssetStatus status = AssetStatus.PENDING;

    @Column(name = "owner_user_id")
    private Long ownerUserId;

    /** Wired when podcast episodes exist (Phase 3). */
    @Column(name = "episode_id")
    private Long episodeId;

    /**
     * Media library folder assignment (issue #146). {@code null} means the asset
     * lives at the library root. Plain id (like {@code episodeId}) — the folder
     * service validates existence and tenant match explicitly.
     */
    @Column(name = "folder_id")
    private Long folderId;

    @Column(name = "mime_type", length = 128)
    private String mimeType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "bytes_transferred", nullable = false)
    private long bytesTransferred;

    @Column(name = "checksum_sha256", length = 64)
    private String checksumSha256;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "import_source_url", length = 2048)
    private String importSourceUrl;

    @PrePersist
    @PreUpdate
    private void validateS3Key() {
        if (s3Key == null || s3Key.isBlank()) {
            throw new IllegalStateException("s3Key must not be null or blank before persisting MediaAsset");
        }
        if (tenant == null || tenant.getSlug() == null || tenant.getSlug().isBlank()) {
            throw new IllegalStateException("MediaAsset must have a tenant with a valid slug before persisting");
        }
        TenantAssetKeys.requireTenantPrefix(tenant.getSlug(), s3Key);
    }
}
