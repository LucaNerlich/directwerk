package de.pnnit.directwerk.api.dto;

import java.time.Instant;
import java.util.List;

public record PublicArticleView(
        Long id,
        String slug,
        String title,
        String body,
        String excerpt,
        String seoDescription,
        Long heroAssetId,
        String accessPolicy,
        Integer requiredLevelSortOrder,
        Instant publishedAt,
        List<PublicCategoryView> categories
) {
}
