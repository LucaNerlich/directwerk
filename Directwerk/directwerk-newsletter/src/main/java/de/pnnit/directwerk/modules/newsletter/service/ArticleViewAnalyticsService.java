package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.analytics.TenantEventTracker;
import de.pnnit.directwerk.modules.core.analytics.UmamiEventClient;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mirrors {@code EpisodeDownloadAnalyticsService} (directwerk-podcast) for articles. Articles
 * have no separate enclosure fetch — the public API read is the only per-article consumption
 * event, so it stands in for the "download" analog tracked on the podcast side.
 * RSS link-proxy clicks ({@code rss-click}/{@code private-rss}) and portal reads
 * ({@code private-view}) reuse the same event with distinct sources.
 *
 * <p>Event-specific validation and dimension building stay here; the shared Umami emission
 * pipeline lives in {@link TenantEventTracker}.
 */
@Service
public class ArticleViewAnalyticsService {

    private static final String EVENT_NAME = "article-view";
    private static final Set<String> ALLOWED_SOURCES = Set.of(
            "public-view",
            "private-view",
            "rss-click",
            "private-rss"
    );

    private final TenantEventTracker tenantEventTracker;

    @Autowired
    public ArticleViewAnalyticsService(TenantEventTracker tenantEventTracker) {
        this.tenantEventTracker = tenantEventTracker;
    }

    /**
     * Retained for direct instantiation by same-package unit tests; production wiring injects the
     * shared {@link TenantEventTracker} bean instead.
     */
    ArticleViewAnalyticsService(
            DirectwerkConfig directwerkConfig,
            ModuleGateService moduleGateService,
            TenantBrandingService tenantBrandingService,
            UmamiEventClient umamiEventClient
    ) {
        this.tenantEventTracker = new TenantEventTracker(
                directwerkConfig, moduleGateService, tenantBrandingService, umamiEventClient);
    }

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
        trackArticleView(tenantId, article, source, hostname, clientUserAgent, null);
    }

    @Transactional(readOnly = true)
    public void trackArticleView(
            Long tenantId,
            Article article,
            String source,
            String hostname,
            String clientUserAgent,
            String clientIp
    ) {
        if (tenantId == null
                || article == null
                || article.getSlug() == null
                || article.getAccessPolicy() == null
                || hostname == null
                || hostname.isBlank()
                || !ALLOWED_SOURCES.contains(source)) {
            return;
        }
        tenantEventTracker.track(
                tenantId,
                EVENT_NAME,
                "/articles/" + article.getSlug(),
                hostname,
                Map.of(
                        "articleSlug", article.getSlug(),
                        "accessPolicy", article.getAccessPolicy().name(),
                        "source", source),
                clientUserAgent,
                clientIp);
    }
}
