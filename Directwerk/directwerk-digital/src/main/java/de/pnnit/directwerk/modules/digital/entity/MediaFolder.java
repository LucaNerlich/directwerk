package de.pnnit.directwerk.modules.digital.entity;

import de.pnnit.directwerk.modules.core.entity.BaseEntity;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.multitenancy.TenantFilters;
import de.pnnit.directwerk.multitenancy.TenantOwned;
import de.pnnit.directwerk.multitenancy.TenantWriteGuardListener;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

/**
 * User-facing folder in the media library. Folders are pure organization
 * metadata — asset S3 keys stay flat and immutable, so moving an asset or a
 * folder is a single {@code folder_id}/{@code parent_id} UPDATE. A {@code null}
 * parent is the library root; a {@code null} asset {@code folderId} is unassigned.
 */
@Entity
@Table(name = "media_folders")
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class MediaFolder extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 255)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private MediaFolder parent;

    /**
     * Creator for the RBAC permission model (issue #148). {@code null} means a
     * legacy row and counts as not-owned — tenant admins can still act on it.
     */
    @Column(name = "created_by")
    private Long createdBy;
}
