package de.pnnit.directwerk.api.dto;

import java.time.Instant;
import java.util.List;

public record EpisodeView(
        Long id,
        Long seriesId,
        String seriesSlug,
        Integer episodeNumber,
        String slug,
        String title,
        String description,
        Long audioAssetId,
        Long coverAssetId,
        String coverImageUrl,
        Integer durationSeconds,
        String accessPolicy,
        Integer requiredLevelSortOrder,
        String status,
        boolean enclosureEnabled,
        Instant publishedAt,
        Instant scheduledAt,
        List<FormatView> formats,
        List<CategoryView> categories,
        Long createdBy,
        Instant createdAt,
        Instant updatedAt
) {
}
