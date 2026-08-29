package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.util.PublicContentUrlResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ContentPublicUrlBuilder {

    private final PublicContentUrlResolver publicContentUrlResolver;

    public String buildPublicContentUrl(Long tenantId, ContentType contentType, String slug) {
        return publicContentUrlResolver.contentPageUrl(tenantId, contentType, slug);
    }

    public String buildNotificationPreferencesUrl(Long tenantId) {
        return publicContentUrlResolver.notificationPreferencesUrl(tenantId);
    }
}
