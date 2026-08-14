package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ModuleNotEnabledException;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.service.EpisodeDownloadAnalyticsService;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class PublicEpisodeDownloadControllerTest {

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private EpisodeEnclosureService episodeEnclosureService;

    @Mock
    private EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    @Mock
    private HttpServletRequest request;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void freePublishedReadyAudioRedirectsToCdnAndTracks() throws Exception {
        TenantContext.setTenantId(10L);
        Episode episode = freeEpisode();
        PublicEpisodeDownloadController controller = controller();
        when(episodeEnclosureService.resolvePublicRedirect(10L, "episode-1"))
                .thenReturn(new EpisodeEnclosureService.EnclosureRedirect(
                        episode,
                        URI.create("https://cdn.example.test/alpha/public/audio/ep.mp3").toURL()
                ));
        when(request.getServerName()).thenReturn("alpha.example.test");

        ResponseEntity<Void> response = controller.downloadEpisode("episode-1", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation())
                .hasToString("https://cdn.example.test/alpha/public/audio/ep.mp3");
        verify(moduleGateService).requireModule(PodcastModule.KEY);
        verify(episodeDownloadAnalyticsService)
                .trackEpisodeDownload(10L, episode, "public-download", "alpha.example.test");
    }

    @Test
    void enclosureServiceNotFoundPropagates() {
        TenantContext.setTenantId(10L);
        PublicEpisodeDownloadController controller = controller();
        when(episodeEnclosureService.resolvePublicRedirect(10L, "episode-1"))
                .thenThrow(new EpisodeNotFoundException("episode-1"));

        assertThatThrownBy(() -> controller.downloadEpisode("episode-1", request))
                .isInstanceOf(EpisodeNotFoundException.class);
        verify(moduleGateService).requireModule(PodcastModule.KEY);
    }

    @Test
    void tenantWithoutPodcastModuleThrowsFeatureNotEnabled() {
        TenantContext.setTenantId(10L);
        PublicEpisodeDownloadController controller = controller();
        doThrow(new ModuleNotEnabledException(PodcastModule.KEY))
                .when(moduleGateService)
                .requireModule(PodcastModule.KEY);

        assertThatThrownBy(() -> controller.downloadEpisode("episode-1", request))
                .isInstanceOf(ModuleNotEnabledException.class)
                .isNotInstanceOf(EpisodeNotFoundException.class);
    }

    private PublicEpisodeDownloadController controller() {
        return new PublicEpisodeDownloadController(
                moduleGateService,
                episodeEnclosureService,
                episodeDownloadAnalyticsService
        );
    }

    private static Episode freeEpisode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setTenant(tenant);
        series.setSlug("main");
        series.setTitle("Main");

        MediaAsset audio = new MediaAsset();
        audio.setId(30L);
        audio.setTenant(tenant);
        audio.setS3Key("alpha/public/audio/ep.mp3");
        audio.setVisibility(AssetVisibility.PUBLIC);
        audio.setScope(AssetScope.TENANT_PUBLIC);
        audio.setAssetType(AssetType.AUDIO);
        audio.setStatus(AssetStatus.READY);

        Episode episode = new Episode();
        episode.setId(40L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("episode-1");
        episode.setTitle("Episode 1");
        episode.setAccessPolicy(AccessPolicy.FREE);
        episode.setEnclosureEnabled(true);
        episode.setAudioAsset(audio);
        return episode;
    }
}
