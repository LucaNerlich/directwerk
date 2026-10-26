package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.PublicEpisodeView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.service.PublicPodcastQueryService;
import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.modules.core.util.FeedUrlResolver;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class PublicPodcastControllerTest {

    @Mock
    private PublicPodcastQueryService publicPodcastQueryService;

    @Mock
    private PublicEpisodeViewMapper publicEpisodeViewMapper;

    @Mock
    private RssFeedSnapshotService rssFeedSnapshotService;

    @Mock
    private FeedUrlResolver feedUrlResolver;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void getEpisodeReturnsMappedPublishedEpisode() {
        TenantContext.setTenantId(10L);
        Episode episode = publishedEpisode();
        PublicEpisodeView view = new PublicEpisodeView(
                episode.getId(),
                20L,
                "main-show",
                1,
                episode.getSlug(),
                episode.getTitle(),
                "Shownotes",
                600,
                AccessPolicy.FREE.name(),
                null,
                Instant.parse("2026-01-15T10:00:00Z"),
                "https://cdn.example/audio.mp3",
                null,
                List.of(),
                List.of()
        );
        when(publicPodcastQueryService.requirePublishedEpisode(10L, "ep-1")).thenReturn(episode);
        when(publicEpisodeViewMapper.toPublicView(episode)).thenReturn(view);

        ResponseEntity<Response<PublicEpisodeView>> response = controller().getEpisode("ep-1");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).isEqualTo(view);
        verify(publicPodcastQueryService).requirePublishedEpisode(10L, "ep-1");
        verify(publicEpisodeViewMapper).toPublicView(episode);
    }

    private PublicPodcastController controller() {
        return new PublicPodcastController(
                publicPodcastQueryService,
                publicEpisodeViewMapper,
                rssFeedSnapshotService,
                feedUrlResolver
        );
    }

    private static Episode publishedEpisode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setSlug("main-show");

        Episode episode = new Episode();
        episode.setId(30L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("ep-1");
        episode.setTitle("Episode 1");
        episode.setAccessPolicy(AccessPolicy.FREE);
        episode.setStatus(EpisodeStatus.PUBLISHED);
        return episode;
    }
}
