package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ModuleGateServiceTest {

    @Mock
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @InjectMocks
    private ModuleGateService moduleGateService;

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
        when(tenantModuleActivationRepository.findByTenantIdAndModuleKey(1L, "PODCAST"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> moduleGateService.requireModule("PODCAST"))
                .isInstanceOf(ModuleNotEnabledException.class);
    }

    @Test
    void requireModuleAllowsActiveModule() {
        TenantContext.setTenantId(1L);
        TenantModuleActivation activation = new TenantModuleActivation();
        activation.setModuleKey("PODCAST");
        activation.setActive(true);
        when(tenantModuleActivationRepository.findByTenantIdAndModuleKey(1L, "PODCAST"))
                .thenReturn(Optional.of(activation));

        moduleGateService.requireModule("PODCAST");
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
