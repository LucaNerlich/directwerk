package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

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

    @Test
    void listPublishedEpisodesPagesIdsInSqlAndKeepsTheirOrder() {
        when(episodeRepository.findPublishedIds(any(), any(), any(), any())).thenReturn(List.of(9L, 4L));
        when(episodeRepository.findPublicByIds(10L, List.of(9L, 4L)))
                .thenReturn(List.of(episode(4L), episode(9L)));

        List<Episode> result = publicPodcastQueryService.listPublishedEpisodes(10L, null, 2, 1);

        assertThat(result).extracting(Episode::getId).containsExactly(9L, 4L);
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(episodeRepository).findPublishedIds(
                eq(10L),
                eq(EpisodeStatus.PUBLISHED),
                eq(SeriesStatus.PUBLISHED),
                page.capture()
        );
        assertThat(page.getValue().getOffset()).isEqualTo(1);
        assertThat(page.getValue().getPageSize()).isEqualTo(2);
    }

    @Test
    void listPublishedEpisodesForASeriesUsesTheSeriesScopedIdPage() {
        when(episodeRepository.findPublishedIdsForSeries(any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        publicPodcastQueryService.listPublishedEpisodes(10L, 20L, 2, 1);

        verify(episodeRepository).findPublishedIdsForSeries(
                eq(10L),
                eq(20L),
                eq(EpisodeStatus.PUBLISHED),
                eq(SeriesStatus.PUBLISHED),
                any(Pageable.class)
        );
    }

    @Test
    void requirePublishedEpisodeReturnsMatchingEpisode() {
        Episode episode = new Episode();
        episode.setSlug("ep-1");
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                10L, "ep-1", EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED))
                .thenReturn(Optional.of(episode));

        assertThat(publicPodcastQueryService.requirePublishedEpisode(10L, "ep-1")).isSameAs(episode);
    }

    @Test
    void requirePublishedEpisodeThrowsWhenMissingOrUnpublished() {
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                10L, "missing", EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> publicPodcastQueryService.requirePublishedEpisode(10L, "missing"))
                .isInstanceOf(EpisodeNotFoundException.class);
    }

    private static Episode episode(Long id) {
        Episode episode = new Episode();
        episode.setId(id);
        return episode;
    }
}
