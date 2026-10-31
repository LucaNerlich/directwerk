package de.pnnit.directwerk.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Studio article projection. {@code heroImageUrl} is the public CDN URL for the
 * hero when the asset is public and READY; private heroes stay {@code null} and
 * editors resolve those through the media preview endpoint (same policy as
 * {@link EpisodeView#coverImageUrl()}).
 */
public record ArticleView(
        Long id,
        String slug,
        String title,
        String body,
        String excerpt,
        String seoDescription,
        Long heroAssetId,
        String heroImageUrl,
        String accessPolicy,
        Integer requiredLevelSortOrder,
        String status,
        Instant publishedAt,
        Instant scheduledAt,
        Instant emailNotifiedAt,
        List<CategoryView> categories,
        List<NewsletterListTag> newsletterLists,
        Long createdBy,
        Instant createdAt,
        Instant updatedAt
) {
    public record NewsletterListTag(Long id, String slug, String name) {
    }
}
