package de.pnnit.directwerk.modules.core.entity;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

/**
 * Per-editor permission override managed by tenant admins (issue #148).
 * Rows are deny-only: presence of a row takes a right away from the role
 * baseline, so overrides can never escalate beyond the {@code EDITOR} role.
 * Overrides never apply to tenant admins. Deactivating a membership is
 * unaffected (rows survive), deleting the membership cascades them away.
 */
@Entity
@Table(
        name = "membership_permission_overrides",
        uniqueConstraints = @UniqueConstraint(
                columnNames = {"membership_id", "entity_type", "operation", "scope"})
)
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class MembershipPermissionOverride extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membership_id", nullable = false)
    private TenantMembership membership;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 32)
    private ContentEntityType entityType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ContentOperation operation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private RestrictionScope scope;
}
