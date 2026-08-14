package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class TenantDomainServiceTest {

    @Mock
    private TenantDomainRepository tenantDomainRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private DirectwerkCacheEviction cacheEviction;

    @Mock
    private DomainDnsLookup domainDnsLookup;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private TenantDomainService service;

    @Test
    void addDomainClearsExistingPrimaryWhenAddingNewPrimary() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        TenantDomain existingPrimary = new TenantDomain();
        existingPrimary.setHost("old.example.com");
        existingPrimary.setPrimary(true);

        when(tenantDomainRepository.findByHostIgnoreCase("new.example.com")).thenReturn(Optional.empty());
        when(tenantDomainRepository.findByTenantId(1L)).thenReturn(List.of(existingPrimary));
        when(tenantRepository.getReferenceById(1L)).thenReturn(tenant);
        when(tenantDomainRepository.saveAndFlush(org.mockito.ArgumentMatchers.any(TenantDomain.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TenantDomain created = service.addDomain(1L, "new.example.com", true);

        assertThat(existingPrimary.isPrimary()).isFalse();
        assertThat(created.isPrimary()).isTrue();
        assertThat(created.isVerified()).isFalse();
        assertThat(created.getVerificationToken()).isNotBlank();
        assertThat(created.getHost()).isEqualTo("new.example.com");
        verify(cacheEviction).evictHostAfterCommit("new.example.com");
        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(1L));
    }

    @Test
    void verifyDomainAcceptsMatchingTokenWhenFallbackAllowed() {
        TenantDomain domain = new TenantDomain();
        domain.setHost("pending.example.com");
        domain.setVerified(false);
        domain.setVerificationToken("abc123");
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(1L, "pending.example.com"))
                .thenReturn(Optional.of(domain));
        when(domainDnsLookup.lookupTxt("pending.example.com")).thenReturn(List.of());
        when(tenantDomainRepository.saveAndFlush(domain)).thenReturn(domain);

        TenantDomain verified = service.verifyDomain(1L, "pending.example.com", "abc123", true);

        assertThat(verified.isVerified()).isTrue();
        assertThat(verified.getVerifiedAt()).isNotNull();
        verify(cacheEviction).evictHostAfterCommit("pending.example.com");
        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(1L));
    }

    @Test
    void verifyDomainRejectsMissingDnsAndToken() {
        TenantDomain domain = new TenantDomain();
        domain.setHost("pending.example.com");
        domain.setVerified(false);
        domain.setVerificationToken("abc123");
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(1L, "pending.example.com"))
                .thenReturn(Optional.of(domain));
        when(domainDnsLookup.lookupTxt("pending.example.com")).thenReturn(List.of());

        assertThatThrownBy(() -> service.verifyDomain(1L, "pending.example.com", null, false))
                .isInstanceOf(DomainVerificationException.class);
    }

    @Test
    void addDomainRejectsDuplicateHost() {
        TenantDomain existing = new TenantDomain();
        existing.setHost("taken.example.com");
        when(tenantDomainRepository.findByHostIgnoreCase("taken.example.com")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.addDomain(1L, "taken.example.com", false))
                .isInstanceOf(DomainAlreadyExistsException.class);
        verify(cacheEviction, never()).evictHostAfterCommit(org.mockito.ArgumentMatchers.anyString());
        verify(eventPublisher, never()).publishEvent(org.mockito.ArgumentMatchers.any());
    }
}
