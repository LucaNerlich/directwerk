package de.pnnit.directwerk.modules.core.util;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.PublicContentPaths;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Resolves absolute public content page URLs using verified tenant host policy.
 */
@Component
@RequiredArgsConstructor
public class PublicContentUrlResolver {

    private final TenantPublicHostResolver tenantPublicHostResolver;
    private final DirectwerkConfig directwerkConfig;
    private final TenantRepository tenantRepository;

    public String episodePageUrl(Long tenantId, String slug) {
        return buildAbsoluteUrl(tenantId, PublicContentPaths.episodePage(slug));
    }

    public String articlePageUrl(Long tenantId, String slug) {
        return buildAbsoluteUrl(tenantId, PublicContentPaths.articlePage(slug));
    }

    public String notificationPreferencesUrl(Long tenantId) {
        return buildAbsoluteUrl(tenantId, PublicContentPaths.notificationPreferences());
    }

    public String buildAbsoluteUrl(Long tenantId, String path) {
        return tenantPublicHostResolver.findPrimaryVerifiedHost(tenantId)
                .map(host -> "https://" + host + path)
                .orElseGet(() -> {
                    Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
                    String studioBase = trimTrailingSlash(directwerkConfig.email().studioBaseUrl());
                    if (tenant == null) {
                        return studioBase + path;
                    }
                    return studioBase + path + "?tenant=" + tenant.getSlug();
                });
    }

    public String contentPageUrl(Long tenantId, ContentType contentType, String slug) {
        return switch (contentType) {
            case EPISODE -> episodePageUrl(tenantId, slug);
            case ARTICLE -> articlePageUrl(tenantId, slug);
        };
    }

    private static String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "https://localhost";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
