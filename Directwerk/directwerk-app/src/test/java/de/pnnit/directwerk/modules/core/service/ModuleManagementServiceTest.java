package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.FeatureModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.repository.FeatureModuleRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class ModuleManagementServiceTest {

    @Mock
    private FeatureModuleRepository featureModuleRepository;

    @Mock
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Mock
    private TenantLookupService tenantLookupService;

    @Mock
    private DirectwerkCacheEviction cacheEviction;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private ModuleManagementService service;

    @Test
    void deactivateModuleRejectsCoreModule() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        when(tenantLookupService.requireTenant(1L)).thenReturn(tenant);

        FeatureModule digitalContent = coreModule("DIGITAL_CONTENT");
        when(featureModuleRepository.findByModuleKey("DIGITAL_CONTENT")).thenReturn(Optional.of(digitalContent));

        assertThatThrownBy(() -> service.deactivateModule(1L, "DIGITAL_CONTENT"))
                .isInstanceOf(CannotDeactivateCoreModuleException.class)
                .hasMessageContaining("DIGITAL_CONTENT");

        verify(tenantModuleActivationRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(cacheEviction, never()).evictTenantPublicCachesAfterCommit(1L);
    }

    @Test
    void deactivateModuleAllowsNonCoreModule() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        when(tenantLookupService.requireTenant(1L)).thenReturn(tenant);

        FeatureModule podcast = module("PODCAST", List.of("DIGITAL_CONTENT"));
        when(featureModuleRepository.findByModuleKey("PODCAST")).thenReturn(Optional.of(podcast));
        when(featureModuleRepository.findAll()).thenReturn(List.of(podcast));

        TenantModuleActivation activation = new TenantModuleActivation();
        activation.setModuleKey("PODCAST");
        activation.setActive(true);
        when(tenantModuleActivationRepository.findByTenantIdAndModuleKey(1L, "PODCAST"))
                .thenReturn(Optional.of(activation));
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L))
                .thenReturn(List.of());

        ModuleManagementService.TenantModulesView result = service.deactivateModule(1L, "PODCAST");

        assertThat(result.enabledModules()).isEmpty();
        verify(tenantModuleActivationRepository).save(activation);
        assertThat(activation.isActive()).isFalse();
        verify(cacheEviction).evictTenantPublicCachesAfterCommit(1L);
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void activatePodcastRssRequestsSnapshotRefresh() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        when(tenantLookupService.requireTenant(1L)).thenReturn(tenant);

        FeatureModule rss = module("PODCAST_RSS", List.of("PODCAST"));
        when(featureModuleRepository.findByModuleKey("PODCAST_RSS")).thenReturn(Optional.of(rss));
        TenantModuleActivation podcast = new TenantModuleActivation();
        podcast.setId(8L);
        podcast.setModuleKey("PODCAST");
        podcast.setActive(true);
        when(tenantModuleActivationRepository.findByTenantIdAndModuleKey(1L, "PODCAST"))
                .thenReturn(Optional.of(podcast));
        when(tenantModuleActivationRepository.findByTenantIdAndModuleKey(1L, "PODCAST_RSS"))
                .thenReturn(Optional.empty());
        when(tenantModuleActivationRepository.save(any(TenantModuleActivation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L)).thenReturn(List.of());

        service.activateModule(1L, "PODCAST_RSS");

        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(1L));
    }

    @Test
    void deactivatePodcastRssRequestsSnapshotWithdraw() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        when(tenantLookupService.requireTenant(1L)).thenReturn(tenant);

        FeatureModule rss = module("PODCAST_RSS", List.of("PODCAST"));
        when(featureModuleRepository.findByModuleKey("PODCAST_RSS")).thenReturn(Optional.of(rss));
        when(featureModuleRepository.findAll()).thenReturn(List.of(rss));
        TenantModuleActivation activation = new TenantModuleActivation();
        activation.setModuleKey("PODCAST_RSS");
        activation.setActive(true);
        when(tenantModuleActivationRepository.findByTenantIdAndModuleKey(1L, "PODCAST_RSS"))
                .thenReturn(Optional.of(activation));
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L)).thenReturn(List.of());

        service.deactivateModule(1L, "PODCAST_RSS");

        verify(eventPublisher).publishEvent(new TenantRssSnapshotStaleEvent(1L));
        assertThat(activation.isActive()).isFalse();
    }

    private static FeatureModule coreModule(String moduleKey) {
        FeatureModule module = module(moduleKey, List.of());
        module.setCore(true);
        return module;
    }

    private static FeatureModule module(String moduleKey, List<String> dependsOn) {
        FeatureModule module = new FeatureModule();
        module.setModuleKey(moduleKey);
        module.setName(moduleKey);
        module.setDependsOn(dependsOn);
        module.setPlatformActive(true);
        return module;
    }
}
