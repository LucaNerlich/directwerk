package de.pnnit.directwerk.modules.core.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Counts RSS feed XML fetches (podcast + article, public + private). Enclosure / article-view
 * events measure consumption; feed-fetch measures reach/subscriber polling even when bodies
 * are read offline from the snapshot. Fail-open: never gates feed delivery.
 *
 * <p>Event-specific validation stays here; the shared Umami emission pipeline lives in
 * {@link TenantEventTracker}.
 */
@Service
public class FeedFetchAnalyticsService {

    private static final String EVENT_NAME = "feed-fetch";
    private static final Set<String> ALLOWED_KINDS = Set.of("podcast", "article");
    private static final Set<String> ALLOWED_VISIBILITY = Set.of("public", "private");

    private final TenantEventTracker tenantEventTracker;

    @Autowired
    public FeedFetchAnalyticsService(TenantEventTracker tenantEventTracker) {
        this.tenantEventTracker = tenantEventTracker;
    }

    /**
     * Retained for direct instantiation by same-package unit tests; production wiring injects the
     * shared {@link TenantEventTracker} bean instead.
     */
    FeedFetchAnalyticsService(
            DirectwerkConfig directwerkConfig,
            ModuleGateService moduleGateService,
            TenantBrandingService tenantBrandingService,
            UmamiEventClient umamiEventClient
    ) {
        this.tenantEventTracker = new TenantEventTracker(
                directwerkConfig, moduleGateService, tenantBrandingService, umamiEventClient);
    }

    @Transactional(readOnly = true)
    public void trackFeedFetch(
            Long tenantId,
            String feedKind,
            String visibility,
            String hostname
    ) {
        trackFeedFetch(tenantId, feedKind, visibility, hostname, null);
    }

    @Transactional(readOnly = true)
    public void trackFeedFetch(
            Long tenantId,
            String feedKind,
            String visibility,
            String hostname,
            String clientUserAgent
    ) {
        trackFeedFetch(tenantId, feedKind, visibility, hostname, clientUserAgent, null);
    }

    @Transactional(readOnly = true)
    public void trackFeedFetch(
            Long tenantId,
            String feedKind,
            String visibility,
            String hostname,
            String clientUserAgent,
            String clientIp
    ) {
        if (tenantId == null
                || hostname == null
                || hostname.isBlank()
                || !ALLOWED_KINDS.contains(feedKind)
                || !ALLOWED_VISIBILITY.contains(visibility)) {
            return;
        }
        tenantEventTracker.track(
                tenantId,
                EVENT_NAME,
                "/feeds/" + feedKind,
                hostname,
                Map.of(
                        "feedKind", feedKind,
                        "visibility", visibility),
                clientUserAgent,
                clientIp);
    }
}
