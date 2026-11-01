package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import static org.mockito.Mockito.verify;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import de.pnnit.directwerk.modules.search.SearchIndex;
import de.pnnit.directwerk.modules.search.SearchKinds;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SeriesServiceTest {

    @Mock
    private PodcastSeriesRepository podcastSeriesRepository;
    @Mock
    private EpisodeRepository episodeRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private PodcastCoverAssetResolver podcastCoverAssetResolver;
    @Mock
    private RssFeedRefreshJobProducer rssFeedRefreshScheduler;
    @Mock
    private MembershipPermissionService permissionService;

    @Mock
    private SearchIndex searchIndex;

    private SeriesService newService() {
        return new SeriesService(
                podcastSeriesRepository,
                episodeRepository,
                tenantRepository,
                podcastCoverAssetResolver,
                rssFeedRefreshScheduler,
                new HtmlSanitizer(),
                permissionService,
                searchIndex
        );
    }

    @Test
    void createSeriesSanitizesDescription() {
        SeriesService service = newService();
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        when(tenantRepository.getReferenceById(10L)).thenReturn(tenant);
        when(podcastSeriesRepository.existsByTenantIdAndSlug(10L, "my-show")).thenReturn(false);
        when(podcastSeriesRepository.save(any(PodcastSeries.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PodcastSeries saved = service.createSeries(
                10L,
                "my-show",
                "My Show",
                "<p>Hello</p><script>alert(1)</script><a href=\"https://example.com\" onclick=\"evil()\">link</a>",
                null,
                "de",
                null,
                false,
                0
        );

        assertThat(saved.getDescription()).doesNotContain("<script>", "onclick");
        assertThat(saved.getDescription()).contains("Hello");
        ArgumentCaptor<PodcastSeries> captor = ArgumentCaptor.forClass(PodcastSeries.class);
        org.mockito.Mockito.verify(podcastSeriesRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).doesNotContain("<script>");
    }

    @Test
    void createSeriesRejectsSlugsReservedByLiteralFeedRoutes() {
        SeriesService service = newService();

        // Issue #389: /feeds/{tenant}/articles.xml is a literal route, so a series slugged
        // "articles" could never serve its own {seriesSlug}.xml feed.
        assertThatThrownBy(() -> service.createSeries(
                10L, "articles", "Articles", null, null, "de", null, false, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("reserved");

        assertThatThrownBy(() -> service.createSeries(
                10L, "podcast", "Podcast", null, null, "de", null, false, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("reserved");
    }

    @Test
    void updateSeriesSanitizesDescription() {
        SeriesService service = newService();
        PodcastSeries existing = new PodcastSeries();
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        existing.setTenant(tenant);
        existing.setSlug("my-show");
        when(podcastSeriesRepository.findByIdAndTenantId(5L, 10L)).thenReturn(java.util.Optional.of(existing));
        when(podcastSeriesRepository.save(any(PodcastSeries.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PodcastSeries updated = service.updateSeries(
                10L,
                5L,
                null,
                null,
                "<img src=x onerror=alert(1)>Caption",
                null,
                null,
                null,
                null,
                null,
                null
        );

        assertThat(updated.getDescription()).doesNotContain("onerror", "<img");
        assertThat(updated.getDescription()).contains("Caption");
    }

    @Test
    void withdrawingSeriesRemovesPublishedEpisodesFromSearchIndex() {
        SeriesService service = newService();
        PodcastSeries existing = new PodcastSeries();
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        existing.setId(5L);
        existing.setTenant(tenant);
        existing.setSlug("my-show");
        existing.setStatus(SeriesStatus.PUBLISHED);
        existing.setCoverAsset(new MediaAsset());
        Episode episode = new Episode();
        episode.setId(9L);
        episode.setTenant(tenant);
        episode.setSeries(existing);
        episode.setStatus(EpisodeStatus.PUBLISHED);
        when(podcastSeriesRepository.findByIdAndTenantId(5L, 10L)).thenReturn(java.util.Optional.of(existing));
        when(podcastSeriesRepository.save(any(PodcastSeries.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(episodeRepository.findByTenantIdAndSeriesId(10L, 5L)).thenReturn(List.of(episode));

        service.updateSeries(
                10L, 5L, null, null, null, null, null, null, null, null, SeriesStatus.DRAFT);

        verify(searchIndex).remove(10L, SearchKinds.EPISODE, 9L);
    }
}
