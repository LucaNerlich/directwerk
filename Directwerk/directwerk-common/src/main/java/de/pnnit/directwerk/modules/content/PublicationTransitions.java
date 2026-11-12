package de.pnnit.directwerk.modules.content;

import java.time.Instant;

/**
 * Shared value guards for publication transitions. Which action is legal in
 * which phase lives in {@link PublicationActions}.
 */
public final class PublicationTransitions {

    private PublicationTransitions() {
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
}
