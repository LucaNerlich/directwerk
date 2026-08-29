package de.pnnit.directwerk.modules.podcast.access;

import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Canonical published-episode playability rules for enclosure, portal stream, and RSS surfaces.
 */
@Component
@RequiredArgsConstructor
public class PublishedPlayableEpisodeGuard {

    public enum PlaybackSurface {
        /** RSS/public enclosure proxy: published series, enclosure enabled, READY audio. */
        ENCLOSURE,
        /** JWT portal stream: published series, READY audio (enclosure flag not required). */
        PORTAL_STREAM
    }

    private final EpisodeRepository episodeRepository;

    public Episode requirePlayable(Long tenantId, String episodeSlug, PlaybackSurface surface) {
        Episode episode = episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                tenantId,
                episodeSlug,
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        ).orElseThrow(() -> new EpisodeNotFoundException(episodeSlug));

        if (surface == PlaybackSurface.ENCLOSURE && !episode.isEnclosureEnabled()) {
            throw new EpisodeNotFoundException(episodeSlug);
        }

        if (!hasReadyAudio(episode.getAudioAsset())) {
            throw surface == PlaybackSurface.ENCLOSURE
                    ? new EpisodeNotFoundException(episodeSlug)
                    : new de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException(
                            "Episode audio asset must be READY"
                    );
        }
        return episode;
    }

    public boolean hasReadyAudio(MediaAsset audioAsset) {
        return audioAsset != null
                && audioAsset.getStatus() == AssetStatus.READY
                && audioAsset.getAssetType() == AssetType.AUDIO;
    }
}
