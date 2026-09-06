package de.pnnit.directwerk.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.dto.EpisodeView;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.service.EpisodeCoverResolver;
import java.net.URI;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Studio cover images follow the RSS artwork rule (episode → format → series)
 * with the public-only URL policy: private covers stay null.
 */
@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class PublicEpisodeViewMapperTest {

    @Mock
    private EpisodeMediaApi episodeMediaApi;

    @Spy
    private EpisodeCoverResolver episodeCoverResolver = new EpisodeCoverResolver();

    @InjectMocks
    private PublicEpisodeViewMapper mapper;

    @Test
    void studioViewExposesPublicEpisodeCoverUrl() throws Exception {
        MediaAsset cover = coverAsset(12L);
        Episode episode = episode(cover, Set.of());
        when(episodeMediaApi.publicCdnUrl(cover))
                .thenReturn(Optional.of(URI.create("https://cdn.test/covers/ep.jpg").toURL()));

        EpisodeView view = mapper.toStudioView(episode);

        assertThat(view.coverAssetId()).isEqualTo(12L);
        assertThat(view.coverImageUrl()).isEqualTo("https://cdn.test/covers/ep.jpg");
    }

    @Test
    void studioViewFallsBackToFormatCover() throws Exception {
        MediaAsset formatCover = coverAsset(21L);
        Format format = org.mockito.Mockito.mock(Format.class);
        when(format.getCoverAsset()).thenReturn(formatCover);
        when(format.getSortOrder()).thenReturn(0);
        when(format.getId()).thenReturn(7L);
        Episode episode = episode(null, Set.of(format));
        when(episodeMediaApi.publicCdnUrl(formatCover))
                .thenReturn(Optional.of(URI.create("https://cdn.test/covers/format.jpg").toURL()));

        EpisodeView view = mapper.toStudioView(episode);

        assertThat(view.coverAssetId()).isNull();
        assertThat(view.coverImageUrl()).isEqualTo("https://cdn.test/covers/format.jpg");
    }

    @Test
    void studioViewKeepsPrivateCoversNull() {
        MediaAsset cover = coverAsset(12L);
        Episode episode = episode(cover, Set.of());
        when(episodeMediaApi.publicCdnUrl(cover)).thenReturn(Optional.empty());

        EpisodeView view = mapper.toStudioView(episode);

        assertThat(view.coverAssetId()).isEqualTo(12L);
        assertThat(view.coverImageUrl()).isNull();
    }

    @Test
    void studioViewHasNullCoverWithoutAnyArtwork() {
        Episode episode = episode(null, Set.of());

        EpisodeView view = mapper.toStudioView(episode);

        assertThat(view.coverImageUrl()).isNull();
    }

    private static MediaAsset coverAsset(Long id) {
        MediaAsset asset = org.mockito.Mockito.mock(MediaAsset.class);
        when(asset.getId()).thenReturn(id);
        return asset;
    }

    private static Episode episode(MediaAsset cover, Set<Format> formats) {
        PodcastSeries series = org.mockito.Mockito.mock(PodcastSeries.class);
        when(series.getId()).thenReturn(7L);
        when(series.getSlug()).thenReturn("main-show");
        when(series.getCoverAsset()).thenReturn(null);
        Episode episode = org.mockito.Mockito.mock(Episode.class);
        when(episode.getId()).thenReturn(5L);
        when(episode.getSeries()).thenReturn(series);
        when(episode.getEpisodeNumber()).thenReturn(1);
        when(episode.getSlug()).thenReturn("folge-1");
        when(episode.getTitle()).thenReturn("Folge 1");
        when(episode.getDescription()).thenReturn(null);
        when(episode.getAudioAsset()).thenReturn(null);
        when(episode.getCoverAsset()).thenReturn(cover);
        when(episode.getDurationSeconds()).thenReturn(null);
        when(episode.getAccessPolicy()).thenReturn(AccessPolicy.FREE);
        when(episode.getRequiredLevelSortOrder()).thenReturn(null);
        when(episode.getStatus()).thenReturn(EpisodeStatus.DRAFT);
        when(episode.isEnclosureEnabled()).thenReturn(true);
        when(episode.getPublishedAt()).thenReturn(null);
        when(episode.getScheduledAt()).thenReturn(null);
        when(episode.getFormats()).thenReturn(formats);
        when(episode.getCategories()).thenReturn(Set.of());
        return episode;
    }
}
