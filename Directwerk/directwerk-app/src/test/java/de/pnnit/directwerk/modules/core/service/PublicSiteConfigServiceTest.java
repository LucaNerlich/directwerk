package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PublicSiteConfigServiceTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private TenantBrandingRepository tenantBrandingRepository;

    @Mock
    private ModuleGateService moduleGateService;

    private final StudioNavigationService studioNavigationService = new StudioNavigationService();

    @Test
    void publicRssUrlUsesDefaultHttpsSchemeAndOmitsDefaultPort() {
        Tenant tenant = tenant(1L, "alpha", "Alpha Podcast");
        when(tenantResolver.resolveHost("alpha.example.test")).thenReturn(Optional.of(tenant));
        when(tenantBrandingRepository.findByTenantId(1L)).thenReturn(Optional.empty());
        when(moduleGateService.enabledModuleKeys(1L))
                .thenReturn(Set.of("DIGITAL_CONTENT", "PODCAST", "PODCAST_RSS"));

        PublicSiteConfigService.SiteConfigView config =
                service().loadSiteConfig("https", "alpha.example.test", 443);

        assertThat(config.publicSiteUrl()).isEqualTo("https://alpha.example.test");
        assertThat(config.publicRssUrl()).isEqualTo("https://alpha.example.test/feeds/alpha/podcast.xml");
    }

    @Test
    void publicRssUrlIncludesNonDefaultPortFromRequest() {
        Tenant tenant = tenant(1L, "alpha", "Alpha Podcast");
        when(tenantResolver.resolveHost("localhost")).thenReturn(Optional.of(tenant));
        when(tenantBrandingRepository.findByTenantId(1L)).thenReturn(Optional.empty());
        when(moduleGateService.enabledModuleKeys(1L))
                .thenReturn(Set.of("DIGITAL_CONTENT", "PODCAST", "PODCAST_RSS"));

        PublicSiteConfigService.SiteConfigView config =
                service().loadSiteConfig("http", "localhost", 8080);

        assertThat(config.publicSiteUrl()).isEqualTo("http://localhost:8080");
        assertThat(config.publicRssUrl()).isEqualTo("http://localhost:8080/feeds/alpha/podcast.xml");
    }

    @Test
    void publicRssUrlIsNullWhenPodcastRssModuleDisabled() {
        Tenant tenant = tenant(1L, "alpha", "Alpha Podcast");
        when(tenantResolver.resolveHost("alpha.example.test")).thenReturn(Optional.of(tenant));
        when(tenantBrandingRepository.findByTenantId(1L)).thenReturn(Optional.empty());
        when(moduleGateService.enabledModuleKeys(1L)).thenReturn(Set.of("DIGITAL_CONTENT"));

        PublicSiteConfigService.SiteConfigView config =
                service().loadSiteConfig("https", "alpha.example.test", 443);

        assertThat(config.publicSiteUrl()).isEqualTo("https://alpha.example.test");
        assertThat(config.publicRssUrl()).isNull();
        assertThat(config.emailNotifyAvailable()).isFalse();
    }

    @Test
    void emailNotifyAvailableRequiresModuleAndPlatformEmail() {
        Tenant tenant = tenant(1L, "alpha", "Alpha Podcast");
        when(tenantResolver.resolveHost("alpha.example.test")).thenReturn(Optional.of(tenant));
        when(tenantBrandingRepository.findByTenantId(1L)).thenReturn(Optional.empty());
        when(moduleGateService.enabledModuleKeys(1L))
                .thenReturn(Set.of("DIGITAL_CONTENT", "EMAIL_NOTIFY"));
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);

        PublicSiteConfigService.SiteConfigView config =
                service().loadSiteConfig("https", "alpha.example.test", 443);

        assertThat(config.emailNotifyAvailable()).isTrue();
    }

    @Test
    void emailNotifyAvailableIsFalseWhenPlatformEmailDisabled() {
        Tenant tenant = tenant(1L, "alpha", "Alpha Podcast");
        when(tenantResolver.resolveHost("alpha.example.test")).thenReturn(Optional.of(tenant));
        when(tenantBrandingRepository.findByTenantId(1L)).thenReturn(Optional.empty());
        when(moduleGateService.enabledModuleKeys(1L))
                .thenReturn(Set.of("DIGITAL_CONTENT", "EMAIL_NOTIFY"));
        when(directwerkConfig.isEmailEnabled()).thenReturn(false);

        PublicSiteConfigService.SiteConfigView config =
                service().loadSiteConfig("https", "alpha.example.test", 443);

        assertThat(config.emailNotifyAvailable()).isFalse();
    }

    @Test
    void analyticsUsesTenantUmamiHostWhenConfigured() {
        Tenant tenant = tenant(1L, "alpha", "Alpha Podcast");
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("12345678-abcd-abcd-abcd-abcdefabcdef");
        // Public IP literal: routable without DNS in tests.
        branding.setUmamiHostUrl("https://8.8.8.8");
        when(tenantResolver.resolveHost("alpha.example.test")).thenReturn(Optional.of(tenant));
        when(tenantBrandingRepository.findByTenantId(1L)).thenReturn(Optional.of(branding));
        when(moduleGateService.enabledModuleKeys(1L))
                .thenReturn(Set.of("DIGITAL_CONTENT", AnalyticsModule.KEY));

        PublicSiteConfigService.SiteConfigView config =
                service().loadSiteConfig("https", "alpha.example.test", 443);

        assertThat(config.analytics()).isNotNull();
        assertThat(config.analytics().umamiHostUrl()).isEqualTo("https://8.8.8.8");
        assertThat(config.analytics().umamiScriptUrl())
                .isEqualTo("https://8.8.8.8/script.js");
    }

    private PublicSiteConfigService service() {
        return new PublicSiteConfigService(
                directwerkConfig,
                tenantResolver,
                tenantBrandingRepository,
                moduleGateService,
                studioNavigationService
        );
    }

    private static Tenant tenant(Long id, String slug, String name) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug(slug);
        tenant.setName(name);
        return tenant;
    }
}
