package de.pnnit.directwerk.modules.content;

import de.pnnit.directwerk.modules.content.InvalidPublicationTransitionException;
import java.time.Instant;

/**
 * Shared publication transition guards for {@link ContentType} workflows.
 * Vertical services supply entity-specific validation exceptions where needed.
 */
public final class PublicationTransitions {

    private PublicationTransitions() {
    }

    public static void requireDraftStatus(boolean isDraft, String entityLabel) {
        if (!isDraft) {
            throw new InvalidPublicationTransitionException(
                    "Only DRAFT " + entityLabel + " can be scheduled");
        }
    }

    public static void requireScheduledStatus(boolean isScheduled, String entityLabel) {
        if (!isScheduled) {
            throw new InvalidPublicationTransitionException(
                    "Only SCHEDULED " + entityLabel + " can be unscheduled");
        }
    }

    public static void requireFutureInstant(Instant instant, String fieldLabel) {
        if (instant == null || !instant.isAfter(Instant.now())) {
            throw new InvalidPublicationTransitionException(
                    fieldLabel + " must be in the future");
        }
    }
}
