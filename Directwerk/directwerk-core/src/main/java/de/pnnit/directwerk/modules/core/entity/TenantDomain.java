package de.pnnit.directwerk.modules.core.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/**
 * Custom hostname for a tenant. Not Hibernate-filtered: host resolution is a global lookup.
 * Only {@code verified=true} domains bind request traffic.
 */
@Entity
@Table(name = "tenant_domains")
@Getter
@Setter
public class TenantDomain extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, unique = true)
    private String host;

    @Column(nullable = false)
    private boolean verified;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @Column(name = "verification_token", length = 64)
    private String verificationToken;

    @Column(name = "verified_at")
    private Instant verifiedAt;
}
