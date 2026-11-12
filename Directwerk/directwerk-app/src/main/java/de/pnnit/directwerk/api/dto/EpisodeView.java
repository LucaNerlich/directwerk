package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.content.LifecycleAction;
import java.time.Instant;
import java.util.List;

/**
 * Studio episode projection. When {@code hasWorkingDraft} is true, editable fields and
 * taxonomy tags reflect the working-draft overlay. Public/RSS ignore the draft.
 */
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
        Instant emailNotifiedAt,
        List<FormatView> formats,
        List<CategoryView> categories,
        Long createdBy,
        Instant createdAt,
        Instant updatedAt,
        boolean hasWorkingDraft,
        /** State-valid next actions (LifecycleAction names). RBAC still applies. */
        List<LifecycleAction> availableActions
) {
}
