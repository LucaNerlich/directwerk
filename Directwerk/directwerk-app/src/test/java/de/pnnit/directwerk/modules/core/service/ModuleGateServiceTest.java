package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

@ExtendWith(MockitoExtension.class)
class ModuleGateServiceTest {

    @Mock
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Mock
    private ObjectProvider<ModuleGateService> selfProvider;

    @InjectMocks
    private ModuleGateService moduleGateService;

    @BeforeEach
    void wireSelfReference() {
        // Mirrors the Spring runtime: the provider hands out the (proxied) service itself,
        // so the cached enabledModuleKeys read participates in caching. Lenient: tests that
        // never enforce (isModuleActive, direct enabledModuleKeys reads, fail-closed paths)
        // legitimately leave the provider untouched.
        org.mockito.Mockito.lenient().when(selfProvider.getObject()).thenReturn(moduleGateService);
    }

    @AfterEach
    void cleanup() {
        TenantContext.clear();
    }

    @Test
    void requireModuleThrowsWhenTenantContextMissing() {
        assertThatThrownBy(() -> moduleGateService.requireModule("PODCAST"))
                .isInstanceOf(ModuleNotEnabledException.class);
    }

    @Test
    void requireModuleThrowsWhenModuleInactive() {
        TenantContext.setTenantId(1L);
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L))
                .thenReturn(List.of());

        assertThatThrownBy(() -> moduleGateService.requireModule("PODCAST"))
                .isInstanceOf(ModuleNotEnabledException.class)
                .hasMessageContaining("PODCAST");
    }

    @Test
    void requireModuleAllowsActiveModule() {
        TenantContext.setTenantId(1L);
        TenantModuleActivation activation = new TenantModuleActivation();
        activation.setModuleKey("PODCAST");
        activation.setActive(true);
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L))
                .thenReturn(List.of(activation));

        moduleGateService.requireModule("PODCAST");
    }

    @Test
    void requireModulesEnforcesEveryKeyWithASingleActivationRead() {
        TenantContext.setTenantId(1L);
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L))
                .thenReturn(List.of(active("PODCAST"), active("PODCAST_RSS"), active("SUBSCRIPTION")));

        moduleGateService.requireModules(List.of("PODCAST", "PODCAST_RSS", "SUBSCRIPTION"));

        verify(tenantModuleActivationRepository, times(1)).findByTenantIdAndActiveTrue(1L);
    }

    @Test
    void requireModulesNamesTheFirstMissingKey() {
        TenantContext.setTenantId(1L);
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L))
                .thenReturn(List.of(active("PODCAST")));

        assertThatThrownBy(() -> moduleGateService.requireModules(List.of("PODCAST", "PODCAST_RSS")))
                .isInstanceOf(ModuleNotEnabledException.class)
                .hasMessageContaining("PODCAST_RSS");
    }

    @Test
    void requireModulesFailsClosedWithoutTenantContext() {
        assertThatThrownBy(() -> moduleGateService.requireModules(List.of("PODCAST")))
                .isInstanceOf(ModuleNotEnabledException.class);
    }

    private static TenantModuleActivation active(String moduleKey) {
        TenantModuleActivation activation = new TenantModuleActivation();
        activation.setModuleKey(moduleKey);
        activation.setActive(true);
        return activation;
    }

    @Test
    void enabledModuleKeysReturnsActiveKeys() {
        TenantModuleActivation podcast = new TenantModuleActivation();
        podcast.setModuleKey("PODCAST");
        podcast.setActive(true);
        TenantModuleActivation rss = new TenantModuleActivation();
        rss.setModuleKey("PODCAST_RSS");
        rss.setActive(true);
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(2L))
                .thenReturn(List.of(podcast, rss));

        Set<String> keys = moduleGateService.enabledModuleKeys(2L);

        assertThat(keys).containsExactlyInAnyOrder("PODCAST", "PODCAST_RSS");
    }

    @Test
    void isModuleActiveWorksWithoutTenantContext() {
        TenantModuleActivation activation = new TenantModuleActivation();
        activation.setModuleKey("SUBSCRIPTION");
        activation.setActive(true);
        when(tenantModuleActivationRepository.findByTenantIdAndModuleKey(3L, "SUBSCRIPTION"))
                .thenReturn(Optional.of(activation));

        assertThat(moduleGateService.isModuleActive(3L, "SUBSCRIPTION")).isTrue();
        assertThat(moduleGateService.isModuleActive(3L, "PODCAST")).isFalse();
    }
}
