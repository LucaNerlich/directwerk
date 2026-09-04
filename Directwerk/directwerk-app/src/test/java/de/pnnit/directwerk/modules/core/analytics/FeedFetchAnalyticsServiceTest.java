package de.pnnit.directwerk.modules.core.analytics;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FeedFetchAnalyticsServiceTest {

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private TenantBrandingService tenantBrandingService;

    @Mock
    private UmamiEventClient umamiEventClient;

    @Test
    void tracksPublicPodcastFetch() {
        FeedFetchAnalyticsService service = service(true);
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("123e4567-e89b-12d3-a456-426614174000");
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackFeedFetch(10L, "podcast", "public", "alpha.example.test");

        verify(umamiEventClient).trackEvent(
                eq("https://umami.example.test"),
                eq("123e4567-e89b-12d3-a456-426614174000"),
                eq("alpha.example.test"),
                eq("/feeds/podcast"),
                eq("feed-fetch"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.isNull()
        );
    }

    @Test
    void passesTenantHostToAsyncClientWithoutResolvingIt() {
        FeedFetchAnalyticsService service = service(false);
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("123e4567-e89b-12d3-a456-426614174000");
        branding.setUmamiHostUrl("https://tenant.invalid");
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackFeedFetch(10L, "article", "private", "alpha.example.test");

        verify(umamiEventClient).trackEvent(
                eq("https://tenant.invalid"),
                eq("123e4567-e89b-12d3-a456-426614174000"),
                eq("alpha.example.test"),
                eq("/feeds/article"),
                eq("feed-fetch"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.isNull()
        );
    }

    @Test
    void skipsWhenModuleOff() {
        FeedFetchAnalyticsService service = service(true);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of());

        service.trackFeedFetch(10L, "article", "private", "alpha.example.test");

        verify(umamiEventClient, never()).trackEvent(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    private FeedFetchAnalyticsService service(boolean enabled) {
        return new FeedFetchAnalyticsService(
                new DirectwerkConfig(new DirectwerkProperties(
                        null, null, null, null, null, null, null,
                        new DirectwerkProperties.Analytics(enabled, "https://umami.example.test", "Directwerk-Test/1.0"),
                        null)),
                moduleGateService,
                tenantBrandingService,
                umamiEventClient
        );
    }
}
