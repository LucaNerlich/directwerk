package de.pnnit.directwerk.modules.email.entity;

import de.pnnit.directwerk.modules.core.entity.BaseEntity;
import de.pnnit.directwerk.modules.core.entity.Tenant;
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
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Entity
@Table(name = "tenant_esp_connections")
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class TenantEspConnection extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false, unique = true)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EspProvider provider = EspProvider.MAILGUN;

    @Column(nullable = false)
    private String domain;

    @Column(name = "from_email", nullable = false, length = 320)
    private String fromEmail;

    @Column(name = "from_name")
    private String fromName;

    @Column(nullable = false, length = 8)
    private String region = "EU";

    @Column(name = "api_key_ciphertext", nullable = false, columnDefinition = "text")
    private String apiKeyCiphertext;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EspConnectionStatus status = EspConnectionStatus.CONNECTED;

    @Column(name = "connected_at", nullable = false)
    private Instant connectedAt = Instant.now();
}
