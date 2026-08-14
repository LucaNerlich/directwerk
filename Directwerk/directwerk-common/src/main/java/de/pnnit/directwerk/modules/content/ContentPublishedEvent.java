package de.pnnit.directwerk.modules.content;

/**
 * Emitted when digital content is published for the first time and the publisher
 * requested subscriber notification.
 */
public record ContentPublishedEvent(
        Long tenantId,
        ContentType contentType,
        Long contentId,
        String title,
        String excerpt,
        String slug,
        String accessPolicy
) {
}
