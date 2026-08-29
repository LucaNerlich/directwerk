package de.pnnit.directwerk.modules.content;

import java.time.Instant;
import java.util.function.BooleanSupplier;
import org.slf4j.Logger;

/**
 * Shared publication lifecycle transitions for draft → scheduled → published → archived content.
 */
public final class PublicationLifecycleSupport {

    private PublicationLifecycleSupport() {
    }

    public static void schedule(
            Instant scheduledAt,
            boolean notifySubscribers,
            BooleanSupplier isDraft,
            String contentLabel,
            Runnable applyScheduled
    ) {
        PublicationTransitions.requireDraftStatus(isDraft.getAsBoolean(), contentLabel);
        PublicationTransitions.requireFutureInstant(scheduledAt, "scheduledAt");
        applyScheduled.run();
    }

    public static void cancelSchedule(
            BooleanSupplier isScheduled,
            String contentLabel,
            Runnable applyDraft
    ) {
        PublicationTransitions.requireScheduledStatus(isScheduled.getAsBoolean(), contentLabel);
        applyDraft.run();
    }

    public static void unpublish(
            BooleanSupplier isPublished,
            String contentLabel,
            Runnable applyDraft,
            Runnable afterUnpublish
    ) {
        PublicationTransitions.requirePublishedStatus(isPublished.getAsBoolean(), contentLabel);
        applyDraft.run();
        if (afterUnpublish != null) {
            afterUnpublish.run();
        }
    }

    public static void archive(
            BooleanSupplier isPublished,
            String contentLabel,
            Runnable applyArchived,
            Runnable afterArchive
    ) {
        PublicationTransitions.requirePublishedStatus(isPublished.getAsBoolean(), contentLabel);
        applyArchived.run();
        if (afterArchive != null) {
            afterArchive.run();
        }
    }

    public static void unarchive(
            BooleanSupplier isArchived,
            String contentLabel,
            Runnable applyDraft
    ) {
        PublicationTransitions.requireArchivedStatus(isArchived.getAsBoolean(), contentLabel);
        applyDraft.run();
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
