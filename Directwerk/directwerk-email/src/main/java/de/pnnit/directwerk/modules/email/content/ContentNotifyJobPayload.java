package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.modules.content.ContentType;

public record ContentNotifyJobPayload(
        String contentType,
        Long contentId,
        String title,
        String excerpt,
        String slug,
        String accessPolicy
) {
    public static ContentNotifyJobPayload from(ContentType contentType, Long contentId, String title, String excerpt, String slug, String accessPolicy) {
        return new ContentNotifyJobPayload(contentType.name(), contentId, title, excerpt, slug, accessPolicy);
    }
}
