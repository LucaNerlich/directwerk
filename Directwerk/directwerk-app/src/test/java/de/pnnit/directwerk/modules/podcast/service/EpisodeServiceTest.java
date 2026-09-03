package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EpisodeServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long EPISODE_ID = 7L;

    @Mock
    private EpisodeRepository episodeRepository;

    @Mock
    private SeriesService seriesService;

    @Mock
    private FormatRepository formatRepository;

    @Mock
    private CategoryService categoryService;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private EpisodeMediaApi episodeMediaApi;

    @Mock
    private HtmlSanitizer htmlSanitizer;

    @Mock
    private PodcastCoverAssetResolver podcastCoverAssetResolver;

    @Mock
    private RssFeedRefreshScheduler rssFeedRefreshScheduler;

    private EpisodeService episodeService;

    @BeforeEach
    void wireService() {
        episodeService = new EpisodeService(
                episodeRepository,
                seriesService,
                formatRepository,
                categoryService,
                tenantRepository,
                episodeMediaApi,
                htmlSanitizer,
                podcastCoverAssetResolver,
                rssFeedRefreshScheduler
        );
    }

    @Test
    void deletePublishedEpisodeDeletesAndRequestsFeedRefresh() {
        Episode published = episode(EpisodeStatus.PUBLISHED);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(published));

        episodeService.deleteEpisode(TENANT_ID, EPISODE_ID);

        verify(episodeRepository).delete(published);
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(TENANT_ID);
    }

    @Test
    void deleteDraftEpisodeDeletesWithoutFeedRefresh() {
        Episode draft = episode(EpisodeStatus.DRAFT);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(draft));

        episodeService.deleteEpisode(TENANT_ID, EPISODE_ID);

        verify(episodeRepository).delete(draft);
        verify(rssFeedRefreshScheduler, never()).requestRefreshAfterCommit(anyLong());
    }

    @Test
    void deleteEpisodeThrowsWhenMissing() {
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> episodeService.deleteEpisode(TENANT_ID, EPISODE_ID))
                .isInstanceOf(EpisodeNotFoundException.class);
    }

    private static Episode episode(EpisodeStatus status) {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        Episode episode = new Episode();
        episode.setId(EPISODE_ID);
        episode.setTenant(tenant);
        episode.setSlug("episode-one");
        episode.setTitle("Episode One");
        episode.setStatus(status);
        return episode;
    }
}
