package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = ModuleGateServiceTest.TestConfig.class)
class ModuleGateServiceTest {

    @Autowired
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Autowired
    private ModuleGateService moduleGateService;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void resetState() {
        reset(tenantModuleActivationRepository);
        cacheManager.getCache(DirectwerkCacheNames.TENANT_MODULE_KEYS).clear();
        TenantContext.clear();
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
    void requireModulesUsesCachedSpringProxyReadAcrossCalls() {
        TenantContext.setTenantId(1L);
        when(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(1L))
                .thenReturn(List.of(active("PODCAST"), active("PODCAST_RSS"), active("SUBSCRIPTION")));

        moduleGateService.requireModules(List.of("PODCAST", "PODCAST_RSS", "SUBSCRIPTION"));
        moduleGateService.requireModule("PODCAST");

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

    @Configuration(proxyBeanMethods = false)
    @EnableCaching
    static class TestConfig {

        @Bean
        TenantModuleActivationRepository tenantModuleActivationRepository() {
            return mock(TenantModuleActivationRepository.class);
        }

        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager(
                    DirectwerkCacheNames.TENANT_MODULE_KEYS);
        }

        @Bean
        ModuleGateService moduleGateService(
                TenantModuleActivationRepository repository,
                ObjectProvider<ModuleGateService> selfProvider
        ) {
            return new ModuleGateService(repository, selfProvider);
        }
    }
}
