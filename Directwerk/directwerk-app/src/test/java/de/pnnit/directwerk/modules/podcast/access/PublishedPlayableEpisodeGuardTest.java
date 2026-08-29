package de.pnnit.directwerk.modules.podcast.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PublishedPlayableEpisodeGuardTest {

    @Mock
    private EpisodeRepository episodeRepository;

    @InjectMocks
    private PublishedPlayableEpisodeGuard guard;

    @Test
    void hasReadyAudioRequiresReadyAudioAsset() {
        assertThat(guard.hasReadyAudio(null)).isFalse();
        assertThat(guard.hasReadyAudio(audioAsset(AssetStatus.PENDING, AssetType.AUDIO))).isFalse();
        assertThat(guard.hasReadyAudio(audioAsset(AssetStatus.READY, AssetType.IMAGE))).isFalse();
        assertThat(guard.hasReadyAudio(audioAsset(AssetStatus.READY, AssetType.AUDIO))).isTrue();
    }

    @Test
    void requirePlayableForEnclosureNeedsEnclosureEnabledAndReadyAudio() {
        Episode episode = publishedEpisode(true, audioAsset(AssetStatus.READY, AssetType.AUDIO));
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                1L,
                "episode-one",
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));

        Episode playable = guard.requirePlayable(
                1L,
                "episode-one",
                PublishedPlayableEpisodeGuard.PlaybackSurface.ENCLOSURE
        );

        assertThat(playable).isSameAs(episode);
    }

    @Test
    void requirePlayableForEnclosureRejectsDisabledEnclosure() {
        Episode episode = publishedEpisode(false, audioAsset(AssetStatus.READY, AssetType.AUDIO));
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                1L,
                "episode-one",
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));

        assertThatThrownBy(() -> guard.requirePlayable(
                1L,
                "episode-one",
                PublishedPlayableEpisodeGuard.PlaybackSurface.ENCLOSURE
        )).isInstanceOf(EpisodeNotFoundException.class);
    }

    @Test
    void requirePlayableForPortalStreamAllowsDisabledEnclosureButRequiresReadyAudio() {
        Episode episode = publishedEpisode(false, audioAsset(AssetStatus.PENDING, AssetType.AUDIO));
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                1L,
                "episode-one",
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));

        assertThatThrownBy(() -> guard.requirePlayable(
                1L,
                "episode-one",
                PublishedPlayableEpisodeGuard.PlaybackSurface.PORTAL_STREAM
        )).isInstanceOf(EpisodeValidationException.class)
                .hasMessageContaining("READY");
    }

    private static Episode publishedEpisode(boolean enclosureEnabled, MediaAsset audioAsset) {
        Episode episode = new Episode();
        episode.setSlug("episode-one");
        episode.setEnclosureEnabled(enclosureEnabled);
        episode.setAudioAsset(audioAsset);
        return episode;
    }

    private static MediaAsset audioAsset(AssetStatus status, AssetType type) {
        MediaAsset asset = new MediaAsset();
        asset.setStatus(status);
        asset.setAssetType(type);
        return asset;
    }
}
