package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.analytics.UmamiEventClient;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EpisodeDownloadAnalyticsServiceTest {

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private TenantBrandingService tenantBrandingService;

    @Mock
    private UmamiEventClient umamiEventClient;

    @Mock
    private EpisodeEnclosureService episodeEnclosureService;

    @Test
    void skipsWhenAnalyticsModuleIsNotEnabled() {
        EpisodeDownloadAnalyticsService service = service(true);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of());

        service.trackEpisodeDownload(10L, episode(), "stream", "alpha.example.test");

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

    @Test
    void skipsWhenWebsiteIdIsMissing() {
        EpisodeDownloadAnalyticsService service = service(true);
        TenantBranding branding = new TenantBranding();
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackEpisodeDownload(10L, episode(), "stream", "alpha.example.test");

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

    @Test
    void callsUmamiClientWhenConfigured() {
        EpisodeDownloadAnalyticsService service = service(true);
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("123e4567-e89b-12d3-a456-426614174000");
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackEpisodeDownload(10L, episode(), "stream", "Alpha.Example.Test");

        ArgumentCaptor<Map<String, Object>> dataCaptor = ArgumentCaptor.forClass(Map.class);
        verify(umamiEventClient).trackEvent(
                eq("https://umami.example.test"),
                eq("123e4567-e89b-12d3-a456-426614174000"),
                eq("alpha.example.test"),
                eq("/episodes/episode-1"),
                eq("episode-download"),
                dataCaptor.capture(),
                org.mockito.ArgumentMatchers.isNull()
        );
        org.assertj.core.api.Assertions.assertThat(dataCaptor.getValue())
                .containsEntry("episodeSlug", "episode-1")
                .containsEntry("seriesSlug", "main")
                .containsEntry("accessPolicy", "FREE")
                .containsEntry("source", "stream");
    }

    @Test
    void skipsWhenSourceIsNotAllowed() {
        EpisodeDownloadAnalyticsService service = service(true);

        service.trackEpisodeDownload(10L, episode(), "invalid-source", "alpha.example.test");

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

    @Test
    void usesTenantUmamiHostWhenConfigured() {
        EpisodeDownloadAnalyticsService service = service(false);
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("123e4567-e89b-12d3-a456-426614174000");
        branding.setUmamiHostUrl("https://tenant.invalid");
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackEpisodeDownload(10L, episode(), "stream", "alpha.example.test");

        verify(umamiEventClient).trackEvent(
                eq("https://tenant.invalid"),
                eq("123e4567-e89b-12d3-a456-426614174000"),
                eq("alpha.example.test"),
                eq("/episodes/episode-1"),
                eq("episode-download"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.isNull()
        );
    }

    @Test
    void skipsWhenNoUmamiHostIsConfigured() {
        EpisodeDownloadAnalyticsService service = service(false);

        service.trackEpisodeDownload(10L, episode(), "stream", "alpha.example.test");

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

    @Test
    void publicRssEnclosureUrlDelegatesSchemeHostPortToEpisodeEnclosureService() {
        EpisodeDownloadAnalyticsService service = service(true);
        when(episodeEnclosureService.publicEnclosureUrl(10L, "http", "alpha.example.test", 8080, "alpha", "episode-1"))
                .thenReturn("http://alpha.example.test:8080/feeds/alpha/e/episode-1.mp3");

        String url = service.publicRssEnclosureUrl(10L, "http", "alpha.example.test", 8080, "alpha", "episode-1");

        assertThat(url).isEqualTo("http://alpha.example.test:8080/feeds/alpha/e/episode-1.mp3");
    }

    @Test
    void privateRssEnclosureUrlDelegatesSchemeHostPortToEpisodeEnclosureService() {
        EpisodeDownloadAnalyticsService service = service(true);
        when(episodeEnclosureService.privateEnclosureUrl(
                10L, "http", "alpha.example.test", 8080, "alpha", "tok", "episode-1"))
                .thenReturn("http://alpha.example.test:8080/feeds/alpha/u/tok/e/episode-1.mp3");

        String url = service.privateRssEnclosureUrl(10L, "http", "alpha.example.test", 8080, "alpha", "tok", "episode-1");

        assertThat(url).isEqualTo("http://alpha.example.test:8080/feeds/alpha/u/tok/e/episode-1.mp3");
    }

    private EpisodeDownloadAnalyticsService service(boolean analyticsEnabled) {
        return new EpisodeDownloadAnalyticsService(
                new DirectwerkConfig(new DirectwerkProperties(
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        new DirectwerkProperties.Analytics(
                                analyticsEnabled,
                                "https://umami.example.test",
                                "Directwerk-Test/1.0"
                        ),
                        null
                )),
                moduleGateService,
                tenantBrandingService,
                umamiEventClient,
                episodeEnclosureService
        );
    }

    private static Episode episode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setTenant(tenant);
        series.setSlug("main");
        series.setTitle("Main");

        Episode episode = new Episode();
        episode.setId(30L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("episode-1");
        episode.setTitle("Episode 1");
        episode.setAccessPolicy(AccessPolicy.FREE);
        return episode;
    }
}
