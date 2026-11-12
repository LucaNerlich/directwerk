package de.pnnit.directwerk.modules.content;

import org.slf4j.Logger;

/**
 * Shared helpers for the scheduled publication worker. The transition table
 * itself lives in {@link PublicationActions}.
 */
public final class PublicationLifecycleSupport {

    private PublicationLifecycleSupport() {
    }

    /**
     * Shared skip guard for Quartz scheduled-publish workers when status changed between poll and run.
     */
    public static boolean skipScheduledPublishIfStatusChanged(
            boolean stillScheduled,
            Logger log,
            String contentLabel,
            Long contentId,
            Long tenantId,
            Object currentStatus
    ) {
        if (stillScheduled) {
            return false;
        }
        log.info(
                "Skipping scheduled publish for {}={} tenant={} — status is no longer SCHEDULED ({})",
                contentLabel,
                contentId,
                tenantId,
                currentStatus
        );
        return true;
    }
}
