package de.pnnit.directwerk.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Studio article projection. {@code heroImageUrl} is the public CDN URL for the
 * hero when the asset is public and READY; private heroes stay {@code null} and
 * editors resolve those through the media preview endpoint (same policy as
 * {@link EpisodeView#coverImageUrl()}).
 *
 * <p>When {@code hasWorkingDraft} is true, scalar fields and taxonomy tags reflect the
 * working-draft overlay (what Studio should edit). Public/RSS surfaces ignore the draft.
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
        Instant updatedAt,
        boolean hasWorkingDraft
) {
    public record NewsletterListTag(Long id, String slug, String name) {
    }
}
