package de.pnnit.directwerk.job;

import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import java.util.Set;

/**
 * Bulk article RSS import job payload: import every not-yet-imported item of a feed
 * with one shared set of defaults, then email a summary to the requester.
 *
 * @param requestedBy       the requester's display name, used in the summary greeting
 * @param requestedByUserId the requester, whose identity the job is authorized as (issue #303)
 */
public record ArticleRssBulkImportPayload(
        String feedUrl,
        Set<Long> categoryIds,
        AccessPolicy accessPolicy,
        Integer requiredLevelSortOrder,
        boolean importHero,
        boolean importInlineImages,
        String notifyEmail,
        String requestedBy,
        Long requestedByUserId
) {
}
