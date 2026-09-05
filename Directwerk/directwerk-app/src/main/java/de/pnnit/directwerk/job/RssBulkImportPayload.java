package de.pnnit.directwerk.job;

import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import java.util.Set;

/**
 * Bulk RSS import job payload: import every not-yet-imported episode of a feed
 * with one shared set of defaults, then email a summary to the requester.
 */
public record RssBulkImportPayload(
        Long seriesId,
        String feedUrl,
        Set<Long> formatIds,
        AccessPolicy accessPolicy,
        Integer requiredLevelSortOrder,
        boolean importAudio,
        boolean importImage,
        String notifyEmail,
        String requestedBy
) {
}
