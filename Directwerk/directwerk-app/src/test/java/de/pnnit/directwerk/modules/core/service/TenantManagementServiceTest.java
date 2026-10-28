package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

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
    void createTenantActivatesCoreModulesWithoutPreset() {
        stubTenantCreation();
        when(moduleManagementService.listAllModules()).thenReturn(List.of(
                new ModuleManagementService.ModuleView("DIGITAL_CONTENT", "Digital Content", null, List.of(), true),
                new ModuleManagementService.ModuleView("PODCAST", "Podcast", null, List.of("DIGITAL_CONTENT"), false)
        ));

        service.createTenant("New Tenant", "new-tenant", null, null);

        verify(moduleManagementService).activateModule(42L, "DIGITAL_CONTENT");
        verify(moduleManagementService, never()).activateModule(42L, "PODCAST");
        verify(moduleManagementService, never()).applyPreset(any(), any());
    }

    @Test
    void createTenantActivatesCoreModulesWhenPresetIsSupplied() {
        stubTenantCreation();
        when(moduleManagementService.listAllModules()).thenReturn(List.of(
                new ModuleManagementService.ModuleView("DIGITAL_CONTENT", "Digital Content", null, List.of(), true)
        ));

        service.createTenant("New Tenant", "new-tenant", null, "FREE_PODCAST");

        verify(moduleManagementService).activateModule(42L, "DIGITAL_CONTENT");
        verify(moduleManagementService).applyPreset(42L, "FREE_PODCAST");
    }

    private void stubTenantCreation() {
        when(tenantRepository.findBySlug("new-tenant")).thenReturn(Optional.empty());
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(invocation -> {
            Tenant tenant = invocation.getArgument(0);
            tenant.setId(42L);
            return tenant;
        });
        when(tenantBrandingRepository.save(any(TenantBranding.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void suspendTenantDelegatesLookupAndEvictsPublicCaches() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView result = service.suspendTenant(7L);

        assertThat(result.status()).isEqualTo("SUSPENDED");
        verify(tenantRepository).requireById(7L);
        verify(cacheEviction).evictTenantPublicCachesAfterCommit(7L);
    }

    @Test
    void reactivateTenantDelegatesLookupAndEvictsPublicCaches() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.SUSPENDED);
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView result = service.reactivateTenant(7L);

        assertThat(result.status()).isEqualTo("ACTIVE");
        verify(tenantRepository).requireById(7L);
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
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
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
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
        when(tenantRepository.findBySlug("first-slug")).thenReturn(Optional.of(new Tenant()));

        assertThatThrownBy(() -> service.updateTenant(7L, null, "first-slug"))
                .isInstanceOf(de.pnnit.directwerk.modules.core.exception.ConflictException.class);
    }

    @Test
    void updateTenantAllowsRenamingWithOwnCurrentSlug() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme Original");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
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
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView updated = service.updateTenant(7L, "Renamed Only", null);

        assertThat(updated.name()).isEqualTo("Renamed Only");
        assertThat(updated.slug()).isEqualTo("keep-slug");
    }

    @Test
    void updateContactEmailMarksRssSnapshotsStale() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView updated =
                service.updateContactEmail(7L, " Podcast@Acme.example ");

        assertThat(updated.contactEmail()).isEqualTo("podcast@acme.example");
        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(7L));
    }

    @Test
    void updateContactEmailClearsBlankAndMarksStale() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme");
        tenant.setContactEmail("old@acme.example");
        tenant.setStatus(TenantStatus.ACTIVE);
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantManagementService.TenantDetailView updated = service.updateContactEmail(7L, "  ");

        assertThat(updated.contactEmail()).isNull();
        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(7L));
    }

    @Test
    void updateUploadLimitsPersistsOverridesAndResetsOthersToDefault() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        when(tenantRepository.requireById(7L)).thenReturn(tenant);
        when(tenantRepository.save(tenant)).thenReturn(tenant);

        TenantUploadLimits result = service.updateUploadLimits(
                7L, new TenantUploadLimits(100L * 1024 * 1024, null, null, 50L * 1024 * 1024));

        assertThat(result.maxAudioBytes()).isEqualTo(100L * 1024 * 1024);
        assertThat(result.maxImageBytes()).isNull();
        assertThat(result.maxVideoBytes()).isNull();
        assertThat(result.maxDocumentBytes()).isEqualTo(50L * 1024 * 1024);
        assertThat(tenant.getMaxAudioBytes()).isEqualTo(100L * 1024 * 1024);
        assertThat(tenant.getMaxImageBytes()).isNull();
        verify(cacheEviction).evictTenantPublicCachesAfterCommit(7L);
    }

    @Test
    void updateUploadLimitsRejectsOutOfRangeOverride() {
        // Range validation happens in the TenantUploadLimits constructor, before
        // any repository access — invalid input never reaches persistence.
        assertThatThrownBy(() -> service.updateUploadLimits(
                7L, new TenantUploadLimits(0L, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.updateUploadLimits(
                7L, new TenantUploadLimits(null, 6L * 1024 * 1024 * 1024, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(tenantRepository, never()).save(any(Tenant.class));
    }

    @Test
    void listTenantsPagesAndReportsTheTotal() {
        // #438: the list used to return the first 1000 tenants with no way to reach the rest, so
        // the platform UI silently truncated a larger estate.
        when(tenantRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(
                List.of(tenant(1L, "alpha"), tenant(2L, "beta")), PageRequest.of(2, 2), 11));
        when(tenantDomainRepository.findByTenantIdIn(List.of(1L, 2L))).thenReturn(List.of());

        TenantManagementService.TenantPage result = service.listTenants(2, 2);

        assertThat(result.totalElements()).isEqualTo(11);
        assertThat(result.page()).isEqualTo(2);
        assertThat(result.size()).isEqualTo(2);
        assertThat(result.content()).extracting(TenantManagementService.TenantListItemView::slug)
                .containsExactly("alpha", "beta");

        // A stable sort by id keeps pages from shuffling between requests.
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(tenantRepository).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(2);
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by("id").ascending());
        // One query for the whole page, not one per row.
        verify(tenantDomainRepository, never()).findByTenantId(anyLong());
    }

    @Test
    void listTenantsClampsThePageSizeToTheControllerMaximum() {
        when(tenantRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        service.listTenants(-1, 5_000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(tenantRepository).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
    }

    private static Tenant tenant(Long id, String slug) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug(slug);
        tenant.setName(slug);
        tenant.setStatus(TenantStatus.ACTIVE);
        return tenant;
    }

    @Test
    void tenantDetailViewExposesUploadLimits() {
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        tenant.setSlug("acme");
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant.setMaxAudioBytes(100L * 1024 * 1024);
        when(tenantRepository.requireById(7L)).thenReturn(tenant);

        TenantManagementService.TenantDetailView view = service.getTenant(7L);

        assertThat(view.uploadLimits().maxAudioBytes()).isEqualTo(100L * 1024 * 1024);
        assertThat(view.uploadLimits().maxVideoBytes()).isNull();
    }
}
