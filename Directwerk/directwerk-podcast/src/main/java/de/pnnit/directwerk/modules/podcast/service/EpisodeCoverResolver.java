package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import java.util.Comparator;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Resolves RSS/podcast cover artwork with fallback: episode → format → sendung (series).
 */
@Component
public class EpisodeCoverResolver {

    public Optional<MediaAsset> resolveCoverAsset(Episode episode) {
        if (episode.getCoverAsset() != null) {
            return Optional.of(episode.getCoverAsset());
        }
        Optional<MediaAsset> formatCover = episode.getFormats().stream()
                .sorted(Comparator.comparingInt(Format::getSortOrder).thenComparing(Format::getId))
                .map(Format::getCoverAsset)
                .filter(cover -> cover != null)
                .findFirst();
        if (formatCover.isPresent()) {
            return formatCover;
        }
        PodcastSeries series = episode.getSeries();
        if (series != null && series.getCoverAsset() != null) {
            return Optional.of(series.getCoverAsset());
        }
        return Optional.empty();
    }
}
