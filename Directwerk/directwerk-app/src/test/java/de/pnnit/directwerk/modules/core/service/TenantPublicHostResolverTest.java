package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantPublicHostResolverTest {

    private static final Long TENANT_ID = 10L;

    @Mock
    private TenantDomainRepository tenantDomainRepository;

    @InjectMocks
    private TenantPublicHostResolver resolver;

    @Test
    void trustRequestUsesVerifiedRequestedHost() {
        TenantDomain verified = domain(1L, "Podcast.Example.com", true, false);
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(TENANT_ID, "podcast.example.com"))
                .thenReturn(Optional.of(verified));

        assertThat(resolver.resolve(TENANT_ID, "Podcast.Example.com", TenantPublicHostResolver.HostPolicy.TRUST_REQUEST))
                .isEqualTo("podcast.example.com");
    }

    @Test
    void trustRequestFallsBackToPrimaryVerifiedHostWhenRequestIsUnverified() {
        TenantDomain primary = domain(1L, "primary.example.com", true, true);
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(TENANT_ID, "spoof.example.com"))
                .thenReturn(Optional.empty());
        when(tenantDomainRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(primary));

        assertThat(resolver.resolve(TENANT_ID, "spoof.example.com", TenantPublicHostResolver.HostPolicy.TRUST_REQUEST))
                .isEqualTo("primary.example.com");
    }

    @Test
    void primaryPolicyIgnoresRequestedHost() {
        TenantDomain primary = domain(1L, "primary.example.com", true, true);
        when(tenantDomainRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(primary));

        assertThat(resolver.resolve(TENANT_ID, "other.example.com", TenantPublicHostResolver.HostPolicy.PRIMARY))
                .isEqualTo("primary.example.com");
    }

    @Test
    void findPrimaryVerifiedHostPrefersPrimaryThenLowestId() {
        TenantDomain secondary = domain(2L, "secondary.example.com", true, false);
        TenantDomain primary = domain(1L, "primary.example.com", true, true);
        when(tenantDomainRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(secondary, primary));

        assertThat(resolver.findPrimaryVerifiedHost(TENANT_ID)).contains("primary.example.com");
    }

    @Test
    void resolveThrowsWhenNoVerifiedDomainExists() {
        TenantDomain unverified = domain(1L, "pending.example.com", false, true);
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(TENANT_ID, "pending.example.com"))
                .thenReturn(Optional.of(unverified));
        when(tenantDomainRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(unverified));

        assertThatThrownBy(() -> resolver.resolve(
                TENANT_ID,
                "pending.example.com",
                TenantPublicHostResolver.HostPolicy.TRUST_REQUEST
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No verified tenant domain");
    }

    @Test
    void resolveRequiresTenantId() {
        assertThatThrownBy(() -> resolver.resolve(null, "example.com", TenantPublicHostResolver.HostPolicy.PRIMARY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tenantId");
    }

    private static TenantDomain domain(Long id, String host, boolean verified, boolean primary) {
        TenantDomain domain = new TenantDomain();
        domain.setId(id);
        domain.setHost(host);
        domain.setVerified(verified);
        domain.setPrimary(primary);
        return domain;
    }
}
