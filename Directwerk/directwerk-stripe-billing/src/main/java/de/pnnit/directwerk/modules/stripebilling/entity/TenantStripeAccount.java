package de.pnnit.directwerk.modules.stripebilling.entity;

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

@Entity
@Table(name = "tenant_stripe_accounts")
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class TenantStripeAccount extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "stripe_account_id", nullable = false, unique = true, length = 64)
    private String stripeAccountId;

    @Column(name = "charges_enabled", nullable = false)
    private boolean chargesEnabled;

    @Column(name = "payouts_enabled", nullable = false)
    private boolean payoutsEnabled;

    @Column(name = "details_submitted", nullable = false)
    private boolean detailsSubmitted;

    @Column(nullable = false, length = 32)
    private String status = "PENDING";
}
