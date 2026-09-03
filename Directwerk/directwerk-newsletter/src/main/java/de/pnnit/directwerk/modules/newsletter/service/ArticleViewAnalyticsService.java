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
 * RSS link-proxy clicks ({@code rss-click}/{@code private-rss}) and portal reads
 * ({@code private-view}) reuse the same event with distinct sources.
 */
@Service
@RequiredArgsConstructor
public class ArticleViewAnalyticsService {

    private static final String EVENT_NAME = "article-view";
    private static final Set<String> ALLOWED_SOURCES = Set.of(
            "public-view",
            "private-view",
            "rss-click",
            "private-rss"
    );

    private final DirectwerkConfig directwerkConfig;
    private final ModuleGateService moduleGateService;
    private final TenantBrandingService tenantBrandingService;
    private final UmamiEventClient umamiEventClient;

    @Transactional(readOnly = true)
    public void trackArticleView(Long tenantId, Article article, String source, String hostname) {
        trackArticleView(tenantId, article, source, hostname, null);
    }

    @Transactional(readOnly = true)
    public void trackArticleView(
            Long tenantId,
            Article article,
            String source,
            String hostname,
            String clientUserAgent
    ) {
        try {
            if (tenantId == null
                    || article == null
                    || article.getSlug() == null
                    || hostname == null
                    || hostname.isBlank()
                    || !ALLOWED_SOURCES.contains(source)) {
                return;
            }
            if (!moduleGateService.enabledModuleKeys(tenantId).contains(AnalyticsModule.KEY)) {
                return;
            }
            TenantBranding branding = tenantBrandingService.getBranding(tenantId);
            String websiteId = branding.getUmamiWebsiteId();
            if (!UmamiWebsiteIdValidator.isValid(websiteId)) {
                return;
            }
            String hostUrl = UmamiAnalyticsResolver.resolveEventHostUrl(branding, directwerkConfig);
            if (hostUrl == null) {
                return;
            }
            umamiEventClient.trackEvent(
                    hostUrl,
                    websiteId.trim(),
                    hostname.trim().toLowerCase(Locale.ROOT),
                    "/articles/" + article.getSlug(),
                    EVENT_NAME,
                    Map.of(
                            "articleSlug", article.getSlug(),
                            "accessPolicy", article.getAccessPolicy().name(),
                            "source", source,
                            "clientUserAgent", truncate(clientUserAgent)
                    )
            );
        } catch (RuntimeException ex) {
            // Analytics is intentionally fail-open for article reads.
        }
    }

    private static String truncate(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() > 256 ? trimmed.substring(0, 256) : trimmed;
    }
}
