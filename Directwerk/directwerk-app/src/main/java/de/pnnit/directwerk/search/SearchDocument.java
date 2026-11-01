package de.pnnit.directwerk.search;

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
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Entity
@Table(
        name = "search_document",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_search_document_source",
                columnNames = {"tenant_id", "kind", "source_id"}
        )
)
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class SearchDocument extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 32)
    private String kind;

    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 64)
    private String slug;

    @Column(name = "plain_text", nullable = false, columnDefinition = "text")
    private String plainText;

    @Column(nullable = false, columnDefinition = "text")
    private String excerpt;

    @Column(name = "href_path", nullable = false, length = 160)
    private String hrefPath;

    @Column(nullable = false, length = 8)
    private String access;
}
