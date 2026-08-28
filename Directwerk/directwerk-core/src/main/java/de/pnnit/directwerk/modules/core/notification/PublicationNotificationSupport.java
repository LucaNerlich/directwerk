package de.pnnit.directwerk.modules.core.notification;

import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import java.time.Instant;
import java.util.function.IntSupplier;
import lombok.extern.slf4j.Slf4j;

/**
 * Shared subscriber notification gate + claim pattern for published content.
 */
@Slf4j
public final class PublicationNotificationSupport {

    private PublicationNotificationSupport() {
    }

    public static void maybeNotify(
            Long tenantId,
            ContentType contentType,
            Long contentId,
            String title,
            String excerpt,
            String slug,
            String accessPolicy,
            boolean notifySubscribers,
            SubscriberNotificationGate notificationGate,
            ContentPublishedNotifier contentPublishedNotifier,
            IntSupplier claimNotification,
            Runnable markNotified
    ) {
        if (!notifySubscribers || !notificationGate.enabled(tenantId, contentType, contentId)) {
            return;
        }
        if (claimNotification.getAsInt() == 0) {
            log.debug("Skipping {} notification tenant={} content={} — already notified",
                    contentType, tenantId, contentId);
            return;
        }
        markNotified.run();
        contentPublishedNotifier.notifyContentPublished(new ContentPublishedEvent(
                tenantId,
                contentType,
                contentId,
                title,
                excerpt,
                slug,
                accessPolicy
        ));
    }
}
