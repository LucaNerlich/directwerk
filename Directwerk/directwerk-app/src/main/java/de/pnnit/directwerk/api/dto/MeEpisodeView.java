package de.pnnit.directwerk.api.dto;

import java.time.Instant;
import java.util.List;

public record MeEpisodeView(
        Long id,
        Long seriesId,
        String seriesSlug,
        Integer episodeNumber,
        String slug,
        String title,
        String description,
        Integer durationSeconds,
        String accessPolicy,
        Integer requiredLevelSortOrder,
        Instant publishedAt,
        String audioCdnUrl,
        List<FormatView> formats,
        List<CategoryView> categories
) {
}
