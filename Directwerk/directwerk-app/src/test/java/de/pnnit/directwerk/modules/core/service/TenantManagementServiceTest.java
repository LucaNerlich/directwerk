package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class TenantManagementServiceTest {

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantDomainRepository tenantDomainRepository;

    @Mock
    private TenantBrandingRepository tenantBrandingRepository;

    @Mock
    private ModuleManagementService moduleManagementService;

    @Mock
    private TenantInvitationService tenantInvitationService;

    @Mock
    private TenantLookupService tenantLookupService;

    @Mock
    private DirectwerkCacheEviction cacheEviction;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private TenantManagementService service;

    @Test
    void createTenantInvitesFirstTenantAdminInSameServiceTransaction() {
        when(tenantRepository.findBySlug("new-tenant")).thenReturn(Optional.empty());
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(invocation -> {
            Tenant tenant = invocation.getArgument(0);
            tenant.setId(42L);
            return tenant;
        });
        when(tenantBrandingRepository.save(any(TenantBranding.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        TenantInvitationService.InvitationResult invitation =
                new TenantInvitationService.InvitationResult(
                        "admin@example.com",
                        "TENANT_ADMIN",
                        "INVITED",
                        "tenant-admin-token"
                );
        when(tenantInvitationService.invite(42L, "admin@example.com", "First Admin", "TENANT_ADMIN"))
                .thenReturn(invitation);

        TenantManagementService.TenantCreationResult result = service.createTenant(
                "New Tenant",
                "new-tenant",
                null,
                null,
                "admin@example.com",
                "First Admin"
        );

        assertThat(result.tenant().id()).isEqualTo(42L);
        assertThat(result.adminInvitation()).isSameAs(invitation);
        verify(tenantInvitationService).invite(42L, "admin@example.com", "First Admin", "TENANT_ADMIN");
    }

    @Test
    void createTenantEvictsHostAfterAddingPrimaryDomain() {
        when(tenantRepository.findBySlug("new-tenant")).thenReturn(Optional.empty());
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(invocation -> {
            Tenant tenant = invocation.getArgument(0);
            tenant.setId(42L);
            return tenant;
        });
        when(tenantBrandingRepository.save(any(TenantBranding.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(tenantDomainRepository.save(any(TenantDomain.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.createTenant("New Tenant", "new-tenant", "studio.example.com", null);

        verify(tenantDomainRepository).save(any(TenantDomain.class));
        verify(cacheEviction).evictHostAfterCommit("studio.example.com");
    }

    @Test
    void suspendTenantDelegatesLookupAndEvictsPublicCaches() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantLookupService.requireTenant(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView result = service.suspendTenant(7L);

        assertThat(result.status()).isEqualTo("SUSPENDED");
        verify(tenantLookupService).requireTenant(7L);
        verify(cacheEviction).evictTenantPublicCachesAfterCommit(7L);
    }

    @Test
    void reactivateTenantDelegatesLookupAndEvictsPublicCaches() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.SUSPENDED);
        when(tenantLookupService.requireTenant(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView result = service.reactivateTenant(7L);

        assertThat(result.status()).isEqualTo("ACTIVE");
        verify(tenantLookupService).requireTenant(7L);
        verify(cacheEviction).evictTenantPublicCachesAfterCommit(7L);
        verify(cacheEviction, never()).evictHostAfterCommit(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void updateTenantChangesNameAndSlug() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("original-slug");
        tenant.setName("Original Name");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantLookupService.requireTenant(7L)).thenReturn(tenant);
        when(tenantRepository.findBySlug("new-slug")).thenReturn(Optional.empty());
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView updated = service.updateTenant(7L, "New Name", "new-slug");

        assertThat(updated.name()).isEqualTo("New Name");
        assertThat(updated.slug()).isEqualTo("new-slug");
        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(7L, "original-slug"));
        verify(cacheEviction).evictTenantPublicCachesAfterCommit(7L);
    }

    @Test
    void updateTenantRejectsDuplicateSlug() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("second-slug");
        tenant.setName("Second");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantLookupService.requireTenant(7L)).thenReturn(tenant);
        when(tenantRepository.findBySlug("first-slug")).thenReturn(Optional.of(new Tenant()));

        assertThatThrownBy(() -> service.updateTenant(7L, null, "first-slug"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void updateTenantAllowsRenamingWithOwnCurrentSlug() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme Original");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantLookupService.requireTenant(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView updated = service.updateTenant(7L, "Acme Renamed", "acme");

        assertThat(updated.name()).isEqualTo("Acme Renamed");
        assertThat(updated.slug()).isEqualTo("acme");
        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(7L));
        verify(tenantRepository, never()).findBySlug(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void updateTenantLeavesFieldUnchangedWhenBlank() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("keep-slug");
        tenant.setName("Keep Slug");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantLookupService.requireTenant(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView updated = service.updateTenant(7L, "Renamed Only", null);

        assertThat(updated.name()).isEqualTo("Renamed Only");
        assertThat(updated.slug()).isEqualTo("keep-slug");
    }
}
