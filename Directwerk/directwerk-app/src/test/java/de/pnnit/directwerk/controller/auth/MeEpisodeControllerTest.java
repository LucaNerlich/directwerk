package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.service.EpisodeDownloadAnalyticsService;
import de.pnnit.directwerk.modules.podcast.service.SubscriberEpisodeService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class MeEpisodeControllerTest {

    @Mock
    private SubscriberPortalAccessService subscriberContentAccessService;

    @Mock
    private EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    @Mock
    private HttpServletRequest request;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void streamFreeEpisodeReturnsFoundRedirect() throws Exception {
        TenantContext.setTenantId(10L);
        MeEpisodeController controller = new MeEpisodeController(
                subscriberContentAccessService,
                episodeDownloadAnalyticsService
        );
        DirectwerkUserPrincipal principal = subscriber();
        Episode episode = freeEpisode();
        when(subscriberContentAccessService.resolveStream(principal, "episode-1"))
                .thenReturn(new SubscriberPortalAccessService.EpisodeStream(
                        episode, URI.create("https://cdn.example.test/alpha/public/audio/ep.mp3").toURL()));
        when(request.getServerName()).thenReturn("alpha.example.test");

        ResponseEntity<Void> response = controller.streamEpisode("episode-1", principal, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation())
                .hasToString("https://cdn.example.test/alpha/public/audio/ep.mp3");
        verify(episodeDownloadAnalyticsService)
                .trackEpisodeDownload(10L, episode, "stream", "alpha.example.test");
    }

    private static DirectwerkUserPrincipal subscriber() {
        return new DirectwerkUserPrincipal(
                20L,
                "subscriber@example.test",
                "hash",
                10L,
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
    }

    private static Episode freeEpisode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        PodcastSeries series = new PodcastSeries();
        series.setId(30L);
        series.setTenant(tenant);
        series.setSlug("main");
        series.setTitle("Main");

        MediaAsset audio = new MediaAsset();
        audio.setId(40L);
        audio.setTenant(tenant);
        audio.setS3Key("alpha/public/audio/ep.mp3");
        audio.setVisibility(AssetVisibility.PUBLIC);
        audio.setScope(AssetScope.TENANT_PUBLIC);
        audio.setAssetType(AssetType.AUDIO);
        audio.setStatus(AssetStatus.READY);

        Episode episode = new Episode();
        episode.setId(50L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("episode-1");
        episode.setTitle("Episode 1");
        episode.setAccessPolicy(AccessPolicy.FREE);
        episode.setAudioAsset(audio);
        return episode;
    }
}
