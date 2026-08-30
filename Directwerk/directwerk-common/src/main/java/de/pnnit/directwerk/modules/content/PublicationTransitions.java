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

    public static void requirePresentOrPastInstant(Instant instant, String fieldLabel) {
        if (instant == null || instant.isAfter(Instant.now())) {
            throw new InvalidPublicationTransitionException(
                    fieldLabel + " must not be in the future");
        }
    }

    public static Instant resolvePublishedAt(Instant requestedPublishedAt, Instant existingPublishedAt) {
        if (requestedPublishedAt != null) {
            requirePresentOrPastInstant(requestedPublishedAt, "publishedAt");
            return requestedPublishedAt;
        }
        if (existingPublishedAt != null) {
            requirePresentOrPastInstant(existingPublishedAt, "publishedAt");
            return existingPublishedAt;
        }
        return Instant.now();
    }

    public static void requirePublishedStatus(boolean isPublished, String entityLabel) {
        if (!isPublished) {
            throw new InvalidPublicationTransitionException(
                    "Only PUBLISHED " + entityLabel + " can be unpublished or archived");
        }
    }

    public static void requireArchivedStatus(boolean isArchived, String entityLabel) {
        if (!isArchived) {
            throw new InvalidPublicationTransitionException(
                    "Only ARCHIVED " + entityLabel + " can be unarchived");
        }
    }

    public static void requireDraftOrScheduled(boolean draftOrScheduled, String entityLabel) {
        if (!draftOrScheduled) {
            throw new InvalidPublicationTransitionException(
                    "Only DRAFT or SCHEDULED " + entityLabel + " can be published");
        }
    }
}
