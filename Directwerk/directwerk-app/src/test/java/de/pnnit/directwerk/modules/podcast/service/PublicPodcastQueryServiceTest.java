package de.pnnit.directwerk.modules.podcast.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PublicPodcastQueryServiceTest {

    @Mock
    private SeriesService seriesService;

    @Mock
    private FormatService formatService;

    @Mock
    private CategoryService categoryService;

    @Mock
    private EpisodeRepository episodeRepository;

    private PublicPodcastQueryService publicPodcastQueryService;

    @BeforeEach
    void setUp() {
        publicPodcastQueryService =
                new PublicPodcastQueryService(seriesService, formatService, categoryService, episodeRepository);
    }

    @Test
    void listPublishedEpisodesOnlyIncludesPublishedSeries() {
        when(episodeRepository.findByTenantIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
                10L, EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED))
                .thenReturn(List.of());

        publicPodcastQueryService.listPublishedEpisodes(10L, null);

        verify(episodeRepository).findByTenantIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
                10L, EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED);
    }

    @Test
    void listPublishedEpisodesForSeriesOnlyIncludesPublishedSeries() {
        when(episodeRepository.findByTenantIdAndSeriesIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
                10L, 20L, EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED))
                .thenReturn(List.of());

        publicPodcastQueryService.listPublishedEpisodes(10L, 20L);

        verify(episodeRepository).findByTenantIdAndSeriesIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
                10L, 20L, EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED);
    }
}
