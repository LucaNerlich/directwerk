package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.analytics.UmamiAnalyticsResolver;
import de.pnnit.directwerk.modules.core.analytics.UmamiEventClient;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mirrors {@code EpisodeDownloadAnalyticsService} (directwerk-podcast) for articles. Articles
 * have no separate enclosure fetch — the public API read is the only per-article consumption
 * event, so it stands in for the "download" analog tracked on the podcast side.
 */
@Service
@RequiredArgsConstructor
public class ArticleViewAnalyticsService {

    private static final String EVENT_NAME = "article-view";
    private static final Set<String> ALLOWED_SOURCES = Set.of("public-view");

    private final DirectwerkConfig directwerkConfig;
    private final ModuleGateService moduleGateService;
    private final TenantBrandingService tenantBrandingService;
    private final UmamiEventClient umamiEventClient;

    @Transactional(readOnly = true)
    public void trackArticleView(Long tenantId, Article article, String source, String hostname) {
        try {
            if (tenantId == null
                    || article == null
                    || hostname == null
                    || hostname.isBlank()
                    || !ALLOWED_SOURCES.contains(source)) {
                return;
            }
            String websiteId = resolveValidWebsiteId(tenantId);
            String hostUrl = resolveHostUrl(tenantId);
            if (websiteId == null || hostUrl == null) {
                return;
            }
            umamiEventClient.trackEvent(
                    hostUrl,
                    websiteId,
                    hostname.trim().toLowerCase(Locale.ROOT),
                    "/articles/" + article.getSlug(),
                    EVENT_NAME,
                    Map.of(
                            "articleSlug", article.getSlug(),
                            "accessPolicy", article.getAccessPolicy().name(),
                            "source", source
                    )
            );
        } catch (RuntimeException ex) {
            // Analytics is intentionally fail-open for article reads.
        }
    }

    private String resolveValidWebsiteId(Long tenantId) {
        if (tenantId == null || !moduleGateService.enabledModuleKeys(tenantId).contains(AnalyticsModule.KEY)) {
            return null;
        }
        TenantBranding branding = tenantBrandingService.getBranding(tenantId);
        String websiteId = branding.getUmamiWebsiteId();
        if (!UmamiWebsiteIdValidator.isValid(websiteId)) {
            return null;
        }
        return websiteId.trim();
    }

    private String resolveHostUrl(Long tenantId) {
        if (tenantId == null) {
            return null;
        }
        TenantBranding branding = tenantBrandingService.getBranding(tenantId);
        return UmamiAnalyticsResolver.resolveHostUrl(branding, directwerkConfig);
    }
}
